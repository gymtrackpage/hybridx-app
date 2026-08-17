// src/lib/marketing/validate.ts
//
// Post-generation fact checking.
//
// Prompting a model to use only supplied facts works most of the time. "Most of
// the time" is not good enough when the output goes to thousands of people
// under your own brand, so every generated draft is checked against the same
// snapshot that produced it before a human ever sees it.
//
// This deliberately checks a small number of things very reliably rather than
// attempting general truth-checking: prices, trial lengths, programme names and
// fabricated statistics are the claims that (a) recur, (b) are checkable
// mechanically, and (c) cause real damage when wrong.

import type { KnowledgeSnapshot } from './knowledge';

export type IssueSeverity = 'error' | 'warning';

export interface ValidationIssue {
  severity: IssueSeverity;
  /** What was found, quoted from the draft. */
  found: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
}

/** Currency amounts, e.g. £5, £5.99, $10, €7/month. */
const PRICE_PATTERN = /[£$€]\s?\d+(?:\.\d{1,2})?/g;

/** Trial-length claims, e.g. "14-day free trial", "free for 30 days", "1-month trial". */
const TRIAL_PATTERNS = [
  /(\d+)[-\s]?day(?:s)?\s+(?:free\s+)?trial/gi,
  /(?:free|trial)\s+for\s+(\d+)\s+days?/gi,
  /(\d+)[-\s]?(?:month|week)(?:s)?\s+(?:free\s+)?trial/gi,
  /(?:one|two|three)[-\s]?month\s+(?:free\s+)?trial/gi,
];

/** Statistic-shaped claims the model has no basis for, e.g. "87% of athletes". */
const STAT_PATTERN = /\b\d{1,3}(?:\.\d+)?%\s+of\s+(?:our\s+)?(?:athletes|users|members|customers|hyrox)/gi;

/** Strip HTML so checks run against the words a reader will actually see. */
function toText(input: string): string {
  return input
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');
}

/** Normalise a programme name for comparison: lowercase, punctuation-insensitive. */
function normaliseName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Check a draft against the facts it was given.
 *
 * Errors block; warnings are surfaced for the human reviewing the draft.
 */
export function validateDraft(
  content: { subject?: string; body: string },
  snapshot: KnowledgeSnapshot,
): ValidationResult {
  const text = toText(`${content.subject ?? ''} ${content.body}`);
  const issues: ValidationIssue[] = [];

  // --- Price -------------------------------------------------------------
  const allowedPrices = new Set(
    (snapshot.priceLabel.match(PRICE_PATTERN) ?? []).map((p) => p.replace(/\s/g, '')),
  );
  for (const match of new Set(text.match(PRICE_PATTERN) ?? [])) {
    if (!allowedPrices.has(match.replace(/\s/g, ''))) {
      issues.push({
        severity: 'error',
        found: match,
        message: `States a price of ${match}, but the current price is ${snapshot.priceLabel}.`,
      });
    }
  }

  // --- Trial length ------------------------------------------------------
  for (const pattern of TRIAL_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      const phrase = match[0];
      const number = match[1] ? Number(match[1]) : null;

      // A day-count that matches the real trial is fine; anything else — a
      // month, a week, a different day count — is wrong.
      const isCorrectDayCount =
        number !== null && /day/i.test(phrase) && number === snapshot.trialDays;

      if (!isCorrectDayCount) {
        issues.push({
          severity: 'error',
          found: phrase.trim(),
          message: `Claims "${phrase.trim()}", but the trial is ${snapshot.trialDays} days.`,
        });
      }
    }
  }

  // --- Programme names ---------------------------------------------------
  // Only flags names presented as programmes, since prose legitimately contains
  // words that also appear in programme titles.
  const realPrograms = new Set(snapshot.programs.map((p) => normaliseName(p.name)));
  const quoted = text.matchAll(/["“']([A-Z][^"”']{4,60})["”']/g);
  for (const match of quoted) {
    const candidate = match[1];
    if (!/program|plan|cycle|prep|performance|steps|fusion|elite/i.test(candidate)) continue;
    if (realPrograms.size === 0) {
      issues.push({
        severity: 'warning',
        found: candidate,
        message: 'Names what looks like a programme, but no programmes were available to check against.',
      });
      continue;
    }
    if (!realPrograms.has(normaliseName(candidate))) {
      issues.push({
        severity: 'error',
        found: candidate,
        message: `"${candidate}" is not one of the current programmes.`,
      });
    }
  }

  // --- Invented statistics ----------------------------------------------
  for (const match of new Set(text.match(STAT_PATTERN) ?? [])) {
    issues.push({
      severity: 'error',
      found: match,
      message: `Cites a statistic ("${match}") that has no source in the supplied facts.`,
    });
  }

  // --- Deliverability and completeness ----------------------------------
  if (content.subject !== undefined) {
    const subject = content.subject.trim();
    if (!subject) {
      issues.push({ severity: 'error', found: '(empty)', message: 'The subject line is empty.' });
    } else if (subject.length > 78) {
      issues.push({
        severity: 'warning',
        found: subject,
        message: `Subject is ${subject.length} characters; most inboxes truncate beyond about 60.`,
      });
    }
    if (/^(re|fwd):/i.test(subject)) {
      issues.push({
        severity: 'warning',
        found: subject,
        message: 'A fake "Re:" or "Fwd:" prefix reads as deceptive and hurts sender reputation.',
      });
    }
  }

  // Unfilled merge tokens reach the reader as literal braces.
  for (const match of new Set(text.match(/\{\{[^}]+\}\}/g) ?? [])) {
    issues.push({
      severity: 'error',
      found: match,
      message: `Unresolved template placeholder ${match} would be sent literally.`,
    });
  }

  if (/HybridX|Hybrid X|Hybrid-X/.test(text)) {
    issues.push({
      severity: 'warning',
      found: 'HybridX',
      message: 'The brand is written HYBRIDX, never "HybridX", "Hybrid X" or "Hybrid-X".',
    });
  }

  if (/\bHyrox\b/.test(text)) {
    issues.push({
      severity: 'warning',
      found: 'Hyrox',
      message: 'HYROX is always written in capitals.',
    });
  }

  return { ok: !issues.some((i) => i.severity === 'error'), issues };
}
