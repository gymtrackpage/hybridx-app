import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { LoginForm } from '@/components/auth-forms';
import { Logo } from '@/components/icons';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="container z-40 bg-background">
        <div className="flex h-20 items-center justify-between py-6">
          <Link href="/" className="flex items-center gap-2">
            <Logo className="h-8 w-8 text-primary" />
            <span className="font-bold font-headline">HYBRIDX.CLUB</span>
          </Link>
          <nav>
            <Button asChild variant="ghost">
              <Link href="/signup">Sign Up</Link>
            </Button>
          </nav>
        </div>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center p-4">
        <LoginForm />
      </main>
    </div>
  );
}
