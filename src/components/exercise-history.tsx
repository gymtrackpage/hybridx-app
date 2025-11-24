// src/components/exercise-history.tsx
'use client';
import { logger } from '@/lib/logger';

import { useState, useEffect } from 'react';
import { getLastPerformedExercise } from '@/lib/workout-utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock } from 'lucide-react';

interface ExerciseHistoryProps {
    userId: string;
    exerciseName: string;
}

export function ExerciseHistory({ userId, exerciseName }: ExerciseHistoryProps) {
    const [lastPerformed, setLastPerformed] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        const fetchHistory = async () => {
            if (!exerciseName) return;
            
            try {
                const result = await getLastPerformedExercise(userId, exerciseName);
                if (isMounted) {
                    setLastPerformed(result);
                }
            } catch (error) {
                logger.error("Error fetching exercise history:", error);
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        fetchHistory();

        return () => {
            isMounted = false;
        };
    }, [userId, exerciseName]);

    if (loading) {
        return <Skeleton className="h-4 w-32 mt-1" />;
    }

    if (!lastPerformed) {
        return null;
    }

    return (
        <div className="flex items-start gap-1.5 mt-1.5 text-xs text-muted-foreground/80 bg-muted/30 p-1.5 rounded-md inline-flex">
            <Clock className="h-3.5 w-3.5 mt-0.5" />
            <span>Last time: {lastPerformed}</span>
        </div>
    );
}
