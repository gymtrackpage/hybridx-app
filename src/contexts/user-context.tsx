// src/contexts/user-context.tsx
'use client';

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { getAuthInstance } from '@/lib/firebase';
import { getUserClient } from '@/services/user-service-client';
import { getProgramClient } from '@/services/program-service-client';
import { getTodaysOneOffSession, getTodaysProgramSession, getOrCreateWorkoutSession, getAllUserSessions, type WorkoutSession } from '@/services/session-service-client';
import { getWorkoutForDay } from '@/lib/workout-utils';
import type { User, Program, Workout, RunningWorkout } from '@/models/types';
import { calculateTrainingPaces } from '@/lib/pace-utils';
import { calculateStreakData, type StreakData } from '@/utils/streak-calculator';
import { OfflineCache } from '@/utils/offline-cache';
import { logger } from '@/lib/logger';

interface UserContextType {
    user: User | null;
    program: Program | null;
    todaysWorkout: { day: number; workout: Workout | RunningWorkout | null } | null;
    todaysSession: WorkoutSession | null;
    allSessions: WorkoutSession[];
    streakData: StreakData;
    trainingPaces: Record<string, number> | null;
    loading: boolean;
    refreshData: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [program, setProgram] = useState<Program | null>(null);
    const [todaysWorkout, setTodaysWorkout] = useState<{ day: number; workout: Workout | RunningWorkout | null } | null>(null);
    const [todaysSession, setTodaysSession] = useState<WorkoutSession | null>(null);
    const [allSessions, setAllSessions] = useState<WorkoutSession[]>([]);
    const [streakData, setStreakData] = useState<StreakData>({ currentStreak: 0, longestStreak: 0, totalWorkouts: 0, thisWeekWorkouts: 0, thisMonthWorkouts: 0 });
    const [trainingPaces, setTrainingPaces] = useState<Record<string, number> | null>(null);
    const [loading, setLoading] = useState(true);

    const refreshData = async () => {
        const auth = await getAuthInstance();
        if (!auth.currentUser) return;

        setLoading(true);

        // Try to load cached data first for offline-first experience
        const cachedWorkout = OfflineCache.getTodaysWorkout();
        const cachedSession = OfflineCache.getTodaysSession();

        if (cachedWorkout) {
            setTodaysWorkout(cachedWorkout);
        }
        if (cachedSession) {
            setTodaysSession(cachedSession);
        }

        try {
            const userId = auth.currentUser.uid;
            const currentUser = await getUserClient(userId);
            setUser(currentUser);

            if (!currentUser) return;

            if (currentUser.runningProfile) {
                const paces = calculateTrainingPaces(currentUser);
                setTrainingPaces(paces);
            }

            const sessions = await getAllUserSessions(userId);
            setAllSessions(sessions);
            const streak = calculateStreakData(sessions);
            setStreakData(streak);

            // Update sync time
            OfflineCache.updateSyncTime();

            let workoutSession;
            let currentWorkoutInfo;
            let currentProgram: Program | null = null;
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Priority 1: Check for a one-off or custom workout for today
            const oneOffSession = await getTodaysOneOffSession(userId, today);

            if (oneOffSession) {
                workoutSession = oneOffSession;
                currentWorkoutInfo = {
                    day: 0,
                    workout: oneOffSession.workoutDetails as Workout,
                };
            } else if (currentUser.programId && currentUser.startDate) {
                if (currentUser.customProgram) {
                    currentProgram = { id: currentUser.programId, workouts: currentUser.customProgram } as Program;
                } else {
                    currentProgram = await getProgramClient(currentUser.programId);
                }
                setProgram(currentProgram);

                // Priority 2: Check for an existing program session (which could be swapped)
                const programSession = await getTodaysProgramSession(userId, today);

                if (programSession && programSession.workoutDetails) {
                    workoutSession = programSession;
                    // Use the details from the session itself, which will reflect any swaps
                    currentWorkoutInfo = {
                        day: getWorkoutForDay(currentProgram!, currentUser.startDate, today).day,
                        workout: programSession.workoutDetails,
                    };
                } else if (currentProgram) {
                    // Priority 3: No session exists, so create one based on the original program schedule
                    const scheduledWorkoutInfo = getWorkoutForDay(currentProgram, currentUser.startDate, today);
                    if (scheduledWorkoutInfo.workout) {
                        // Create the session so Workout page has it immediately
                        workoutSession = await getOrCreateWorkoutSession(userId, currentProgram.id, today, scheduledWorkoutInfo.workout);
                        currentWorkoutInfo = scheduledWorkoutInfo;
                    }
                }
            }

            if (currentWorkoutInfo) {
                setTodaysWorkout(currentWorkoutInfo);
                // Cache today's workout for offline access
                OfflineCache.saveTodaysWorkout(currentWorkoutInfo);
            } else {
                setTodaysWorkout(null);
            }
            if (workoutSession) {
                setTodaysSession(workoutSession);
                // Cache today's session for offline access
                OfflineCache.saveTodaysSession(workoutSession);
            } else {
                setTodaysSession(null);
            }

        } catch (error) {
            logger.error("Error fetching user data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const initialize = async () => {
            const auth = await getAuthInstance();
            const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
                if (firebaseUser) {
                    refreshData();
                } else {
                    setUser(null);
                    setProgram(null);
                    setTodaysWorkout(null);
                    setTodaysSession(null);
                    setAllSessions([]);
                    setStreakData({ currentStreak: 0, longestStreak: 0, totalWorkouts: 0, thisWeekWorkouts: 0, thisMonthWorkouts: 0 });
                    setTrainingPaces(null);
                    setLoading(false);
                }
            });
            return unsubscribe;
        };

