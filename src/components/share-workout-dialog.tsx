'use client';
import { logger } from '@/lib/logger';

import { useState, useRef } from 'react';
import { Share2, Download, X, Copy, Check } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import type { WorkoutSession, Workout, RunningWorkout } from '@/models/types';
import { cn } from '@/lib/utils';

interface ShareWorkoutDialogProps {
  session: WorkoutSession;
  trigger?: React.ReactNode;
}

export function ShareWorkoutDialog({ session, trigger }: ShareWorkoutDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const shareCardRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const handleDownload = async () => {
    setIsGenerating(true);
    try {
      // Dynamically import html2canvas only when needed
      const html2canvas = (await import('html2canvas')).default;

      if (!shareCardRef.current) return;

      const canvas = await html2canvas(shareCardRef.current, {
        backgroundColor: '#000000',
        scale: 2, // Higher quality
        logging: false,
        useCORS: true,
      });

      // Convert to blob and download
      canvas.toBlob((blob) => {
        if (!blob) return;

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `hybridx-workout-${format(session.workoutDate, 'yyyy-MM-dd')}.png`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);

        toast({
          title: 'Image Downloaded!',
          description: 'Your workout image is ready to share.',
        });
      });
    } catch (error) {
      logger.error('Error generating image:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate image. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Share Your Workout</DialogTitle>
          <DialogDescription>
            Download and share your achievement on social media
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Preview Card */}
          <div
            ref={shareCardRef}
            className="relative w-full aspect-[1200/630] bg-gradient-to-br from-black via-gray-900 to-black rounded-lg overflow-hidden"
          >
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute inset-0" style={{
                backgroundImage: 'linear-gradient(45deg, #ffffff 25%, transparent 25%), linear-gradient(-45deg, #ffffff 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ffffff 75%), linear-gradient(-45deg, transparent 75%, #ffffff 75%)',
                backgroundSize: '20px 20px',
                backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
              }} />
            </div>

            {/* Content */}
            <div className="relative h-full p-12 flex flex-col justify-between">
              {/* Header with Logo */}
              <div className="flex items-start justify-between">
                <div>
                  <img
                    src="/full-logo.png"
                    alt="HYBRIDX"
                    className="h-12 mb-4"
                  />
                  <p className="text-white/60 text-sm font-medium tracking-wider">
                    {format(session.workoutDate, 'MMMM d, yyyy')}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge
                    variant="outline"
                    className="bg-white/10 text-white border-white/20 backdrop-blur-sm"
                  >
                    {session.programType === 'running' ? '🏃 Running' : '💪 HYROX'}
                  </Badge>
                  {session.duration && (
                    <Badge
                      variant="outline"
                      className="bg-white/10 text-white border-white/20 backdrop-blur-sm"
                    >
                      ⏱️ {session.duration} min
                    </Badge>
                  )}
                </div>
              </div>

              {/* Main Content */}
              <div className="flex-1 flex flex-col justify-center">
                <div className="space-y-6">
                  <div>
                    <h2 className="text-5xl font-bold text-white mb-2 leading-tight">
                      {session.workoutTitle}
                    </h2>
                    {session.finishedAt && !session.skipped && (
                        <div className="text-white/80">
                          <div className="text-lg font-semibold">WORKOUT COMPLETE</div>
                        </div>
                    )}
                  </div>

                  {/* Exercise Summary */}
                  {session.workoutDetails && (
                    <div className="flex flex-wrap gap-2 max-w-2xl">
                      {session.workoutDetails.programType === 'running'
                        ? (session.workoutDetails as RunningWorkout).runs.slice(0, 4).map((run, idx) => (
                            <div
                              key={idx}
                              className="px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-full text-white/90 text-sm border border-white/20"
                            >
                              {run.type} • {run.distance}km
                            </div>
                          ))
                        : (session.workoutDetails as Workout).exercises.slice(0, 4).map((ex, idx) => (
                            <div
                              key={idx}
                              className="px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-full text-white/90 text-sm border border-white/20"
                            >
                              {ex.name}
                            </div>
                          ))}
                      {((session.workoutDetails.programType === 'running'
                        ? (session.workoutDetails as RunningWorkout).runs.length
                        : (session.workoutDetails as Workout).exercises.length) > 4) && (
                        <div className="px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-full text-white/90 text-sm border border-white/20">
                          +{' '}
                          {(session.workoutDetails.programType === 'running'
                            ? (session.workoutDetails as RunningWorkout).runs.length
                            : (session.workoutDetails as Workout).exercises.length) - 4}{' '}
                          more
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-end justify-between">
                <div>
                 
                  <div className="text-white text-lg font-bold tracking-tight">
                    HYBRIDX.CLUB
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 bg-white/5 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/10">
                    <img
                      src="/icon-logo.png"
                      alt="HYBRIDX Icon"
                      className="w-12 h-12"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button onClick={handleDownload} disabled={isGenerating} className="flex-1">
              <Download className="h-4 w-4 mr-2" />
              {isGenerating ? 'Generating...' : 'Download Image'}
            </Button>
            <Button onClick={handleShare} variant="outline">
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
            <Button onClick={handleCopyText} variant="outline">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
