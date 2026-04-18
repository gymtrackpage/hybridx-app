/**
 * Thin wrapper around the Garmin Training API.
 *
 * Endpoints (from the Connect Developer Program docs):
 *   POST   {GARMIN_API_BASE}/training-api/workout              → create workout
 *   PUT    {GARMIN_API_BASE}/training-api/workout/{workoutId}  → update workout
 *   DELETE {GARMIN_API_BASE}/training-api/workout/{workoutId}  → delete workout
 *   POST   {GARMIN_API_BASE}/training-api/schedule              → schedule on a date
 *   DELETE {GARMIN_API_BASE}/training-api/schedule/{scheduleId} → unschedule
 *
 * Verify the exact paths against the Partner Training API spec you
 * receive from Garmin after approval — they are stable but the version
 * prefix may differ.
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
    `${GARMIN_API_BASE}/training-api/workout`,
    workout,
    { headers: authHeaders(accessToken) },
  );
  // Garmin returns workoutId either at top level or inside a wrapper depending
  // on the endpoint version — accept both.
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
    `${GARMIN_API_BASE}/training-api/workout/${workoutId}`,
    workout,
    { headers: authHeaders(accessToken) },
  );
}

export async function deleteWorkout(
  accessToken: string,
  workoutId: string,
): Promise<void> {
  await axios.delete(`${GARMIN_API_BASE}/training-api/workout/${workoutId}`, {
    headers: authHeaders(accessToken),
  });
}

export interface ScheduleResult {
  workoutScheduleId?: string;
}

/** Schedule a workout to appear on a calendar date (YYYY-MM-DD). */
export async function scheduleWorkout(
  accessToken: string,
  workoutId: string,
  isoDate: string,
): Promise<ScheduleResult> {
  const res = await axios.post(
    `${GARMIN_API_BASE}/training-api/schedule`,
    { workoutId, date: isoDate },
    { headers: authHeaders(accessToken) },
  );
  return { workoutScheduleId: res.data?.workoutScheduleId };
}

/** Fetch the Garmin user's UUID — used for webhook deduping. */
export async function fetchGarminUserId(accessToken: string): Promise<string> {
  // Per Garmin Health/Connect SDK: GET /wellness-api/rest/user/id
  const res = await axios.get(
    `${GARMIN_API_BASE}/wellness-api/rest/user/id`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return res.data?.userId ?? res.data?.id ?? '';
}
