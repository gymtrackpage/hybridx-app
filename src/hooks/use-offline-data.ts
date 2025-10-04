// src/hooks/use-offline-data.ts
'use client';

import { useState, useEffect } from 'react';
import { OfflineCache } from '@/utils/offline-cache';

export function useOfflineData<T>(
  fetchFunction: () => Promise<T>,
  cacheKey: 'user' | 'sessions' | 'program',
  dependencies: any[] = []
): { data: T | null; loading: boolean; error: Error | null; isOffline: boolean } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isOffline, setIsOffline] = useState(!OfflineCache.isOnline());

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      setLoading(true);
      setError(null);

      // Try to load cached data first (instant UX)
      let cachedData: T | null = null;
      switch (cacheKey) {
        case 'user':
          cachedData = OfflineCache.getUser() as T;
          break;
        case 'sessions':
          cachedData = OfflineCache.getSessions() as T;
          break;
        case 'program':
          cachedData = OfflineCache.getProgram() as T;
          break;
      }

      if (cachedData && isMounted) {
        setData(cachedData);
        setLoading(false);
      }

      // If online, fetch fresh data
      if (OfflineCache.isOnline()) {
        try {
          const freshData = await fetchFunction();

          if (isMounted) {
            setData(freshData);

            // Update cache with fresh data
            switch (cacheKey) {
              case 'user':
                OfflineCache.saveUser(freshData as any);
                break;
              case 'sessions':
                OfflineCache.saveSessions(freshData as any);
                break;
              case 'program':
                OfflineCache.saveProgram(freshData as any);
                break;
            }

            OfflineCache.updateSyncTime();
          }
        } catch (err) {
          if (isMounted) {
            setError(err as Error);
            // Keep cached data on error if available
            if (!cachedData) {
              setLoading(false);
            }
          }
        }
      }

      if (isMounted) {
        setLoading(false);
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, dependencies);

  return { data, loading, error, isOffline };
}
