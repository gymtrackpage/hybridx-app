'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getAuthInstance } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';

export default function SessionHelperPage() {
  const [loading, setLoading] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<any>(null);
  const [adminStatus, setAdminStatus] = useState<any>(null);
  const { toast } = useToast();

  const createSessionCookie = async () => {
    setLoading(true);
    try {
      console.log('🔄 Creating session cookie and checking admin status...');

      // Get current user's ID token
      const auth = await getAuthInstance();
      if (!auth.currentUser) {
        throw new Error('You must be logged in to create a session cookie');
      }

      const idToken = await auth.currentUser.getIdToken(true);
      console.log('✅ Got ID token');

      // Create session cookie and check admin status in one call
      const response = await fetch('/api/debug/create-session-and-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create session');
      }

      const data = await response.json();
      setSessionStatus(data);
      setAdminStatus(data); // This endpoint returns both session and admin info
      console.log('✅ Session cookie created and admin status checked:', data);

      toast({
        title: 'Success',
        description: `Session created! Admin status: ${data.isAdmin ? 'Yes' : 'No'}`,
        variant: data.isAdmin ? 'default' : 'destructive',
      });

    } catch (error) {
      console.error('❌ Error creating session:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create session',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const checkAdminStatus = async () => {
    try {
      console.log('🔄 Checking admin status...');
      const response = await fetch('/api/debug/admin-status', {
        credentials: 'include',
      });

      const data = await response.json();
      setAdminStatus(data);
      console.log('📋 Admin status:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Failed to check admin status');
      }

      toast({
        title: 'Admin Status',
        description: data.isAdmin ? 'You are an admin!' : 'You are not an admin',
        variant: data.isAdmin ? 'default' : 'destructive',
      });

    } catch (error) {
      console.error('❌ Error checking admin status:', error);
      setAdminStatus({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  };

  const makeUserAdmin = async () => {
    if (!adminStatus?.userId) {
      toast({
        title: 'Error',
        description: 'No user ID found. Please check admin status first.',
        variant: 'destructive',
      });
      return;
    }

    try {
      console.log('🔄 Setting admin permissions...');
      const response = await fetch('/api/debug/set-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: adminStatus.userId,
          makeAdmin: true
        }),
        credentials: 'include',
      });

      const data = await response.json();
      console.log('📋 Set admin result:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Failed to set admin');
      }

      toast({
        title: 'Success',
        description: 'Admin permissions granted!',
      });

      // Refresh admin status
      await checkAdminStatus();

    } catch (error) {
      console.error('❌ Error setting admin:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to set admin',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Session & Admin Helper</h1>
        <p className="text-muted-foreground">Debug tool to create session cookies and check admin permissions</p>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Step 1: Create Session Cookie & Check Admin</CardTitle>
            <CardDescription>
              Create a server-side session cookie and check your admin status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={createSessionCookie} disabled={loading}>
              {loading ? 'Creating & Checking...' : 'Create Session & Check Admin'}
            </Button>
            {sessionStatus && (
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <Badge variant="outline" className="mb-2">Session Created</Badge>
                <pre className="text-sm">{JSON.stringify(sessionStatus, null, 2)}</pre>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Step 2: Check Admin Status</CardTitle>
            <CardDescription>
              Verify your current admin permissions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={checkAdminStatus} variant="outline">
              Check Admin Status
            </Button>
            {adminStatus && (
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <Badge
                  variant="outline"
                  className={adminStatus.isAdmin ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}
                >
                  {adminStatus.isAdmin ? 'Admin' : 'Not Admin'}
                </Badge>
                <pre className="text-sm mt-2">{JSON.stringify(adminStatus, null, 2)}</pre>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Step 3: Grant Admin Permissions</CardTitle>
            <CardDescription>
              Make yourself an admin (only if needed)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={makeUserAdmin}
              variant="destructive"
              disabled={!adminStatus?.userId || adminStatus?.isAdmin}
            >
              {adminStatus?.isAdmin ? 'Already Admin' : 'Make Me Admin'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Step 4: Test Admin Users Page</CardTitle>
            <CardDescription>
              Once you're an admin, test the users management page
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild disabled={!adminStatus?.isAdmin}>
              <a href="/admin/users">Go to Admin Users Page</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}