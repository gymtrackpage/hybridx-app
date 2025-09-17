'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';

export default function FirestoreIndexesPage() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const { toast } = useToast();

  const runIndexTests = async () => {
    setLoading(true);
    try {
      console.log('🔄 Running Firestore index tests...');

      const response = await fetch('/api/debug/firestore-indexes', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to run index tests');
      }

      const data = await response.json();
      setResults(data);
      console.log('📋 Index test results:', data);

      toast({
        title: 'Index Tests Complete',
        description: `${data.summary?.passedTests || 0} passed, ${data.summary?.failedTests || 0} failed`,
        variant: data.summary?.failedTests > 0 ? 'destructive' : 'default',
      });

    } catch (error) {
      console.error('❌ Error running index tests:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to run tests',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'error':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Firestore Index Checker</h1>
        <p className="text-muted-foreground">
          Diagnose indexing issues with your Firestore users collection
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Run Index Tests</CardTitle>
          <CardDescription>
            Test various query patterns to identify indexing issues
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={runIndexTests} disabled={loading}>
            {loading ? 'Running Tests...' : 'Run Index Tests'}
          </Button>
        </CardContent>
      </Card>

      {results && (
        <>
          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Test Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {results.summary?.passedTests || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">Passed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {results.summary?.failedTests || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">Failed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {results.summary?.totalTests || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">Total</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recommendations */}
          {results.recommendations && results.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {results.recommendations.map((rec: any, index: number) => (
                  <Alert key={index}>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      <div className="font-medium">{rec.message}</div>
                      <div className="text-sm mt-1">{rec.action}</div>
                    </AlertDescription>
                  </Alert>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Test Results */}
          <Card>
            <CardHeader>
              <CardTitle>Detailed Test Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {results.tests.map((test: any, index: number) => (
                  <div key={index} className="flex items-start gap-3 p-3 border rounded-lg">
                    {getStatusIcon(test.status)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{test.test}</span>
                        <Badge variant="outline" className={getStatusColor(test.status)}>
                          {test.status}
                        </Badge>
                      </div>
                      {test.message && (
                        <p className="text-sm text-muted-foreground">{test.message}</p>
                      )}
                      {test.error && (
                        <p className="text-sm text-red-600 mt-1">Error: {test.error}</p>
                      )}
                      {test.documentCount !== undefined && (
                        <p className="text-sm text-muted-foreground">
                          Documents found: {test.documentCount}
                        </p>
                      )}
                      {test.indexRequired && (
                        <p className="text-sm text-yellow-600 mt-1">
                          ⚠️ This query requires a Firestore index
                        </p>
                      )}
                      {test.sampleData && (
                        <details className="mt-2">
                          <summary className="text-sm cursor-pointer text-blue-600">
                            View sample data
                          </summary>
                          <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto">
                            {JSON.stringify(test.sampleData, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* How to Fix */}
          <Card>
            <CardHeader>
              <CardTitle>How to Create Missing Indexes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Method 1: Firebase Console (Recommended)</h4>
                  <ol className="list-decimal list-inside space-y-1 text-sm">
                    <li>Go to <a href="https://console.firebase.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Firebase Console</a></li>
                    <li>Select your project</li>
                    <li>Navigate to Firestore Database → Indexes</li>
                    <li>Click "Create Index"</li>
                    <li>Set Collection ID to "users"</li>
                    <li>Add field "email" with order "Ascending"</li>
                    <li>Click "Create"</li>
                  </ol>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Method 2: Automatic Index Creation</h4>
                  <p className="text-sm text-muted-foreground">
                    Try running the failing query in your app. Firestore will provide a link to automatically create the required index.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}