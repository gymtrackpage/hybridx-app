/**
 * Garmin OAuth 2.0 + PKCE primitives.
 *
 * Endpoints come from the Garmin Connect Developer Program OAuth2 docs.
 * They are env-overridable so you can swap them if your Partner spec
 * differs (e.g. sandbox URLs):
 *   GARMIN_AUTHORIZE_URL  default https://connect.garmin.com/oauth2Confirm
 *   GARMIN_TOKEN_URL      default https://diauth.garmin.com/di-oauth2-service/oauth/token
 *   GARMIN_API_BASE       default https://apis.garmin.com
 */
import crypto from 'node:crypto';

export const GARMIN_AUTHORIZE_URL =
  process.env.GARMIN_AUTHORIZE_URL || 'https://connect.garmin.com/oauth2Confirm';
export const GARMIN_TOKEN_URL =
  process.env.GARMIN_TOKEN_URL ||
  'https://diauth.garmin.com/di-oauth2-service/oauth/token';
export const GARMIN_API_BASE =
  process.env.GARMIN_API_BASE || 'https://apis.garmin.com';

/** Returns base64url-encoded random bytes — RFC 7636 §4.1. */
export function generatePkceVerifier(): string {
  // 32 bytes → 43-char base64url string, well within the 43–128 char spec.
  return crypto.randomBytes(32).toString('base64url');
}

/** S256 challenge: BASE64URL(SHA256(verifier)) — RFC 7636 §4.2. */
export function generatePkceChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

/** Random state nonce for CSRF protection. */
export function generateState(): string {
  return crypto.randomBytes(16).toString('base64url');
}

export function buildAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  state: string;
  scope?: string;
}): string {
  const url = new URL(GARMIN_AUTHORIZE_URL);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', params.clientId);
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('code_challenge', params.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('state', params.state);
  if (params.scope) url.searchParams.set('scope', params.scope);
  return url.toString();
}
