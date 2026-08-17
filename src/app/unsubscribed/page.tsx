import Link from 'next/link';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/icons';

/**
 * Landing page for the unsubscribe link.
 *
 * Deliberately outside the (app) group: the reader is almost certainly not
 * signed in, and an unsubscribe that bounced someone to a login screen would be
 * worse than useless.
 */
export default async function UnsubscribedPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const failed = Boolean(error);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <Link href="/" className="mb-8 flex items-center gap-2">
        <Logo className="h-8 w-8 text-primary" />
        <span className="font-headline text-lg font-semibold">HYBRIDX.CLUB</span>
      </Link>

      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-sm">
        {failed ? (
          <>
            <XCircle className="mx-auto h-12 w-12 text-destructive" />
            <h1 className="mt-4 font-headline text-2xl font-bold">
              We couldn&apos;t process that link
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              {error === 'expired'
                ? 'That unsubscribe link has expired.'
                : 'That unsubscribe link was invalid or incomplete.'}{' '}
              You can still manage your email preferences from your profile, or reply to any of our
              emails and we&apos;ll take care of it.
            </p>
            <Button asChild className="mt-6">
              <Link href="/profile">Manage preferences</Link>
            </Button>
          </>
        ) : (
          <>
            <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
            <h1 className="mt-4 font-headline text-2xl font-bold">You&apos;ve been unsubscribed</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              You won&apos;t receive any more marketing emails from HYBRIDX. If you have an account,
              essential emails about it — verification, receipts and coaching updates — will still
              be sent.
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              Changed your mind? You can opt back in from your profile at any time.
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button asChild variant="outline">
                <Link href="/">Back to HYBRIDX</Link>
              </Button>
              <Button asChild>
                <Link href="/profile">Manage preferences</Link>
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
