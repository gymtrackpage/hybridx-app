/**
 * Thin wrapper around the Garmin Training API V2.
 *
 * Endpoints (Training API V2 spec):
 *   POST   {GARMIN_API_BASE}/workoutportal/workout/v2              → create workout
 *   PUT    {GARMIN_API_BASE}/training-api/workout/v2/{workoutId}   → update workout
 *   DELETE {GARMIN_API_BASE}/training-api/workout/v2/{workoutId}   → delete workout
 *   POST   {GARMIN_API_BASE}/training-api/schedule/                → schedule on a date
 *   DELETE {GARMIN_API_BASE}/training-api/schedule/{scheduleId}    → unschedule
 */
import axios from 'axios';
import { GARMIN_API_BASE } from './oauth';
import type { GarminWorkout } from './workout-mapper';

function authHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
}

export interface PushedWorkout {
  workoutId: string;
}

export async function createWorkout(
  accessToken: string,
  workout: GarminWorkout,
): Promise<PushedWorkout> {
  const res = await axios.post(
    `${GARMIN_API_BASE}/workoutportal/workout/v2`,
    workout,
    { headers: authHeaders(accessToken) },
  );
  const id = res.data?.workoutId ?? res.data?.id;
  if (!id) throw new Error('Garmin createWorkout: no workoutId in response.');
  return { workoutId: String(id) };
}

export async function updateWorkout(
  accessToken: string,
  workoutId: string,
  workout: GarminWorkout,
): Promise<void> {
  await axios.put(
    `${GARMIN_API_BASE}/training-api/workout/v2/${workoutId}`,
    workout,
    { headers: authHeaders(accessToken) },
  );
}

/** HTTP status of a failed axios call, when there was a response at all. */
function statusOf(err: unknown): number | undefined {
  return (err as { response?: { status?: number } })?.response?.status;
}

/**
 * Delete a workout from the athlete's Garmin library.
 *
 * A workout that is already gone is a success — the caller's goal is "this
 * workout must not exist", and treating 404 as an error used to leave stale
 * ids queued forever.
 *
 * Workouts are created under `/workoutportal/` but the documented delete lives
 * under `/training-api/`; partner accounts differ on which prefix accepts the
 * delete. Try the documented one, then fall back to the create prefix, so a
 * prefix mismatch can't silently leave every replaced workout on the watch.
 */
export async function deleteWorkout(
  accessToken: string,
  workoutId: string,
): Promise<void> {
  const paths = [
    `${GARMIN_API_BASE}/training-api/workout/v2/${workoutId}`,
    `${GARMIN_API_BASE}/workoutportal/workout/v2/${workoutId}`,
  ];

  let lastError: unknown;
  for (const path of paths) {
    try {
      await axios.delete(path, { headers: authHeaders(accessToken) });
      return;
    } catch (e) {
      const status = statusOf(e);
      if (status === 404 || status === 410) return; // already gone
      // Only a routing-shaped failure is worth retrying on the other prefix.
      if (status !== 405 && status !== 400 && status !== 403) throw e;
      lastError = e;
    }
  }
  throw lastError;
}

export interface ScheduleResult {
  scheduleId?: string;
}

/** Schedule a workout to appear on a calendar date (YYYY-MM-DD). */
export async function scheduleWorkout(
  accessToken: string,
  workoutId: string,
  isoDate: string,
): Promise<ScheduleResult> {
  const res = await axios.post(
    `${GARMIN_API_BASE}/training-api/schedule/`,
    { workoutId, date: isoDate },
    { headers: authHeaders(accessToken) },
  );
  const scheduleId = res.data?.scheduleId ?? res.data?.workoutScheduleId;
  return { scheduleId: scheduleId ? String(scheduleId) : undefined };
}

/**
 * Remove a previously scheduled workout from the calendar.
 *
 * Deleting the workout does not reliably clear its calendar entries, so this
 * runs first whenever a scheduled workout is replaced. As with deleteWorkout,
 * an entry that is already gone counts as success.
 */
export async function unscheduleWorkout(
  accessToken: string,
  scheduleId: string,
): Promise<void> {
  try {
    await axios.delete(`${GARMIN_API_BASE}/training-api/schedule/${scheduleId}`, {
      headers: authHeaders(accessToken),
    });
  } catch (e) {
    const status = statusOf(e);
    if (status === 404 || status === 410) return;
    throw e;
  }
}

/** Fetch the Garmin user's UUID — used for webhook deduping. */
export async function fetchGarminUserId(accessToken: string): Promise<string> {
  const res = await axios.get(
    `${GARMIN_API_BASE}/wellness-api/rest/user/id`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return res.data?.userId ?? res.data?.id ?? '';
}
