'use client';
// src/app/(app)/training/page.tsx
// Full-page training load report. Plain-language translation of ATL/CTL/TSB metrics
// with an on-demand AI coaching analysis section.

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Activity,
  Brain,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle2,
  Footprints,
  Bike,
  Waves,
  Dumbbell,
  PersonStanding,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  ChartContainer,
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  ChartTooltip,
  ChartTooltipContent,
  CartesianGrid,
} from '@/components/ui/chart';
import { cn } from '@/lib/utils';
import { getAuthInstance } from '@/lib/firebase';
import { analyzeTrainingLoad } from '@/ai/flows/training-load-analysis';
import type { TrainingLoadAnalysisOutput } from '@/ai/flows/training-load-analysis';
import type { TrainingSummary, ActivityCategory } from '@/services/training-load-service';
import { formatTrainingSummaryForAI } from '@/services/training-load-service';
import { useUser } from '@/contexts/user-context';

// ─── Constants (mirror training-load-card.tsx) ────────────────────────────────

const CATEGORY_COLORS: Record<ActivityCategory, string> = {
  run:      'hsl(var(--primary))',
  ride:     'hsl(220 70% 55%)',
  swim:     'hsl(200 80% 50%)',
  strength: 'hsl(280 60% 55%)',
  walk:     'hsl(150 60% 45%)',
  rowing:   'hsl(30 80% 55%)',
  other:    'hsl(var(--muted-foreground))',
};

const CATEGORY_LABELS: Record<ActivityCategory, string> = {
  run:      'Running',
  ride:     'Cycling',
  swim:     'Swimming',
  strength: 'Strength',
  walk:     'Walking / Hiking',
  rowing:   'Rowing',
  other:    'Other',
};

// ─── Plain-language status copy ───────────────────────────────────────────────

