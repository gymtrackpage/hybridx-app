// src/components/workout-complete-modal.tsx
'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { StravaUploadButton } from '@/components/strava-upload-button';
import { WorkoutImageGenerator } from '@/components/WorkoutImageGenerator';
import type { WorkoutSession, Workout, RunningWorkout } from '@/models/types';

interface WorkoutCompleteModalProps {
    isOpen: boolean;
    onClose: () => void;
    session: WorkoutSession;
    userHasStrava?: boolean;
    workout: Workout | RunningWorkout;
}

export default function WorkoutCompleteModal({ isOpen, onClose, session, userHasStrava, workout }: WorkoutCompleteModalProps) {
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Workout Complete! 🎉</DialogTitle>
                    <DialogDescription>
                        Great job finishing your workout. Here's your summary.
                    </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                        <h3 className="font-semibold text-lg">{session.workoutTitle}</h3>
                        <p className="text-sm text-muted-foreground">Workout logged successfully.</p>
                    </div>

                    <div className="space-y-3">
                         <Separator />
                         <p className="text-sm font-medium text-center">
                            Share your achievement
                         </p>
                        
                        {userHasStrava && (
                            <StravaUploadButton
                                sessionId={session.id}
                                activityName={session.workoutTitle}
                                isUploaded={session.uploadedToStrava}
                                stravaId={session.stravaId}
                            />
                        )}
                        <WorkoutImageGenerator 
                             workout={{
                                name: session.workoutTitle,
                                type: workout.programType,
                                startTime: session.startedAt,
                                notes: session.notes,
                            }}
                        />
                    </div>

                    <Button onClick={onClose} className="w-full" variant="outline">
                        Close
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
