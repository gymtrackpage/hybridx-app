// src/lib/trial.ts
// Single source of truth for the free-trial window.
//
// Previously the trial length (1 month) was hard-coded as `addMonths(start, 1)`
// in both the app layout gate and the subscription page. Centralising it here
// lets us tune the funnel in one place.
//
// ⚠️ Changing TRIAL_DAYS affects EXISTING trial users immediately, since the
// end date is derived from their stored trialStartDate. Shortening it will move
// anyone whose trial started more than TRIAL_DAYS ago into the paywall. If you
// want to grandfather existing users, gate on a per-user trialEndDate written
// at signup instead of recomputing from trialStartDate.

import { addDays, differenceInDays, isAfter } from 'date-fns';

/** Length of the free trial, in days. */
export const TRIAL_DAYS = 14;

function toDate(trialStart: Date | string | number | null | undefined): Date | null {
  if (!trialStart) return null;
  const d = trialStart instanceof Date ? trialStart : new Date(trialStart);
  return isNaN(d.getTime()) ? null : d;
}

/** The date/time the trial ends. Null if no valid start date. */
export function getTrialEndDate(trialStart: Date | string | number | null | undefined): Date | null {
  const start = toDate(trialStart);
  return start ? addDays(start, TRIAL_DAYS) : null;
}

/**
 * Whole days remaining in the trial (clamped to >= 0).
 * Returns 0 when there is no valid start date or the trial has ended.
 */
export function getTrialDaysLeft(trialStart: Date | string | number | null | undefined): number {
  const end = getTrialEndDate(trialStart);
  if (!end) return 0;
  return Math.max(0, differenceInDays(end, new Date()));
}

/**
 * Whether the trial has expired. A missing start date is treated as expired
 * (fail closed — no free access without a recorded trial start).
 */
export function isTrialExpired(trialStart: Date | string | number | null | undefined): boolean {
  const end = getTrialEndDate(trialStart);
  if (!end) return true;
  return isAfter(new Date(), end);
}
