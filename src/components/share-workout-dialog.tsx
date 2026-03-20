'use client';
import { logger } from '@/lib/logger';

import { useState } from 'react';
import { Share2, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import type { WorkoutSession } from '@/models/types';
import { WorkoutImageGenerator } from '@/components/WorkoutImageGenerator';

interface ShareWorkoutDialogProps {
  session: WorkoutSession;
  trigger?: React.ReactNode;
}

export function ShareWorkoutDialog({ session, trigger }: ShareWorkoutDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopyText = () => {
    const text = `Just crushed a ${session.workoutTitle} workout! 💪\nDuration: ${session.duration || 0} minutes\n\nGet your personalized HYROX training at HYBRIDX.CLUB`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: 'Copied!',
      description: 'Text copied to clipboard',
    });
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'HYBRIDX Workout',
          text: `Just crushed a ${session.workoutTitle} workout! 💪`,
          url: 'https://hybridx.club',
        });
      } catch (error) {
        logger.error('Error sharing:', error);
      }
    } else {
      handleCopyText();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-16px)] max-w-md p-4">
        <DialogHeader className="px-0">
          <DialogTitle>Share Your Workout</DialogTitle>
          <DialogDescription>
            Download and share your achievement on social media
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Workout Image Generator — preview + download */}
          <WorkoutImageGenerator
            workout={{
              name: session.workoutTitle,
              type: session.programType === 'running' ? 'Running' : 'HYROX',
              startTime: session.workoutDate,
              distance: session.stravaActivity?.distance,
              duration: session.duration,
              notes: session.notes,
            }}
          />

          {/* Divider */}
          <div className="border-t border-border pt-3">
            <p className="text-xs text-muted-foreground mb-2">Or share via</p>
            <div className="flex gap-2">
              <Button onClick={handleShare} variant="outline" className="flex-1">
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
              <Button onClick={handleCopyText} variant="outline" className="flex-1">
                {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                {copied ? 'Copied!' : 'Copy Text'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
