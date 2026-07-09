// First-touch marketing attribution: captures UTM params from the URL on a
// visitor's first load of the app and persists them so they can be attached
// to the user record at signup. Lets trial-to-paid conversions be traced
// back to the marketing page/campaign that drove them.

const STORAGE_KEY = 'hx_attribution';

export interface Attribution {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  landingPage?: string;
  referrer?: string;
  capturedAt: string;
}

const UTM_KEYS: Array<[string, keyof Omit<Attribution, 'capturedAt' | 'landingPage' | 'referrer'>]> = [
  ['utm_source', 'utmSource'],
  ['utm_medium', 'utmMedium'],
  ['utm_campaign', 'utmCampaign'],
  ['utm_term', 'utmTerm'],
  ['utm_content', 'utmContent'],
];

/**
 * Captures UTM params on the visitor's first load. No-ops if attribution is
 * already stored (first-touch, not last-touch) or if the current URL has no
 * UTM params at all.
 */
export function captureAttribution(): void {
  if (typeof window === 'undefined') return;
  try {
    if (localStorage.getItem(STORAGE_KEY)) return;

    const params = new URLSearchParams(window.location.search);
    const hasUtm = UTM_KEYS.some(([param]) => params.has(param));
    if (!hasUtm) return;

    const attribution: Attribution = { capturedAt: new Date().toISOString() };
    for (const [param, key] of UTM_KEYS) {
      const value = params.get(param);
      if (value) attribution[key] = value;
    }
    attribution.landingPage = window.location.pathname;
    attribution.referrer = document.referrer || undefined;

    localStorage.setItem(STORAGE_KEY, JSON.stringify(attribution));
  } catch {
    // localStorage unavailable (private mode, etc.) — attribution is
    // best-effort and should never block the app.
  }
}

/** Reads the stored first-touch attribution, if any was captured. */
export function getAttribution(): Attribution | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