const STATUS_COPY: Record<string, { sentence: string; color: string }> = {
  very_fresh:   { sentence: "You're well-rested. A great time to push hard or start a new training block.", color: 'bg-blue-100 text-blue-800 border-blue-200' },
  fresh:        { sentence: "Your body has recovered well. You're ready for quality training.", color: 'bg-green-100 text-green-800 border-green-200' },
  optimal:      { sentence: "You're in the sweet spot — fit enough to train hard, not worn down.", color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  building:     { sentence: "You're working hard and accumulating fitness. Keep recovery sessions easy.", color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  fatigued:     { sentence: "Your body is carrying real fatigue. Prioritise sleep and easy sessions.", color: 'bg-orange-100 text-orange-800 border-orange-200' },
  overreaching: { sentence: "You need rest. Consider 1–2 full recovery days before training hard again.", color: 'bg-red-100 text-red-800 border-red-200' },
};

function tsbSubLabel(tsb: number): string {
  if (tsb > 25)  return 'Well above baseline — you\'ve been easing off';
  if (tsb > 5)   return 'Fresher than your usual level';
  if (tsb >= -10) return 'Right at your normal training baseline';
  if (tsb >= -25) return 'Carrying more load than usual';
  if (tsb >= -40) return 'Noticeably fatigued';
  return 'Significantly overloaded';
}

function formatMinutes(mins: number): string {
  if (mins === 0) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function TsbIcon({ tsb }: { tsb: number }) {
  if (tsb > 5)  return <TrendingUp className="h-5 w-5 text-green-600" />;
  if (tsb < -10) return <TrendingDown className="h-5 w-5 text-orange-600" />;
  return <Minus className="h-5 w-5 text-muted-foreground" />;
}

// ─── Category icon map ────────────────────────────────────────────────────────

function CategoryIcon({ category, className }: { category: ActivityCategory; className?: string }) {
  const cls = cn('h-4 w-4', className);
  switch (category) {
    case 'run':      return <Footprints className={cls} />;
    case 'ride':     return <Bike className={cls} />;
    case 'swim':     return <Waves className={cls} />;
    case 'strength': return <Dumbbell className={cls} />;
    case 'walk':     return <PersonStanding className={cls} />;
    case 'rowing':   return <Activity className={cls} />;
    default:         return <Activity className={cls} />;
  }
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-24 w-full rounded-xl" />
      <div className="grid grid-cols-3 gap-3">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
      <Skeleton className="h-48 w-full rounded-xl" />
      <Skeleton className="h-32 w-full rounded-xl" />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TrainingPage() {
  const { user } = useUser();
  const [summary, setSummary] = useState<TrainingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // AI analysis
  const [aiAnalysis, setAiAnalysis] = useState<TrainingLoadAnalysisOutput | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // "What do these numbers mean?" collapsible
  const [explainerOpen, setExplainerOpen] = useState(false);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const auth = await getAuthInstance();
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('Not authenticated');

      const idToken = await currentUser.getIdToken(true);
      await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
        credentials: 'include',
      });

      const res = await fetch('/api/strava/training-summary', {
        credentials: 'include',
        cache: 'no-cache',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to load training data');
      }

      const data: TrainingSummary = await res.json();
      setSummary(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const handleGenerateAnalysis = async () => {
    if (!summary) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const summaryText = formatTrainingSummaryForAI(summary);
      const result = await analyzeTrainingLoad({
        userName: user?.firstName ?? 'Athlete',
        userGoal: user?.goal ?? 'hybrid',
        trainingSummaryText: summaryText,
      });
      setAiAnalysis(result);
    } catch (err: any) {
      console.error('AI analysis failed:', err);
      setAiError('Analysis failed. Please try again.');
    } finally {
      setAiLoading(false);
    }
  };

  // ── Loading / error states ──────────────────────────────────────────────────

  if (loading) return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Dashboard
      </Link>
      <PageSkeleton />
    </div>
  );

  if (error || !summary || summary.activitiesAnalysed === 0) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Link>
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed p-12 text-center space-y-3">
          <Activity className="h-10 w-10 text-muted-foreground/40" />
          <p className="font-semibold">No training data available</p>
          <p className="text-sm text-muted-foreground">
            {error ?? 'Connect Strava and log some activities to see your training load report.'}
          </p>
          <Button variant="outline" size="sm" onClick={fetchSummary}>Try again</Button>
        </div>
      </div>
    );
  }

  const { loadMetrics, weeklyBreakdown, activityTypeSummary, activitiesAnalysed } = summary;
  const statusInfo = STATUS_COPY[loadMetrics.fatigueStatus] ?? STATUS_COPY['optimal'];

  // Chart data
  const chartData = weeklyBreakdown.map(week => {
    const entry: Record<string, any> = { week: week.weekLabel };
    for (const [cat, mins] of Object.entries(week.byCategory)) {
      entry[cat] = Math.round((mins as number) / 60 * 10) / 10;
    }
    return entry;
  });

  const activeCategories: ActivityCategory[] = Object.keys(
    weeklyBreakdown.reduce((acc, w) => ({ ...acc, ...w.byCategory }), {})
  ) as ActivityCategory[];

  const chartConfig = Object.fromEntries(
    activeCategories.map(cat => [cat, { label: CATEGORY_LABELS[cat], color: CATEGORY_COLORS[cat] }])
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-8">
      {/* Back link */}
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Dashboard
      </Link>

      {/* Page title */}
      <div>
        <h1 className="text-2xl font-bold font-headline flex items-center gap-2">
          <Activity className="h-6 w-6 text-primary" />
          Training Load
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Based on {activitiesAnalysed} Strava activities
        </p>
      </div>

      {/* ── Status Hero ─────────────────────────────────────────────────────── */}
      <div className={cn('rounded-xl border p-5 space-y-2', statusInfo.color)}>
        <div className="flex items-center gap-2">
          <Badge className={cn('text-sm px-3 py-1 font-semibold', statusInfo.color)}>
            {loadMetrics.fatigueLabel}
          </Badge>
        </div>
        <p className="text-sm font-medium leading-relaxed">{statusInfo.sentence}</p>
      </div>

      {/* ── Metric Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {/* ATL */}
        <div className="bg-muted/40 rounded-xl p-3 flex flex-col items-center text-center gap-0.5">
          <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">This Week</p>
          <p className="text-3xl font-bold">{loadMetrics.atl}</p>
          <p className="text-[11px] text-muted-foreground leading-tight">Your recent training load</p>
        </div>

        {/* CTL */}
        <div className="bg-muted/40 rounded-xl p-3 flex flex-col items-center text-center gap-0.5">
          <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Typical Week</p>
          <p className="text-3xl font-bold">{loadMetrics.ctl}</p>
          <p className="text-[11px] text-muted-foreground leading-tight">Your normal training level</p>
        </div>

        {/* TSB / Form */}
        <div className="bg-muted/40 rounded-xl p-3 flex flex-col items-center text-center gap-0.5">
          <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Form Score</p>
          <div className="flex items-center gap-1">
            <TsbIcon tsb={loadMetrics.tsb} />
            <p className="text-3xl font-bold">{loadMetrics.tsb > 0 ? '+' : ''}{loadMetrics.tsb}</p>
          </div>
          <p className="text-[11px] text-muted-foreground leading-tight">{tsbSubLabel(loadMetrics.tsb)}</p>
        </div>
      </div>

      {/* ── What these numbers mean (collapsible) ────────────────────────────── */}
      <Card>
        <button
          onClick={() => setExplainerOpen(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:text-primary transition-colors"
        >
          <span>What do these numbers mean?</span>
          {explainerOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {explainerOpen && (
          <CardContent className="pt-0 pb-4 space-y-4 text-sm text-muted-foreground">
            <Separator />
            <div className="space-y-1">
              <p className="font-semibold text-foreground">This Week (ATL)</p>
              <p>Your <strong>Acute Training Load</strong> — the total stress on your body from the last 7 days of training. Higher means you trained more. Compare it to your Typical Week to see if you're above or below your norm.</p>
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-foreground">Typical Week (CTL)</p>
              <p>Your <strong>Chronic Training Load</strong> — your average weekly training over the last 6 weeks. This is your baseline fitness level. A rising CTL means you're getting fitter; a falling CTL means you're detraining.</p>
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-foreground">Form Score (TSB)</p>
              <p>Your <strong>Training Stress Balance</strong> = Typical Week minus This Week. A positive score means you're fresher than usual (good for racing or hard sessions). A negative score means you're carrying fatigue from recent hard training.</p>
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── Weekly Breakdown Chart ────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Weekly Activity Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <ChartContainer config={chartConfig} className="h-48 w-full">
              <RechartsBarChart data={chartData} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="week" tickLine={false} axisLine={false} tickMargin={4} tick={{ fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10 }} unit="h" />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent indicator="dot" />}
                  formatter={(value: number, name: string) => [`${value}h`, CATEGORY_LABELS[name as ActivityCategory] ?? name]}
                />
                {activeCategories.map(cat => (
                  <Bar
                    key={cat}
                    dataKey={cat}
                    stackId="a"
                    fill={CATEGORY_COLORS[cat]}
                    radius={cat === activeCategories[activeCategories.length - 1] ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                  />
                ))}
              </RechartsBarChart>
            </ChartContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No activity data for this period.</p>
          )}
        </CardContent>
      </Card>

      {/* ── Activity Breakdown ────────────────────────────────────────────────── */}
      {activityTypeSummary.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Activity Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activityTypeSummary.map(t => (
              <div key={t.category} className="flex items-center gap-3">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0"
                  style={{ backgroundColor: `${CATEGORY_COLORS[t.category as ActivityCategory]}22` }}
                >
                  <CategoryIcon
                    category={t.category as ActivityCategory}
                    className="h-4 w-4"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{t.label}</p>
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    <span>
                      This week: <span className="font-medium text-foreground">{formatMinutes(t.last7daysMinutes)}</span>
                    </span>
                    <span>
                      Last 28d: <span className="font-medium text-foreground">{formatMinutes(t.last28daysMinutes)}</span>
                      {t.activityCount28 > 0 && <span className="text-muted-foreground"> ({t.activityCount28} sessions)</span>}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── Coach's Analysis (AI) ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Coach's Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!aiAnalysis && !aiLoading && (
            <div className="text-center py-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                Get a personalised AI coaching analysis of your current training state.
              </p>
              <Button onClick={handleGenerateAnalysis} className="gap-2">
                <Brain className="h-4 w-4" />
                Generate Analysis
              </Button>
              {aiError && <p className="text-sm text-destructive">{aiError}</p>}
            </div>
          )}

          {aiLoading && (
            <div className="space-y-3 py-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/6" />
              <Skeleton className="h-4 w-full mt-4" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-full mt-4" />
              <Skeleton className="h-4 w-5/6" />
              <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Analysing your training data…
              </div>
            </div>
          )}

          {aiAnalysis && (
            <div className="space-y-5 text-sm">
              {/* How You're Feeling */}
              <section className="rounded-lg bg-muted/30 p-4 space-y-1.5">
                <h3 className="font-semibold flex items-center gap-1.5">
                  <TsbIcon tsb={loadMetrics.tsb} />
                  How You're Feeling
                </h3>
                <p className="text-muted-foreground leading-relaxed">{aiAnalysis.fatigueAssessment}</p>
              </section>

              {/* Training Balance */}
              <section className="rounded-lg bg-muted/30 p-4 space-y-1.5">
                <h3 className="font-semibold">Training Balance</h3>
                <p className="text-muted-foreground leading-relaxed">{aiAnalysis.trainingBalance}</p>
              </section>

              {/* This Week */}
              <section className="rounded-lg bg-muted/30 p-4 space-y-1.5">
                <h3 className="font-semibold">This Week</h3>
                <p className="text-muted-foreground leading-relaxed">{aiAnalysis.weekAhead}</p>
              </section>

              {/* Recommendations */}
              {aiAnalysis.recommendations.length > 0 && (
                <section className="rounded-lg bg-primary/5 border border-primary/20 p-4 space-y-2">
                  <h3 className="font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Recommendations
                  </h3>
                  <ul className="space-y-2">
                    {aiAnalysis.recommendations.map((rec, i) => (
                      <li key={i} className="flex gap-2 text-muted-foreground">
                        <span className="text-primary font-bold shrink-0">{i + 1}.</span>
                        <span className="leading-snug">{rec}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Risk Flags */}
              {aiAnalysis.riskFlags.length > 0 && (
                <section className="space-y-2">
                  <h3 className="font-semibold text-orange-700 dark:text-orange-400 flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4" />
                    Flags to Watch
                  </h3>
                  <ul className="space-y-1.5">
                    {aiAnalysis.riskFlags.map((flag, i) => (
                      <li key={i} className="flex gap-2 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800/50 text-orange-700 dark:text-orange-400 rounded-lg p-3">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span className="leading-snug text-xs">{flag}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Refresh button */}
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={handleGenerateAnalysis}
                disabled={aiLoading}
              >
                Refresh Analysis
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