        let unsubscribe: () => void;
        initialize().then(unsub => unsubscribe = unsub);

        return () => {
            if (unsubscribe) {
                unsubscribe();
            }
        };
    }, []);

    const value = useMemo(() => ({
        user,
        program,
        todaysWorkout,
        todaysSession,
        allSessions,
        streakData,
        trainingPaces,
        loading,
        refreshData
    }), [user, program, todaysWorkout, todaysSession, allSessions, streakData, trainingPaces, loading]);

    return (
        <UserContext.Provider value={value}>
            {children}
        </UserContext.Provider>
    );
}

export function useUser() {
    const context = useContext(UserContext);
    if (context === undefined) {
        throw new Error('useUser must be used within a UserProvider');
    }
    return context;
}

// === PERFORMANCE OPTIMIZED SELECTOR HOOKS ===
// Use these hooks to subscribe to specific parts of the context
// This prevents unnecessary re-renders when unrelated state changes

/**
 * Subscribe to user profile only
 * Re-renders only when user or trainingPaces change
 */
export function useUserProfile() {
    const context = useContext(UserContext);
    if (context === undefined) {
        throw new Error('useUserProfile must be used within a UserProvider');
    }
    return useMemo(() => ({
        user: context.user,
        trainingPaces: context.trainingPaces,
        loading: context.loading,
        refreshData: context.refreshData
    }), [context.user, context.trainingPaces, context.loading, context.refreshData]);
}

/**
 * Subscribe to today's workout only
 * Re-renders only when todaysWorkout, todaysSession, or program change
 */
export function useTodaysWorkout() {
    const context = useContext(UserContext);
    if (context === undefined) {
        throw new Error('useTodaysWorkout must be used within a UserProvider');
    }
    return useMemo(() => ({
        program: context.program,
        todaysWorkout: context.todaysWorkout,
        todaysSession: context.todaysSession,
        loading: context.loading,
        refreshData: context.refreshData
    }), [context.program, context.todaysWorkout, context.todaysSession, context.loading, context.refreshData]);
}

/**
 * Subscribe to sessions and streaks only
 * Re-renders only when allSessions or streakData change
 */
export function useSessions() {
    const context = useContext(UserContext);
    if (context === undefined) {
        throw new Error('useSessions must be used within a UserProvider');
    }
    return useMemo(() => ({
        allSessions: context.allSessions,
        streakData: context.streakData,
        loading: context.loading,
        refreshData: context.refreshData
    }), [context.allSessions, context.streakData, context.loading, context.refreshData]);
}

/**
 * Subscribe to user and today's workout (common combination)
 * Re-renders only when user, program, todaysWorkout, or todaysSession change
 */
export function useUserAndWorkout() {
    const context = useContext(UserContext);
    if (context === undefined) {
        throw new Error('useUserAndWorkout must be used within a UserProvider');
    }
    return useMemo(() => ({
        user: context.user,
        program: context.program,
        todaysWorkout: context.todaysWorkout,
        todaysSession: context.todaysSession,
        trainingPaces: context.trainingPaces,
        loading: context.loading,
        refreshData: context.refreshData
    }), [context.user, context.program, context.todaysWorkout, context.todaysSession, context.trainingPaces, context.loading, context.refreshData]);
}
