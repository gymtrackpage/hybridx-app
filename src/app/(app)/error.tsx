'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, RefreshCcw, Home, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    // Log the error to an error reporting service
    console.error('App error boundary caught:', error);
  }, [error]);

  const handleBack = () => {
    router.back();
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-4">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-destructive/10 p-3">
              <AlertTriangle className="h-10 w-10 text-destructive" />
            </div>
          </div>
          <CardTitle className="text-2xl">Oops! Something broke</CardTitle>
          <CardDescription>
            Don't worry, your workout data is safe. We encountered a temporary issue with this page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error.message && (
            <div className="bg-muted p-3 rounded-lg border">
              <p className="text-xs text-muted-foreground font-mono break-words">
                {error.message}
              </p>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <Button
              onClick={reset}
              className="w-full"
              variant="default"
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              Try Again
            </Button>

            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={handleBack}
                variant="outline"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Go Back
              </Button>
              <Link href="/dashboard">
                <Button variant="outline" className="w-full">
                  <Home className="mr-2 h-4 w-4" />
                  Dashboard
                </Button>
              </Link>
            </div>
          </div>

          {error.digest && (
            <p className="text-xs text-center text-muted-foreground pt-2 border-t">
              Error Reference: <code className="font-mono">{error.digest}</code>
            </p>
          )}

          <div className="text-xs text-center text-muted-foreground pt-2">
            <p>If this problem persists, please try:</p>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>Refreshing the page</li>
              <li>Clearing your browser cache</li>
              <li>Logging out and back in</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
