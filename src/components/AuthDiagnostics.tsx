'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getAuthInstance } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

// Function to get a specific cookie by name
const getCookie = (name: string): string | undefined => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
};


export function AuthDiagnostics() {
  const [diagnosis, setDiagnosis] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const runDiagnosis = async () => {
    setLoading(true);
    try {
        const auth = await getAuthInstance();
        const sessionCookie = getCookie('__session');

        const result = {
            timestamp: new Date().toISOString(),
            authInstance: {
                appName: auth.app.name,
                currentUser: auth.currentUser ? {
                    uid: auth.currentUser.uid,
                    email: auth.currentUser.email,
                    emailVerified: auth.currentUser.emailVerified,
                } : null,
            },
            cookies: {
                sessionCookieExists: !!sessionCookie,
                sessionCookieLength: sessionCookie?.length || 0,
                allCookies: document.cookie,
            },
        };
      
      setDiagnosis(result);
      console.log('🔍 Auth Diagnosis:', result);
    } catch (error) {
      console.error('Diagnosis failed:', error);
      setDiagnosis({ error: (error as Error).message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Run diagnosis on component mount
    runDiagnosis();

    // Set up a listener for auth state changes
    const setupListener = async () => {
        const auth = await getAuthInstance();
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            console.log('🔄 Auth state changed, re-running diagnosis...');
            runDiagnosis();
        });
        return unsubscribe;
    };
    
    let unsubscribe: () => void;
    setupListener().then(unsub => unsubscribe = unsub);

    return () => {
        if (unsubscribe) {
            unsubscribe();
        }
    };
  }, []);

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Firebase Auth Diagnostics</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button onClick={runDiagnosis} disabled={loading} size="sm">
              {loading ? 'Diagnosing...' : 'Re-run Diagnosis'}
            </Button>
          </div>
          
          {diagnosis && (
            <pre className="bg-muted p-4 rounded text-sm overflow-auto max-h-64">
              {JSON.stringify(diagnosis, null, 2)}
            </pre>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
