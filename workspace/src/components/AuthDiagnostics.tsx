'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { diagnoseAuth, getAuthInstance } from '@/lib/firebase';

export function AuthDiagnostics() {
  const [diagnosis, setDiagnosis] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const runDiagnosis = async () => {
    setLoading(true);
    try {
      const result = await diagnoseAuth();
      setDiagnosis(result);
      console.log('🔍 Auth Diagnosis:', result);
    } catch (error) {
      console.error('Diagnosis failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const testAuth = async () => {
    try {
      const auth = await getAuthInstance();
      console.log('🔐 Auth instance:', {
        currentUser: !!auth.currentUser,
        uid: auth.currentUser?.uid,
        email: auth.currentUser?.email
      });
    } catch (error) {
      console.error('Auth test failed:', error);
    }
  };

  useEffect(() => {
    runDiagnosis();
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
              Run Diagnosis
            </Button>
            <Button onClick={testAuth} variant="outline" size="sm">
              Test Auth
            </Button>
          </div>
          
          {diagnosis && (
            <pre className="bg-muted p-4 rounded text-sm overflow-auto">
              {JSON.stringify(diagnosis, null, 2)}
            </pre>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
