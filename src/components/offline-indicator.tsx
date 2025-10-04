// src/components/offline-indicator.tsx
'use client';

import { useEffect, useState } from 'react';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { OfflineCache } from '@/utils/offline-cache';

export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(false);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const updateOnlineStatus = () => {
      const offline = !navigator.onLine;
      setIsOffline(offline);
      setShowBanner(offline);

      if (!offline) {
        // Hide banner after coming back online
        setTimeout(() => setShowBanner(false), 3000);
      }
    };

    const updateSyncTime = () => {
      setLastSync(OfflineCache.getTimeSinceSync());
    };

    updateOnlineStatus();
    updateSyncTime();

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    const syncInterval = setInterval(updateSyncTime, 60000); // Update every minute

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
      clearInterval(syncInterval);
    };
  }, []);

  const handleReload = () => {
    window.location.reload();
  };

  if (!showBanner && !isOffline) return null;

  return (
    <div
      className={cn(
        'fixed top-0 left-0 right-0 z-[100] transition-transform duration-300',
        showBanner ? 'translate-y-0' : '-translate-y-full'
      )}
    >
      <Alert variant={isOffline ? 'destructive' : 'default'} className="rounded-none border-x-0 border-t-0">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            {isOffline ? (
              <WifiOff className="h-4 w-4" />
            ) : (
              <Wifi className="h-4 w-4 text-green-600" />
            )}
            <AlertDescription className="text-sm">
              {isOffline ? (
                <>
                  You're offline. Showing cached data
                  {lastSync !== null && ` from ${lastSync} minutes ago`}.
                </>
              ) : (
                'Back online! Your data is syncing...'
              )}
            </AlertDescription>
          </div>
          {isOffline && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReload}
              className="h-8 gap-2"
            >
              <RefreshCw className="h-3 w-3" />
              <span className="hidden sm:inline">Retry</span>
            </Button>
          )}
        </div>
      </Alert>
    </div>
  );
}
