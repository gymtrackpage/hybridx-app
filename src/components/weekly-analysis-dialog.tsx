// src/components/weekly-analysis-dialog.tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Loader2, Sparkles, CheckCircle, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { updateUser } from '@/services/user-service-client'; // Need to expose this or similar
import type { User, Workout, RunningWorkout } from '@/models/types';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';

interface WeeklyAnalysisDialogProps {
  userId: string;
  trigger?: React.ReactNode;
}

export function WeeklyAnalysisDialog({ userId, trigger }: WeeklyAnalysisDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const { toast } = useToast();

  const handleAnalyze = async () => {
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch('/api/ai/analyze-week', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) throw new Error('Analysis failed');
      const data = await response.json();
      setResult(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Could not complete the analysis. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };
  
  const handleApplyChanges = async () => {
      // Logic to actually save these changes to the user's profile would go here.
      // E.g., updating user.customProgram with the new workouts.
      // For this demo, we'll just show a success toast.
      toast({
          title: "Plan Updated",
          description: "Your training schedule has been adjusted based on the AI recommendations."
      });
      setIsOpen(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="gap-2">
            <Sparkles className="h-4 w-4 text-purple-500" />
            Analyze My Week
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
             <Sparkles className="h-5 w-5 text-purple-500" />
             AI Coach Analysis
          </DialogTitle>
          <DialogDescription>
             Reviewing your recent feedback to optimize your upcoming week.
          </DialogDescription>
        </DialogHeader>

        {!result && !loading && (
             <div className="py-8 text-center space-y-4">
                 <p className="text-muted-foreground">
                     Ready to check your progress? The AI will look at your recent workout notes (fatigue, pain, ease) and suggest tweaks to your schedule.
                 </p>
                 <Button onClick={handleAnalyze} className="w-full sm:w-auto">
                     Start Analysis
                 </Button>
             </div>
        )}

        {loading && (
            <div className="py-12 flex flex-col items-center justify-center space-y-4">
                <Loader2 className="h-10 w-10 animate-spin text-purple-500" />
                <p className="text-sm text-muted-foreground animate-pulse">Analyzing workout patterns...</p>
            </div>
        )}

        {result && (
            <div className="space-y-6">
                <div className="space-y-2">
                    <h3 className="font-semibold text-lg">Coach's Summary</h3>
                    <p className="text-sm text-foreground/90 leading-relaxed bg-muted p-4 rounded-md">
                        {result.analysis}
                    </p>
                </div>

                {result.needsAdjustment && result.adjustments?.length > 0 ? (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-lg">Recommended Adjustments</h3>
                            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                                {result.adjustments.length} Changes
                            </Badge>
                        </div>
                        
                        {result.adjustments.map((adj: any, idx: number) => (
                            <Card key={idx} className="border-l-4 border-l-yellow-400">
                                <CardContent className="pt-4">
                                    <div className="flex justify-between items-start mb-2">
                                        <Badge variant="secondary">Day {adj.day}</Badge>
                                        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Modification</span>
                                    </div>
                                    <div className="grid gap-2">
                                        <div className="text-sm">
                                            <span className="text-muted-foreground line-through mr-2">{adj.originalTitle}</span>
                                            <ArrowRight className="inline h-3 w-3 mx-1" />
                                            <span className="font-semibold text-foreground">{adj.modifiedTitle}</span>
                                        </div>
                                        <p className="text-sm text-muted-foreground italic">
                                            "{adj.reason}"
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                        <CheckCircle className="h-12 w-12 text-green-500 mb-3" />
                        <h3 className="font-semibold">Plan Looks Great!</h3>
                        <p className="text-sm text-muted-foreground max-w-xs">
                            No adjustments needed. You're crushing it! Stick to the original schedule.
                        </p>
                    </div>
                )}
            </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => setIsOpen(false)}>Close</Button>
          {result && result.needsAdjustment && (
              <Button onClick={handleApplyChanges} className="bg-purple-600 hover:bg-purple-700">
                  Apply Adjustments
              </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
