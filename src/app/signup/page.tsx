import Link from 'next/link';
import { SignupForm } from '@/components/auth-forms';
import { Logo } from '@/components/icons';

export default function SignupPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="container z-40 bg-background">
        <div className="flex h-20 items-center justify-between py-6">
          <Link href="/" className="flex items-center gap-2">
            <Logo className="h-8 w-8 text-primary" />
            <span className="font-bold">HYBRIDX.CLUB</span>
          </Link>
          <nav>
            <Link href="/" className="text-sm font-medium text-muted-foreground hover:text-primary">
              Already have an account? Sign In
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center p-4">
        <SignupForm />
      </main>
    </div>
  );
}
