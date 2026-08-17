// src/lib/marketing/brief-email.ts
//
// Renders the weekly brief as an email to the admin.
//
// Sent through the transactional transport (src/lib/email-service.ts), not the
// bulk one: it is internal correspondence, must not be subject to the marketing
// frequency cap, and must not appear in campaign statistics.

import { escapeHtml } from './render';
import type { WeeklyBrief } from './brief';
import type { CampaignProposal } from '@/ai/flows/marketing/propose-campaigns';

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function pct(value: number | null): string {
  return value === null ? '—' : `${(value * 100).toFixed(1)}%`;
}

function delta(value: number | null, asPercent = false): string {
  if (value === null) return '';
  const sign = value > 0 ? '+' : '';
  const formatted = asPercent ? `${(value * 100).toFixed(1)} pts` : String(value);
  const colour = value > 0 ? '#16a34a' : value < 0 ? '#dc2626' : '#6b7280';
  return ` <span style="color:${colour};font-size:13px;">(${sign}${formatted})</span>`;
}

export interface BriefEmailInput {
  brief: WeeklyBrief;
  summary: string;
  proposals: Array<CampaignProposal & { journeyId?: string; error?: string }>;
  appUrl: string;
}

export function renderBriefEmail({ brief, summary, proposals, appUrl }: BriefEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const weekEnding = new Date(brief.periodEnd).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });

  const stat = (label: string, value: string, change = '') =>
    `<tr>
      <td style="padding:6px 0;font-family:${FONT};font-size:14px;color:#6b7280;">${label}</td>
      <td style="padding:6px 0;font-family:${FONT};font-size:14px;font-weight:600;text-align:right;">${value}${change}</td>
    </tr>`;

  const campaignRows = brief.campaigns.length
    ? brief.campaigns
        .map(
          (c) =>
            `<tr>
              <td style="padding:8px 0;font-family:${FONT};font-size:14px;">
                <a href="${appUrl}/admin/marketing/campaigns/${c.id}" style="color:#171717;">${escapeHtml(c.subject)}</a>
                <div style="color:#6b7280;font-size:12px;margin-top:2px;">
                  ${c.recipients.toLocaleString()} sent · ${pct(c.openRate)} opened · ${pct(c.clickRate)} clicked${c.unsubscribes ? ` · ${c.unsubscribes} unsubscribed` : ''}
                </div>
              </td>
            </tr>`,
        )
        .join('')
    : `<tr><td style="padding:8px 0;font-family:${FONT};font-size:14px;color:#6b7280;">No campaigns sent this week.</td></tr>`;

  const proposalBlocks = proposals
    .map((p) => {
      const badge =
        p.priority === 'high' ? '#dc2626' : p.priority === 'medium' ? '#f9c31f' : '#6b7280';

      const action = p.error
        ? `<p style="margin:10px 0 0;font-family:${FONT};font-size:13px;color:#dc2626;">Could not draft this one automatically: ${escapeHtml(p.error)}. The prompt above works as-is in the studio.</p>`
        : p.journeyId
          ? `<p style="margin:12px 0 0;">
               <a href="${appUrl}/admin/marketing/journeys/${p.journeyId}" style="display:inline-block;background:#f9c31f;color:#171717;text-decoration:none;padding:10px 18px;border-radius:6px;font-family:${FONT};font-size:14px;font-weight:600;">Review the draft</a>
             </p>`
          : '';

      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e5e7eb;border-radius:10px;margin-bottom:12px;">
        <tr><td style="padding:16px;">
          <span style="display:inline-block;background:${badge};color:#fff;font-family:${FONT};font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;padding:3px 8px;border-radius:4px;">${p.priority}</span>
          <h3 style="margin:8px 0 0;font-family:${FONT};font-size:16px;">${escapeHtml(p.title)}</h3>
          <p style="margin:6px 0 0;font-family:${FONT};font-size:14px;line-height:1.5;color:#374151;">${escapeHtml(p.rationale)}</p>
          <p style="margin:8px 0 0;font-family:${FONT};font-size:13px;color:#6b7280;">Reaches: ${escapeHtml(p.expectedAudience)}</p>
          ${action}
        </td></tr>
      </table>`;
    })
    .join('');

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#f4f4f5;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f5;">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#fff;border-radius:14px;">
      <tr><td style="padding:24px 28px 0;">
        <p style="margin:0;font-family:${FONT};font-size:13px;font-weight:700;letter-spacing:0.1em;color:#171717;">HYBRIDX MARKETING</p>
        <h1 style="margin:8px 0 0;font-family:${FONT};font-size:22px;">Week ending ${weekEnding}</h1>
        <p style="margin:10px 0 0;font-family:${FONT};font-size:15px;line-height:1.55;color:#374151;">${escapeHtml(summary)}</p>
      </td></tr>

      <tr><td style="padding:20px 28px 0;">
        <h2 style="margin:0 0 6px;font-family:${FONT};font-size:15px;">The numbers</h2>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          ${stat('Mailable subscribers', brief.list.mailable.toLocaleString(), delta(brief.list.mailableChange))}
          ${stat('Joined this week', brief.list.newThisWeek.toLocaleString())}
          ${stat('Unsubscribed', brief.list.unsubscribedThisWeek.toLocaleString())}
          ${stat('Bounced', brief.list.bouncedThisWeek.toLocaleString())}
          ${stat('Spam complaints', brief.list.complainedThisWeek.toLocaleString())}
          ${stat('Campaigns sent', String(brief.sending.campaignsSent))}
          ${stat('Emails delivered', brief.sending.emailsDelivered.toLocaleString())}
          ${stat('Average open rate', pct(brief.sending.averageOpenRate), delta(brief.sending.openRateChange, true))}
          ${stat('Average click rate', pct(brief.sending.averageClickRate))}
          ${stat('Live journeys', String(brief.journeys.live))}
          ${stat('Athletes mid-journey', brief.journeys.activeRuns.toLocaleString())}
        </table>
        ${!brief.hasComparison ? `<p style="margin:10px 0 0;font-family:${FONT};font-size:12px;color:#6b7280;">First brief — no previous week to compare against yet.</p>` : ''}
      </td></tr>

      <tr><td style="padding:20px 28px 0;">
        <h2 style="margin:0 0 4px;font-family:${FONT};font-size:15px;">Worth noting</h2>
        <ul style="margin:0;padding-left:18px;font-family:${FONT};font-size:14px;line-height:1.6;color:#374151;">
          ${brief.observations.map((o) => `<li style="margin-bottom:6px;">${escapeHtml(o)}</li>`).join('')}
        </ul>
      </td></tr>

      <tr><td style="padding:20px 28px 0;">
        <h2 style="margin:0 0 4px;font-family:${FONT};font-size:15px;">Campaigns this week</h2>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${campaignRows}</table>
      </td></tr>

      <tr><td style="padding:20px 28px 0;">
        <h2 style="margin:0 0 10px;font-family:${FONT};font-size:15px;">Suggested next</h2>
        ${proposalBlocks || `<p style="font-family:${FONT};font-size:14px;color:#6b7280;">No proposals this week.</p>`}
        <p style="margin:4px 0 0;font-family:${FONT};font-size:12px;line-height:1.5;color:#6b7280;">
          Each of these is saved as a <strong>draft</strong> journey. Nothing sends until you read it,
          test it and activate it.
        </p>
      </td></tr>

      <tr><td style="padding:24px 28px 28px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="border-top:1px solid #e5e7eb;padding-top:16px;">
            <p style="margin:0;font-family:${FONT};font-size:12px;color:#6b7280;">
              Generated automatically from HYBRIDX marketing data.
              <a href="${appUrl}/admin/marketing" style="color:#6b7280;">Open the console</a>.
            </p>
          </td></tr></table>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

  const text = [
    `HYBRIDX MARKETING — week ending ${weekEnding}`,
    '',
    summary,
    '',
    'THE NUMBERS',
    `  Mailable subscribers: ${brief.list.mailable}`,
    `  Joined this week: ${brief.list.newThisWeek}`,
    `  Unsubscribed: ${brief.list.unsubscribedThisWeek}`,
    `  Bounced: ${brief.list.bouncedThisWeek}`,
    `  Spam complaints: ${brief.list.complainedThisWeek}`,
    `  Campaigns sent: ${brief.sending.campaignsSent}`,
    `  Average open rate: ${pct(brief.sending.averageOpenRate)}`,
    '',
    'WORTH NOTING',
    ...brief.observations.map((o) => `  - ${o}`),
    '',
    'SUGGESTED NEXT',
    ...proposals.flatMap((p) => [
      `  [${p.priority}] ${p.title}`,
      `    ${p.rationale}`,
      p.journeyId ? `    Review: ${appUrl}/admin/marketing/journeys/${p.journeyId}` : '',
      '',
    ]),
    'Each proposal is saved as a draft. Nothing sends until you activate it.',
  ]
    .filter((l) => l !== '')
    .join('\n');

  return {
    subject: `HYBRIDX marketing — week ending ${weekEnding}`,
    html,
    text,
  };
}
