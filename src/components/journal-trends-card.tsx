'use client';

import { useState } from 'react';
import { Sparkles, Loader2, RefreshCw, ChevronDown, ChevronUp, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { journalTrends } from '@/ai/flows/journal-trends';
import type { JournalEntry } from '@/models/types';
import type { JournalTrendsOutput } from '@/ai/flows/journal-trends';

interface JournalTrendsCardProps {
  entries: JournalEntry[];   // All loaded journal entries
  userData: string;          // JSON string of user profile + recent sessions
}

function TrendsSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <div className="flex gap-2 pt-1">
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <Skeleton className="h-4 w-full mt-2" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  );
}

export function JournalTrendsCard({ entries, userData }: JournalTrendsCardProps) {
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<JournalTrendsOutput | null>(null);

  const handleAnalyse = async () => {
    setIsLoading(true);
    setIsExpanded(true);
    try {
      // Build a lightweight version of entries for the AI (avoid huge payloads)
      const entrySummaries = entries.slice(0, 15).map(e => ({
        date: format(e.date, 'yyyy-MM-dd'),
        content: e.content,
        mood: e.mood,
        tags: e.tags,
      }));

      // Parse userData to extract sessions and user name
      let userName = 'Athlete';
      let recentSessions: object[] = [];
      let stravaContext: string | undefined;
      try {
        const parsed = JSON.parse(userData);
        userName = parsed.user?.firstName || 'Athlete';
        recentSessions = (parsed.allSessions || []).slice(0, 20).map((s: any) => ({
          date: s.workoutDate,
          title: s.workoutTitle,
          notes: s.notes,
          skipped: s.skipped,
          duration: s.duration,
        }));
        stravaContext = parsed.stravaTrainingSummary;
      } catch {
        // Non-fatal
      }

      const result = await journalTrends({
        entries: JSON.stringify(entrySummaries),
        recentSessions: JSON.stringify(recentSessions),
        stravaContext,
        userName,
      });
      setResults(result);
    } catch (err) {
      console.error('Error generating journal trends:', err);
      toast({
        title: 'Error',
        description: 'Failed to generate journal intelligence. Please try again.',
        variant: 'destructive',
      });
      setIsExpanded(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">Journal Intelligence</span>
            <span className="text-xs text-muted-foreground">
              — patterns across your last {Math.min(entries.length, 15)} entries
            </span>
          </div>
          <div className="flex items-center gap-1">
            {results && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-primary"
                onClick={handleAnalyse}
                disabled={isLoading}
                aria-label="Refresh analysis"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground"
              onClick={() => setIsExpanded(v => !v)}
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {!isExpanded && !results && (
        <CardContent className="pt-0">
          <Button
            className="w-full gap-2"
            onClick={handleAnalyse}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Analyse My Journal
          </Button>
        </CardContent>
      )}

      {isExpanded && (
        <CardContent className="pt-0 space-y-4">
          {isLoading ? (
            <TrendsSkeleton />
          ) : results ? (
            <>
              {/* Period summary */}
              <p className="text-sm text-foreground/90 leading-relaxed">
                {results.periodSummary}
              </p>

              <Separator />

              {/* Mood pattern */}
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Mood Pattern
                </p>
                <p className="text-sm text-foreground/90 leading-relaxed">
                  {results.moodPattern}
                </p>
              </div>

              {/* Key themes */}
              {results.keyThemes.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Recurring Themes
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {results.keyThemes.map((theme, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {theme}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <Separator />

              {/* Coaching advice */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                    Coach's Pattern Analysis
                  </p>
                </div>
                <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                  {results.coachingAdvice}
                </p>
              </div>
            </>
          ) : (
            <Button
              className="w-full gap-2"
              onClick={handleAnalyse}
              disabled={isLoading}
            >
              <Sparkles className="h-4 w-4" />
              Analyse My Journal
            </Button>
          )}
        </CardContent>
      )}
    </Card>
  );
}
