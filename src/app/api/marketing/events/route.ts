// src/app/api/marketing/events/route.ts
//
// Behavioural signals from the marketing site.
//
// The lead bridge could previously carry one thing: "this address exists".
// Everything else the marketing site knows — that someone ran the race-time
// predictor, read the pricing, came back to a programme page three times — had
// nowhere to go, so no automation could ever be built on it. The `apiEvent`
// trigger existed and matched on a payload name, but nothing could raise one.
//
// This is that missing ingress. It is deliberately narrow: a name from a
// server-side allow-list, an identity, and a small payload.

import { NextResponse } from 'next/server';
import { guardBridge } from '@/lib/marketing/bridge-auth';
import { BRIDGE_EVENT_NAMES, emitMarketingEvent, isBridgeEventName } from '@/lib/marketing/events';
import { isPlausibleEmail } from '@/lib/marketing/subscribers';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/** Keeps one caller from filling the trigger bus with a runaway loop. */
const MAX_PAYLOAD_KEYS = 10;
const MAX_VALUE_LENGTH = 200;

interface EventBody {
  name?: string;
  email?: string;
  userId?: string;
  payload?: Record<string, unknown>;
}

/**
 * Reduce an arbitrary JSON object to scalars of bounded size.
 *
 * The payload is written straight into Firestore and later read by journey
 * conditions, so an unbounded nested object from another deployment is both a
 * storage and a correctness problem. Nested structures are dropped rather than
 * flattened: a trigger that matched on a shape nobody declared would be
 * impossible to reason about.
 */
function sanitisePayload(input: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!input || typeof input !== 'object') return {};

  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    if (Object.keys(out).length >= MAX_PAYLOAD_KEYS) break;
    if (!/^[a-zA-Z0-9_]{1,40}$/.test(key)) continue;

    if (typeof value === 'string') {
      out[key] = value.slice(0, MAX_VALUE_LENGTH);
    } else if (typeof value === 'number' && Number.isFinite(value)) {
      out[key] = value;
    } else if (typeof value === 'boolean') {
      out[key] = value;
    }
  }

  return out;
}

export async function POST(request: Request) {
  const blocked = guardBridge(request, 'events');
  if (blocked) return blocked;

  let body: EventBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const name = (body.name ?? '').trim();

  if (!name || !isBridgeEventName(name)) {
    // Naming the accepted set in the response: the caller is our own other
    // deployment, and a silent 400 here would be debugged by guesswork.
    return NextResponse.json(
      { error: 'Unknown event name.', accepted: BRIDGE_EVENT_NAMES },
      { status: 400 },
    );
  }

  // An event the engine cannot attribute to a subscriber is discarded during
  // processing, so refusing it here turns a silent no-op into a clear failure.
  if (!body.email && !body.userId) {
    return NextResponse.json(
      { error: 'Either email or userId is required to attribute the event.' },
      { status: 400 },
    );
  }

  if (body.email && !isPlausibleEmail(body.email)) {
    return NextResponse.json({ error: 'That does not look like a valid email address.' }, { status: 400 });
  }

  // `name` travels inside the payload because that is where triggerMatchesEvent
  // reads it from for an apiEvent trigger.
  await emitMarketingEvent('apiEvent', {
    email: body.email,
    userId: body.userId,
    payload: { ...sanitisePayload(body.payload), name },
  });

  logger.log(`[marketing/events] recorded ${name} from the bridge`);

  return NextResponse.json({ success: true, name });
}
