// src/app/(app)/debug/page.tsx
'use client';

import { useState } from 'react';
import { getAuthInstance } from '@/lib/firebase';
import { getUserClient } from '@/services/user-service-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function DebugPage() {
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const runDebugChecks = async () => {
    setLoading(true);
    const results: any = {
      timestamp: new Date().toISOString(),
      checks: {}
    };

    try {
      // Check 1: Firebase Auth
      console.log('🔍 Checking Firebase Auth...');
      const auth = await getAuthInstance();
      const currentUser = auth.currentUser;
      
      results.checks.firebaseAuth = {
        isAuthenticated: !!currentUser,
        userId: currentUser?.uid,
        email: currentUser?.email
      };

      if (currentUser) {
        // Check 2: ID Token
        console.log('🎫 Getting ID token...');
        const idToken = await currentUser.getIdToken(true);
        results.checks.idToken = {
          length: idToken.length,
          firstChars: idToken.substring(0, 50) + '...'
        };

        // Check 3: User Data
        console.log('👤 Fetching user data...');
        const userData = await getUserClient(currentUser.uid);
        results.checks.userData = {
          hasUser: !!userData,
          hasStrava: !!userData?.strava,
          hasStravaToken: !!userData?.strava?.accessToken,
          stravaAthleteId: userData?.strava?.athleteId
        };

        // Check 4: Session Cookie
        console.log('🍪 Testing session cookie...');
        const sessionResponse = await fetch('/api/auth/session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({ idToken }),
          credentials: 'include'
        });

        results.checks.sessionCookie = {
          success: sessionResponse.ok,
          status: sessionResponse.status,
          statusText: sessionResponse.statusText
        };

        // Check 5: Activities API
        console.log('📊 Testing activities API...');
        const activitiesResponse = await fetch('/api/strava/activities', {
          method: 'GET',
          credentials: 'include'
        });

        const activitiesData = activitiesResponse.ok 
          ? await activitiesResponse.json() 
          : await activitiesResponse.text();

        results.checks.activitiesAPI = {
          success: activitiesResponse.ok,
          status: activitiesResponse.status,
          dataType: Array.isArray(activitiesData) ? 'array' : typeof activitiesData,
          dataLength: Array.isArray(activitiesData) ? activitiesData.length : 'N/A',
          errorData: !activitiesResponse.ok ? activitiesData : null
        };
      }

    } catch (error: any) {
      results.error = {
        message: error.message,
        stack: error.stack
      };
    }

    setDebugInfo(results);
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Debug Information</h1>
        <p className="text-muted-foreground">Diagnostic information for Strava integration</p>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Authentication & API Tests</CardTitle>
        </CardHeader>
        <CardContent>
          <Button onClick={runDebugChecks} disabled={loading}>
            {loading ? 'Running Tests...' : 'Run Debug Tests'}
          </Button>
          
          {debugInfo && (
            <div className="mt-4">
              <pre className="text-xs bg-muted p-4 rounded overflow-auto max-h-96">
                {JSON.stringify(debugInfo, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
