// src/app/api/auth/send-verification/route.ts
// Sends the account verification email through our own transport (Brevo/Gmail)
// instead of Firebase's default sender, which Gmail tends to spam-folder.
//
// The caller authenticates with their Firebase ID token (Authorization: Bearer).
// We generate the verification link server-side with the Admin SDK and email it.
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-auth';
import { getAdminAuth } from '@/lib/firebase-admin';
import { getUser } from '@/services/user-service';
import { sendVerificationEmail } from '@/lib/email-service';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
  // Authenticated + rate-limited (max 3 verification emails per minute per user).
  const auth = await requireUser(request, { bucket: 'auth:send-verification', windowMs: 60_000, max: 3 });
  if ('response' in auth) return auth.response;

  const email = auth.email;
  if (!email) {
    return NextResponse.json({ error: 'No email on account' }, { status: 400 });
  }

  try {
    // Already verified — nothing to do.
    const record = await getAdminAuth().getUser(auth.uid);
    if (record.emailVerified) {
      return NextResponse.json({ success: true, alreadyVerified: true });
    }

    // NOTE: actionCodeSettings (a continue URL back into the app) is intentionally
    // omitted — adding one requires the target domain to be listed under Firebase
    // Auth → Settings → Authorized domains, or link generation throws.
    const link = await getAdminAuth().generateEmailVerificationLink(email);

    let firstName: string | undefined;
    try {
      const profile = await getUser(auth.uid);
      firstName = profile?.firstName || undefined;
    } catch {
      /* personalisation is best-effort */
    }

    const result = await sendVerificationEmail(email, link, firstName);
    if (!result.success) {
      return NextResponse.json({ error: 'Could not send verification email' }, { status: 502 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error('[send-verification] failed:', err?.message);
    return NextResponse.json({ error: 'Could not send verification email' }, { status: 500 });
  }
}
