// src/lib/marketing/personalise.ts
//
// Per-recipient transformation of a campaign body: merge tokens, tracking pixel,
// link rewriting and the unsubscribe footer.
//
// Carried over from HXMailer's send action, with three changes:
//   - tracking URLs are signed (see tokens.ts) instead of carrying bare ids;
//   - the plain-text part is built from the *original* body, before tracking
//     markup is injected, rather than by flattening the rewritten HTML;
//   - merge tokens fall back to a neutral word rather than leaving "Hi ," when
//     a subscriber has no first name.

import { parse } from 'node-html-parser';
import { createToken } from './tokens';
import type { Subscriber } from './types';

/** Merge tokens, in the `[First Name]` style HXMailer campaigns already use. */
export const MERGE_TOKENS = ['First Name', 'Last Name', 'Full Name', 'Email'] as const;

/**
 * Substitute merge tokens.
 *
 * A missing first name yields "Athlete" rather than an empty string: an email
 * opening "Hi ," reads as broken in a way that "Hi Athlete," does not, and a
 * meaningful fraction of any list has no name attached.
 */
export function personalise(text: string, sub: Pick<Subscriber, 'firstName' | 'lastName' | 'email'>): string {
  const first = sub.firstName?.trim() || 'Athlete';
  const last = sub.lastName?.trim() || '';
  const full = [sub.firstName?.trim(), last].filter(Boolean).join(' ') || 'Athlete';

  return text
    .replace(/\[First Name\]/gi, first)
    .replace(/\[Last Name\]/gi, last)
    .replace(/\[Full Name\]/gi, full)
    .replace(/\[Email\]/gi, sub.email ?? '');
}

/** Strip HTML to a readable plain-text alternative. */
export function htmlToPlainText(html: string): string {
  const root = parse(html);

  // Turn links into "text (url)" so the text part is still actionable —
  // flattening them loses the destination entirely.
  root.querySelectorAll('a').forEach((a) => {
    const href = a.getAttribute('href');
    const label = a.text.trim();
    if (href && label && !href.startsWith('mailto:')) {
      a.replaceWith(`${label} (${href})`);
    }
  });

  root.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
  ['p', 'div', 'tr', 'h1', 'h2', 'h3', 'h4', 'li'].forEach((tag) => {
    root.querySelectorAll(tag).forEach((el) => el.insertAdjacentHTML('afterend', '\n'));
  });

  return root.text
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim();
}

/**
 * Stamp UTM parameters onto a link so a signup can be traced back to the
 * campaign that drove it.
 *
 * The app already captures first-touch attribution from UTM parameters into
 * `acquisitionCampaign` on the athlete record (src/lib/attribution.ts), so
 * adding them here is the whole of the conversion loop — reports can then join
 * athletes to the campaign that brought them in, which turns "12% clicked" into
 * "this campaign produced nine trials".
 *
 * Hand-written UTM parameters are never overwritten: if the author set
 * utm_campaign deliberately, that is the more specific intent.
 */
export function withCampaignAttribution(href: string, campaignId: string): string {
  try {
    const url = new URL(href);

    // Only tag our own destinations. Adding UTM parameters to a third-party
    // link is noise in someone else's analytics, and can break signed URLs.
    const host = url.hostname.toLowerCase();
    if (!host.endsWith('hybridx.club') && host !== 'localhost') return href;

    if (!url.searchParams.has('utm_source')) url.searchParams.set('utm_source', 'email');
    if (!url.searchParams.has('utm_medium')) url.searchParams.set('utm_medium', 'campaign');
    if (!url.searchParams.has('utm_campaign')) url.searchParams.set('utm_campaign', campaignId);

    return url.toString();
  } catch {
    return href;
  }
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
  /** Absolute URL for the List-Unsubscribe header and the one-click POST. */
  unsubscribeUrl: string;
}

export interface RenderOptions {
  campaignId: string;
  subject: string;
  htmlBody: string;
  subscriber: Subscriber;
  appUrl: string;
  /** Test sends skip tracking so a preview never pollutes campaign analytics. */
  tracking?: boolean;
}

/**
 * Build the exact message a given subscriber will receive.
 */
export function renderForSubscriber(opts: RenderOptions): RenderedEmail {
  const { campaignId, subscriber, appUrl, tracking = true } = opts;

  const subject = personalise(opts.subject, subscriber);
  const personalisedHtml = personalise(opts.htmlBody, subscriber);

  const unsubToken = createToken('unsubscribe', subscriber.id, campaignId);
  const unsubscribeUrl = `${appUrl}/api/marketing/unsubscribe?t=${encodeURIComponent(unsubToken)}`;

  // Plain text comes from the body before tracking markup is added, so the
  // text part never contains a redirect wrapper or a stray pixel.
  const text = `${htmlToPlainText(personalisedHtml)}\n\n---\nUnsubscribe: ${unsubscribeUrl}`;

  const root = parse(personalisedHtml);
  // A body element is not guaranteed — campaigns may be authored as fragments.
  const container = root.querySelector('body') ?? root;

  if (tracking) {
    const trackToken = createToken('track', subscriber.id, campaignId);

    root.querySelectorAll('a').forEach((link) => {
      const href = link.getAttribute('href');
      if (!href) return;
      // Leave the unsubscribe link and non-HTTP schemes alone: wrapping the
      // unsubscribe would make opting out depend on the tracking endpoint.
      if (href.includes('/api/marketing/unsubscribe')) return;
      if (!/^https?:\/\//i.test(href)) return;

      const destination = withCampaignAttribution(href, campaignId);
      const url = `${appUrl}/api/marketing/track/click?t=${encodeURIComponent(trackToken)}&url=${encodeURIComponent(destination)}`;
      link.setAttribute('href', url);
    });

    container.insertAdjacentHTML(
      'beforeend',
      `<img src="${appUrl}/api/marketing/track/open?t=${encodeURIComponent(trackToken)}" width="1" height="1" alt="" style="border:0;display:block;height:1px;width:1px;overflow:hidden;" />`,
    );
  }

  container.insertAdjacentHTML(
    'beforeend',
    `<div style="text-align:center;font-size:12px;color:#777;margin-top:24px;line-height:1.5;">` +
      `<p style="margin:0;">You are receiving this because you subscribed to HYBRIDX updates.</p>` +
      `<p style="margin:4px 0 0;"><a href="${unsubscribeUrl}" style="color:#777;text-decoration:underline;">Unsubscribe</a></p>` +
      `</div>`,
  );

  return { subject, html: root.toString(), text, unsubscribeUrl };
}
