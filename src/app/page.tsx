
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/icons';
import { getAdminAuth } from '@/lib/firebase-admin';

export default async function WelcomePage() {
  // Check for session cookie server-side
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('__session')?.value;

  if (sessionCookie) {
    try {
      // Verify the session cookie
      const adminAuth = getAdminAuth();
      await adminAuth.verifySessionCookie(sessionCookie, true);
      
      // If valid, redirect immediately to dashboard
      console.log('✅ [WelcomePage] Valid session found, redirecting to dashboard');
      redirect('/dashboard');
    } catch (error) {
      // If verification fails, we just let the page render as normal
      console.log('⚠️ [WelcomePage] Session cookie found but invalid or expired');
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center p-4">
      <Image
        src="/coverimage.jpg"
        alt="Athletes training"
        fill
        className="object-cover"
        priority
        data-ai-hint="fitness running"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent" />

      <div className="relative z-10 flex flex-col items-center justify-center p-8 text-center text-white">
        <Logo className="mb-4 h-16 w-16 invert" />
        <h1 className="font-headline text-4xl font-bold md:text-5xl">
          Unlock Your Peak Performance
        </h1>
        <p className="mt-4 max-w-lg text-lg text-white/90">
          Advanced training plans for all abilities, expert coaching, and progress tracking with AI assistance.
        </p>
        <div className="mt-8 flex w-full max-w-xs flex-col gap-4">
          <Button asChild size="lg" variant="accent">
            <Link href="/signup">Get Started</Link>
          </Button>
          <Button asChild variant="secondary" size="lg">
            <Link href="/login">I'm Already a Member</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
