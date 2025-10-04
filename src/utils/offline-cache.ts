// src/utils/offline-cache.ts
'use client';

import { User, WorkoutSession, Program } from '@/models/types';

const CACHE_KEYS = {
  USER: 'cached_user',
  SESSIONS: 'cached_sessions',
  PROGRAM: 'cached_program',
  TODAYS_WORKOUT: 'cached_todays_workout',
  LAST_SYNC: 'last_sync_time',
};

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/**
 * Cache utilities for offline PWA support
 */
export const OfflineCache = {
  /**
   * Save user data to local cache
   */
  saveUser(user: User): void {
    try {
      const entry: CacheEntry<User> = {
        data: user,
        timestamp: Date.now(),
      };
      localStorage.setItem(CACHE_KEYS.USER, JSON.stringify(entry));
    } catch (error) {
      console.error('Error caching user:', error);
    }
  },

  /**
   * Get cached user data
   */
  getUser(): User | null {
    try {
      const cached = localStorage.getItem(CACHE_KEYS.USER);
      if (!cached) return null;

      const entry: CacheEntry<User> = JSON.parse(cached);

      // Check if cache is still valid
      if (Date.now() - entry.timestamp > CACHE_DURATION) {
        this.clearUser();
        return null;
      }

      return entry.data;
    } catch (error) {
      console.error('Error reading cached user:', error);
      return null;
    }
  },

  /**
   * Save workout sessions to cache
   */
  saveSessions(sessions: WorkoutSession[]): void {
    try {
      const entry: CacheEntry<WorkoutSession[]> = {
        data: sessions.map(s => ({
          ...s,
          workoutDate: s.workoutDate instanceof Date ? s.workoutDate.toISOString() : s.workoutDate,
          startedAt: s.startedAt instanceof Date ? s.startedAt.toISOString() : s.startedAt,
          finishedAt: s.finishedAt instanceof Date ? s.finishedAt.toISOString() : s.finishedAt,
        })) as any,
        timestamp: Date.now(),
      };
      localStorage.setItem(CACHE_KEYS.SESSIONS, JSON.stringify(entry));
    } catch (error) {
      console.error('Error caching sessions:', error);
    }
  },

  /**
   * Get cached workout sessions
   */
  getSessions(): WorkoutSession[] | null {
    try {
      const cached = localStorage.getItem(CACHE_KEYS.SESSIONS);
      if (!cached) return null;

      const entry: CacheEntry<any[]> = JSON.parse(cached);

      if (Date.now() - entry.timestamp > CACHE_DURATION) {
        this.clearSessions();
        return null;
      }

      // Convert date strings back to Date objects
      return entry.data.map(s => ({
        ...s,
        workoutDate: new Date(s.workoutDate),
        startedAt: new Date(s.startedAt),
        finishedAt: s.finishedAt ? new Date(s.finishedAt) : undefined,
      }));
    } catch (error) {
      console.error('Error reading cached sessions:', error);
      return null;
    }
  },

  /**
   * Save program data to cache
   */
  saveProgram(program: Program): void {
    try {
      const entry: CacheEntry<Program> = {
        data: program,
        timestamp: Date.now(),
      };
      localStorage.setItem(CACHE_KEYS.PROGRAM, JSON.stringify(entry));
    } catch (error) {
      console.error('Error caching program:', error);
    }
  },

  /**
   * Get cached program
   */
  getProgram(): Program | null {
    try {
      const cached = localStorage.getItem(CACHE_KEYS.PROGRAM);
      if (!cached) return null;

      const entry: CacheEntry<Program> = JSON.parse(cached);

      if (Date.now() - entry.timestamp > CACHE_DURATION) {
        this.clearProgram();
        return null;
      }

      return entry.data;
    } catch (error) {
      console.error('Error reading cached program:', error);
      return null;
    }
  },

  /**
   * Check if app is online
   */
  isOnline(): boolean {
    return typeof navigator !== 'undefined' && navigator.onLine;
  },

  /**
   * Update last sync timestamp
   */
  updateSyncTime(): void {
    localStorage.setItem(CACHE_KEYS.LAST_SYNC, Date.now().toString());
  },

  /**
   * Get time since last sync in minutes
   */
  getTimeSinceSync(): number | null {
    const lastSync = localStorage.getItem(CACHE_KEYS.LAST_SYNC);
    if (!lastSync) return null;

    const minutes = Math.floor((Date.now() - parseInt(lastSync, 10)) / (60 * 1000));
    return minutes;
  },

  /**
   * Clear all cached data
   */
  clearAll(): void {
    Object.values(CACHE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  },

  clearUser(): void {
    localStorage.removeItem(CACHE_KEYS.USER);
  },

  clearSessions(): void {
    localStorage.removeItem(CACHE_KEYS.SESSIONS);
  },

  clearProgram(): void {
    localStorage.removeItem(CACHE_KEYS.PROGRAM);
  },
};
