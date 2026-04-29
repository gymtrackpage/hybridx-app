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

export async function deleteWorkout(
  accessToken: string,
  workoutId: string,
): Promise<void> {
  await axios.delete(`${GARMIN_API_BASE}/training-api/workout/v2/${workoutId}`, {
    headers: authHeaders(accessToken),
  });
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

/** Remove a previously scheduled workout from the calendar. */
export async function unscheduleWorkout(
  accessToken: string,
  scheduleId: string,
): Promise<void> {
  await axios.delete(`${GARMIN_API_BASE}/training-api/schedule/${scheduleId}`, {
    headers: authHeaders(accessToken),
  });
}

/** Fetch the Garmin user's UUID — used for webhook deduping. */
export async function fetchGarminUserId(accessToken: string): Promise<string> {
  const res = await axios.get(
    `${GARMIN_API_BASE}/wellness-api/rest/user/id`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return res.data?.userId ?? res.data?.id ?? '';
}
