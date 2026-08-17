// src/lib/marketing/bots.ts
//
// Open-tracking noise filtering.
//
// Since Apple Mail Privacy Protection shipped in 2021, Apple pre-fetches remote
// images for a large share of recipients whether or not the message is ever
// read. Security gateways do the same. A raw open count therefore measures
// "how many of your recipients use Apple Mail", not engagement.
//
// Rather than discard those hits, the tracking route records them separately:
// `openRaw` counts everything, `opened` counts what looks like a person. Clicks
// need the same treatment, since link scanners follow every URL in a message.

/** User-agent fragments belonging to prefetchers, scanners and security gateways. */
const BOT_PATTERNS = [
  'googleimageproxy',      // Gmail image proxy — proxies real opens too, see below
  'yahoomailproxy',
  'proofpoint',
  'barracuda',
  'mimecast',
  'symantec',
  'messagelabs',
  'microsoft office',      // Safe Links / ATP
  'bingpreview',
  'slackbot',
  'discordbot',
  'twitterbot',
  'facebookexternalhit',
  'whatsapp',
  'telegrambot',
  'curl/',
  'wget/',
  'python-requests',
  'go-http-client',
  'axios/',
  'node-fetch',
  'headlesschrome',
  'phantomjs',
  'bot',
  'crawler',
  'spider',
  'preview',
  'scanner',
];

/**
 * Apple's Mail Privacy Protection proxy. Its opens are machine prefetches and
 * carry no signal about whether anyone read the message.
 */
function isApplePrefetch(userAgent: string, headers: Headers): boolean {
  if (userAgent.includes('applemail') || userAgent.includes('apple mail')) return true;
  // MPP fetches come from Apple's proxy with this signature and no referer.
  return userAgent.includes('mozilla/5.0') && headers.get('x-apple-request-uuid') !== null;
}

export interface BotVerdict {
  /** True when the hit should not count towards engagement. */
  isBot: boolean;
  reason?: string;
}

/**
 * Classify a tracking hit.
 *
 * Note Gmail's image proxy is listed as a bot pattern but genuine Gmail opens
 * also arrive through it, so it is treated as *unverifiable* rather than
 * excluded outright: those hits count towards `openRaw` and are dropped from
 * `opened`, which keeps the headline metric conservative. Reporting a lower,
 * trustworthy number beats reporting an inflated one.
 */
export function classifyTrackingHit(request: Request): BotVerdict {
  const userAgent = (request.headers.get('user-agent') ?? '').toLowerCase();

  if (!userAgent) return { isBot: true, reason: 'no-user-agent' };
  if (isApplePrefetch(userAgent, request.headers)) return { isBot: true, reason: 'apple-mpp' };

  for (const pattern of BOT_PATTERNS) {
    if (userAgent.includes(pattern)) return { isBot: true, reason: pattern };
  }

  return { isBot: false };
}

/**
 * Clicks are held to a looser standard than opens. A click needs a deliberate
 * action, so the only real noise is automated link scanners; Apple's MPP does
 * not follow links, and excluding Gmail's proxy here would discard genuine
 * clicks.
 */
export function isScannerClick(request: Request): boolean {
  const userAgent = (request.headers.get('user-agent') ?? '').toLowerCase();
  if (!userAgent) return true;

  const scanners = ['proofpoint', 'barracuda', 'mimecast', 'symantec', 'messagelabs',
                    'microsoft office', 'safelinks', 'curl/', 'wget/', 'python-requests',
                    'go-http-client', 'headlesschrome', 'bot', 'crawler', 'spider', 'scanner'];
  return scanners.some((s) => userAgent.includes(s));
}
