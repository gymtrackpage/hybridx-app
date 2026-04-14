'use client';
// src/components/training-load-card.tsx
// Dashboard card that shows ATL/CTL/TSB training load metrics derived from Strava activities,
// and a weekly activity-type breakdown chart. Links to /training for the full report.

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { getAuthInstance } from '@/lib/firebase';
import type { TrainingSummary, ActivityCategory } from '@/services/training-load-service';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
import { Activity, Brain, AlertTriangle, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

// Colours per activity category for the stacked bar chart
const CATEGORY_COLORS: Record<ActivityCategory, string> = {
  run: 'hsl(var(--primary))',
  ride: 'hsl(220 70% 55%)',
  swim: 'hsl(200 80% 50%)',
  strength: 'hsl(280 60% 55%)',
  walk: 'hsl(150 60% 45%)',
  rowing: 'hsl(30 80% 55%)',
  other: 'hsl(var(--muted-foreground))',
};

const CATEGORY_LABELS: Record<ActivityCategory, string> = {
  run: 'Running',
  ride: 'Cycling',
  swim: 'Swimming',
  strength: 'Strength',
  walk: 'Walking',
  rowing: 'Rowing',
  other: 'Other',
};

function fatigueColor(status: string) {
  switch (status) {
    case 'very_fresh': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'fresh': return 'bg-green-100 text-green-800 border-green-200';
    case 'optimal': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'building': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'fatigued': return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'overreaching': return 'bg-red-100 text-red-800 border-red-200';
    default: return 'bg-muted text-muted-foreground';
  }
}

function TsbIcon({ tsb }: { tsb: number }) {
  if (tsb > 5) return <TrendingUp className="h-4 w-4 text-green-600" />;
  if (tsb < -10) return <TrendingDown className="h-4 w-4 text-orange-600" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

export function TrainingLoadCard() {
  const [summary, setSummary] = useState<TrainingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showBreakdown, setShowBreakdown] = useState(false);

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

  // Build chart data from weeklyBreakdown
  const chartData = summary?.weeklyBreakdown.map(week => {
    const entry: Record<string, any> = { week: week.weekLabel };
    for (const [cat, mins] of Object.entries(week.byCategory)) {
      entry[cat] = Math.round((mins as number) / 60 * 10) / 10; // hours, 1dp
    }
    return entry;
  }) ?? [];

  // Discover which categories exist in the data
  const activeCategories: ActivityCategory[] = summary
    ? (Object.keys(
        summary.weeklyBreakdown.reduce((acc, w) => ({ ...acc, ...w.byCategory }), {})
      ) as ActivityCategory[])
    : [];

  const chartConfig = Object.fromEntries(
    activeCategories.map(cat => [cat, { label: CATEGORY_LABELS[cat], color: CATEGORY_COLORS[cat] }])
  );

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-56 mt-1" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-6 text-center text-muted-foreground">
          <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
          <p className="text-sm">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!summary || summary.activitiesAnalysed === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-6 text-center text-muted-foreground">
          <Activity className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
          <p className="text-sm">No recent Strava activities found.</p>
        </CardContent>
      </Card>
    );
  }

  const { loadMetrics } = summary;

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-5 w-5" />
              Training Load
            </CardTitle>
            <Badge variant="outline" className={cn('text-xs', fatigueColor(loadMetrics.fatigueStatus))}>
              {loadMetrics.fatigueLabel}
            </Badge>
          </div>
          <CardDescription>Based on {summary.activitiesAnalysed} Strava activities</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* ATL / CTL / TSB metric row */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-muted/40 rounded-lg p-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">This Week</p>
              <p className="text-xl font-bold">{loadMetrics.atl}</p>
              <p className="text-[10px] text-muted-foreground">ATL</p>
            </div>
            <div className="bg-muted/40 rounded-lg p-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">6-Wk Avg</p>
              <p className="text-xl font-bold">{loadMetrics.ctl}</p>
              <p className="text-[10px] text-muted-foreground">CTL</p>
            </div>
            <div className="bg-muted/40 rounded-lg p-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Form</p>
              <div className="flex items-center justify-center gap-1">
                <TsbIcon tsb={loadMetrics.tsb} />
                <p className="text-xl font-bold">{loadMetrics.tsb > 0 ? '+' : ''}{loadMetrics.tsb}</p>
              </div>
              <p className="text-[10px] text-muted-foreground">TSB</p>
            </div>
          </div>

          {/* Weekly breakdown bar chart — toggleable */}
          <button
            onClick={() => setShowBreakdown(v => !v)}
            className="w-full flex items-center justify-between text-sm font-medium hover:text-primary transition-colors"
          >
            <span>Weekly Activity Breakdown</span>
            {showBreakdown ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {showBreakdown && chartData.length > 0 && (
            <ChartContainer config={chartConfig} className="h-36 w-full">
              <RechartsBarChart data={chartData} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="week" tickLine={false} axisLine={false} tickMargin={4} tick={{ fontSize: 11 }} />
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
          )}

          {/* Activity type summary (last 7 days) */}
          {summary.activityTypeSummary.length > 0 && (
            <div className="space-y-1">
              {summary.activityTypeSummary.slice(0, 4).map(t => (
                <div key={t.category} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{t.label}</span>
                  <span className="font-medium">
                    {t.last7daysMinutes > 0
                      ? `${Math.floor(t.last7daysMinutes / 60)}h ${t.last7daysMinutes % 60}m this week`
                      : `${t.activityCount28} sessions / 28d`}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* View Full Report CTA */}
          <Button variant="outline" size="sm" className="w-full" asChild>
            <Link href="/training">
              <Brain className="mr-2 h-4 w-4" />
              View Full Report
            </Link>
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
