// src/lib/marketing/tokens.ts
//
// Signed tokens for links that arrive in email and are therefore acted on by an
// unauthenticated browser.
//
// HXMailer's unsubscribe link was `?userId=…&subscriberId=…` with no signature,
// so anyone who guessed or enumerated an id could unsubscribe that person, and
// the tracking links carried the same unauthenticated identifiers. Signing them
// means a link only works for the person it was minted for.

import { createHmac, timingSafeEqual } from 'crypto';

/** Purpose is part of the signed payload, so an unsubscribe token cannot be replayed as a tracking token. */
export type TokenPurpose = 'unsubscribe' | 'track';

export interface TokenPayload {
  purpose: TokenPurpose;
  subscriberId: string;
  campaignId: string;
  /** Epoch seconds. 0 means the token never expires. */
  expiresAt: number;
}

/**
 * Unsubscribe links must keep working long after the send: people act on old
 * email, and a dead unsubscribe link is both a bad experience and a fast route
 * to spam complaints. A year is a compromise between that and not minting
 * eternally valid credentials.
 */
export const UNSUBSCRIBE_TTL_SECONDS = 365 * 24 * 60 * 60;

/** Tracking tokens only need to outlive normal engagement with a campaign. */
export const TRACK_TTL_SECONDS = 180 * 24 * 60 * 60;

function secret(): string {
  const value = process.env.MARKETING_TOKEN_SECRET;
  if (!value || value.length < 32) {
    // Failing loudly beats falling back to a default: a predictable signing key
    // would make every token forgeable while looking like it worked.
    throw new Error(
      'MARKETING_TOKEN_SECRET is not set, or is shorter than 32 characters. ' +
        'Marketing links cannot be signed without it.',
    );
  }
  return value;
}

/** URL-safe base64 without padding, so tokens survive query strings and mail clients intact. */
function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function sign(data: string): string {
  return b64url(createHmac('sha256', secret()).update(data).digest());
}

/**
 * Mint a token of the form `<purpose>.<subscriberId>.<campaignId>.<expiry>.<signature>`.
 *
 * The payload is readable — it identifies nobody who is not already identified
 * by the link's own purpose, and keeping it legible makes support and debugging
 * far easier than an opaque blob. The signature is what makes it unforgeable.
 */
export function createToken(
  purpose: TokenPurpose,
  subscriberId: string,
  campaignId: string,
  ttlSeconds: number = purpose === 'unsubscribe' ? UNSUBSCRIBE_TTL_SECONDS : TRACK_TTL_SECONDS,
): string {
  const expiresAt = ttlSeconds > 0 ? Math.floor(Date.now() / 1000) + ttlSeconds : 0;
  const body = `${purpose}.${subscriberId}.${campaignId}.${expiresAt}`;
  return `${body}.${sign(body)}`;
}

export type VerifyResult =
  | { valid: true; payload: TokenPayload }
  | { valid: false; reason: 'malformed' | 'bad-signature' | 'expired' | 'wrong-purpose' };

/**
 * Verify a token and return its payload.
 *
 * Signature comparison is constant-time. The margin matters little for an
 * unsubscribe link, but a timing oracle on an HMAC is the kind of thing that
 * silently becomes important once the same helper is reused for something else.
 */
export function verifyToken(token: string, expectedPurpose?: TokenPurpose): VerifyResult {
  const parts = (token ?? '').split('.');
  if (parts.length !== 5) return { valid: false, reason: 'malformed' };

  const [purpose, subscriberId, campaignId, expiryRaw, signature] = parts;
  if (!purpose || !subscriberId || !signature) return { valid: false, reason: 'malformed' };

  const expiresAt = Number(expiryRaw);
  if (!Number.isFinite(expiresAt) || expiresAt < 0) return { valid: false, reason: 'malformed' };

  const expected = sign(`${purpose}.${subscriberId}.${campaignId}.${expiryRaw}`);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { valid: false, reason: 'bad-signature' };
  }

  // Purpose is checked only after the signature, so an attacker learns nothing
  // about valid purposes from an unsigned guess.
  if (expectedPurpose && purpose !== expectedPurpose) {
    return { valid: false, reason: 'wrong-purpose' };
  }
  if (expiresAt !== 0 && expiresAt < Math.floor(Date.now() / 1000)) {
    return { valid: false, reason: 'expired' };
  }

  return {
    valid: true,
    payload: { purpose: purpose as TokenPurpose, subscriberId, campaignId, expiresAt },
  };
}

/** Whether signing is configured. Used by the pre-send checklist to fail before a send, not during one. */
export function isTokenSecretConfigured(): boolean {
  const value = process.env.MARKETING_TOKEN_SECRET;
  return !!value && value.length >= 32;
}
