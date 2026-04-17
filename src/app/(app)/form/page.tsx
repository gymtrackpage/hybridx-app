'use client';

// src/app/(app)/form/page.tsx
// Training Form page — Performance Management Chart (PMC) with daily
// ATL (fatigue), CTL (fitness), and TSB (form) curves, plus weekly load
// trends, current status, and zone explanations.

import { useState, useEffect, useCallback } from 'react';
import { getAuthInstance } from '@/lib/firebase';
import type { TrainingFormSummary, PMCDataPoint, ActivityCategory } from '@/services/training-load-service';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ChartContainer } from '@/components/ui/chart';
import {
  ComposedChart,
  Area,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  BarChart,
} from 'recharts';
import {
  Activity,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Zap,
  Heart,
  Gauge,
  Info,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUser } from '@/contexts/user-context';
import { format, parseISO, subDays } from 'date-fns';

// ── Helpers ──────────────────────────────────────────────────────────────────

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

function fatigueDescription(status: string): string {
  switch (status) {
    case 'very_fresh': return 'You\'re well-rested with significant reserves. Great for a race or hard block.';
    case 'fresh': return 'Good recovery — you can push harder this week without overreaching.';
    case 'optimal': return 'The sweet spot. Training is stimulating adaptation without excessive fatigue.';
    case 'building': return 'Fatigue is accumulating. Monitor recovery and sleep quality closely.';
    case 'fatigued': return 'Significant fatigue. Consider reducing intensity or taking an easy day.';
    case 'overreaching': return 'High risk of overtraining. Prioritise rest and recovery immediately.';
    default: return '';
  }
}

function tsbTrendIcon(tsb: number, prevTsb: number) {
  const delta = tsb - prevTsb;
  if (delta > 2) return <ArrowUpRight className="h-4 w-4 text-green-600" />;
  if (delta < -2) return <ArrowDownRight className="h-4 w-4 text-orange-600" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

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

// ── Custom Tooltip ──────────────────────────────────────────────────────────

function PMCTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload as PMCDataPoint | undefined;
  if (!data) return null;

  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-xl text-xs space-y-1">
      <p className="font-medium">{format(parseISO(data.date), 'MMM d, yyyy')}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
        {data.load > 0 && (
          <>
            <span className="text-muted-foreground">Load</span>
            <span className="font-mono font-medium text-right">{data.load}</span>
          </>
        )}
        <span className="text-muted-foreground">Fitness (CTL)</span>
        <span className="font-mono font-medium text-right text-blue-600">{data.ctl}</span>
        <span className="text-muted-foreground">Fatigue (ATL)</span>
        <span className="font-mono font-medium text-right text-rose-500">{data.atl}</span>
        <span className="text-muted-foreground">Form (TSB)</span>
        <span className={cn(
          'font-mono font-medium text-right',
          data.tsb > 5 ? 'text-green-600' : data.tsb < -10 ? 'text-orange-600' : 'text-muted-foreground'
        )}>{data.tsb > 0 ? '+' : ''}{data.tsb}</span>
      </div>
    </div>
  );
}

function LoadTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload;
  if (!data) return null;

  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-xl text-xs space-y-1">
      <p className="font-medium">{data.weekLabel}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
        <span className="text-muted-foreground">Total</span>
        <span className="font-mono font-medium text-right">{data.totalMinutes} min</span>
        {Object.entries(data.byCategory || {}).map(([cat, mins]) => (
          <div key={cat} className="contents">
            <span className="text-muted-foreground">{CATEGORY_LABELS[cat as ActivityCategory] || cat}</span>
            <span className="font-mono font-medium text-right">{mins as number} min</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Metric Card ──────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  sublabel,
  icon: Icon,
  color,
  trend,
}: {
  label: string;
  value: string | number;
  sublabel: string;
  icon: React.ElementType;
  color: string;
  trend?: React.ReactNode;
}) {
  return (
    <div className="bg-muted/40 rounded-xl p-4 space-y-1">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{label}</p>
        <Icon className={cn('h-4 w-4', color)} />
      </div>
      <div className="flex items-center gap-2">
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        {trend}
      </div>
      <p className="text-[11px] text-muted-foreground">{sublabel}</p>
    </div>
  );
}

// ── Form Zone Legend ─────────────────────────────────────────────────────────

const FORM_ZONES = [
  { label: 'Overreaching', range: 'TSB < -40', color: 'bg-red-500', desc: 'High injury risk — rest immediately' },
  { label: 'Fatigued', range: '-40 to -25', color: 'bg-orange-500', desc: 'Accumulated fatigue — reduce load' },
  { label: 'Building', range: '-25 to -10', color: 'bg-yellow-500', desc: 'Productive stress — monitor recovery' },
  { label: 'Optimal', range: '-10 to +5', color: 'bg-emerald-500', desc: 'Peak performance zone' },
  { label: 'Fresh', range: '+5 to +25', color: 'bg-green-500', desc: 'Well recovered — ready to push' },
  { label: 'Very Fresh', range: 'TSB > +25', color: 'bg-blue-500', desc: 'Possible detraining if extended' },
];

// ── Main Page Component ──────────────────────────────────────────────────────

export default function TrainingFormPage() {
  const { user } = useUser();
  const [data, setData] = useState<TrainingFormSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<30 | 60 | 90>(60);

  const fetchData = useCallback(async () => {
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

      const res = await fetch('/api/strava/training-form', {
        credentials: 'include',
        cache: 'no-cache',
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to load training form data');
      }

      const result: TrainingFormSummary = await res.json();
      setData(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter PMC data to selected time range
  const pmcData = data?.dailyPMC
    ? data.dailyPMC.slice(-timeRange)
    : [];

  // Get current and previous day metrics for trend
  const current = pmcData.length > 0 ? pmcData[pmcData.length - 1] : null;
  const previous = pmcData.length > 1 ? pmcData[pmcData.length - 2] : null;
  const weekAgo = pmcData.length > 7 ? pmcData[pmcData.length - 8] : null;

  // Weekly load chart data
  const weeklyData = data?.weeklyBreakdown.map(w => ({
    weekLabel: w.weekLabel,
    totalMinutes: w.totalMinutes,
    byCategory: w.byCategory,
  })) ?? [];

  // Discover active categories
  const activeCategories: ActivityCategory[] = data
    ? (Object.keys(
        data.weeklyBreakdown.reduce((acc, w) => ({ ...acc, ...w.byCategory }), {})
      ) as ActivityCategory[])
    : [];

  // Format X axis dates
  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'MMM d');
    } catch {
      return dateStr;
    }
  };

  // Compute tick interval for x-axis based on time range
  const tickInterval = timeRange <= 30 ? 4 : timeRange <= 60 ? 6 : 10;

  if (loading) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto">
        <div>
          <Skeleton className="h-7 w-48 mb-1" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card className="border-dashed">
          <CardContent className="p-8 text-center text-muted-foreground">
            <AlertTriangle className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-sm font-medium mb-1">Unable to load training data</p>
            <p className="text-xs">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data || data.activitiesAnalysed === 0) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card className="border-dashed">
          <CardContent className="p-8 text-center text-muted-foreground">
            <Activity className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-sm font-medium mb-1">No training data available</p>
            <p className="text-xs">Connect Strava and log some activities to see your training form.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { loadMetrics } = data;
  const ctlDelta = weekAgo ? Math.round((current!.ctl - weekAgo.ctl) * 10) / 10 : 0;

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Gauge className="h-5 w-5" />
          Training Form
        </h1>
        <p className="text-sm text-muted-foreground">
          Performance management based on {data.activitiesAnalysed} Strava activities
        </p>
      </div>

      {/* Current Status Banner */}
      <Card className="overflow-hidden">
        <div className={cn(
          'px-4 py-3 flex items-center justify-between',
          loadMetrics.fatigueStatus === 'overreaching' ? 'bg-red-50 border-b border-red-200' :
          loadMetrics.fatigueStatus === 'fatigued' ? 'bg-orange-50 border-b border-orange-200' :
          loadMetrics.fatigueStatus === 'building' ? 'bg-yellow-50 border-b border-yellow-200' :
          loadMetrics.fatigueStatus === 'optimal' ? 'bg-emerald-50 border-b border-emerald-200' :
          loadMetrics.fatigueStatus === 'fresh' ? 'bg-green-50 border-b border-green-200' :
          'bg-blue-50 border-b border-blue-200'
        )}>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className={cn('text-xs font-semibold', fatigueColor(loadMetrics.fatigueStatus))}>
              {loadMetrics.fatigueLabel}
            </Badge>
            <p className="text-xs text-muted-foreground hidden sm:block">
              {fatigueDescription(loadMetrics.fatigueStatus)}
            </p>
          </div>
          {current && previous && tsbTrendIcon(current.tsb, previous.tsb)}
        </div>
        <CardContent className="pt-4 pb-4">
          <p className="text-xs text-muted-foreground sm:hidden mb-3">
            {fatigueDescription(loadMetrics.fatigueStatus)}
          </p>
          {/* Metric Cards */}
          <div className="grid grid-cols-3 gap-3">
            <MetricCard
              label="Fitness"
              value={current?.ctl ?? loadMetrics.ctl}
              sublabel={ctlDelta !== 0 ? `${ctlDelta > 0 ? '+' : ''}${ctlDelta} vs last week` : '42-day EWMA (CTL)'}
              icon={Heart}
              color="text-blue-600"
              trend={ctlDelta > 0 ? <ArrowUpRight className="h-3.5 w-3.5 text-blue-600" /> : ctlDelta < 0 ? <ArrowDownRight className="h-3.5 w-3.5 text-orange-500" /> : undefined}
            />
            <MetricCard
              label="Fatigue"
              value={current?.atl ?? loadMetrics.atl}
              sublabel="7-day EWMA (ATL)"
              icon={Zap}
              color="text-rose-500"
            />
            <MetricCard
              label="Form"
              value={`${(current?.tsb ?? loadMetrics.tsb) > 0 ? '+' : ''}${current?.tsb ?? loadMetrics.tsb}`}
              sublabel="CTL minus ATL (TSB)"
              icon={Gauge}
              color={
                (current?.tsb ?? loadMetrics.tsb) > 5 ? 'text-green-600' :
                (current?.tsb ?? loadMetrics.tsb) < -10 ? 'text-orange-600' :
                'text-muted-foreground'
              }
              trend={current && previous ? tsbTrendIcon(current.tsb, previous.tsb) : undefined}
            />
          </div>
        </CardContent>
      </Card>

      {/* PMC Chart */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Performance Management Chart</CardTitle>
              <CardDescription>Fitness, fatigue, and form over time</CardDescription>
            </div>
            <div className="flex gap-1">
              {([30, 60, 90] as const).map(range => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                    timeRange === range
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted'
                  )}
                >
                  {range}d
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={pmcData} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
                <defs>
                  <linearGradient id="tsbGradientPos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(142 71% 45%)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(142 71% 45%)" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="tsbGradientNeg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(25 95% 53%)" stopOpacity={0.02} />
                    <stop offset="100%" stopColor="hsl(25 95% 53%)" stopOpacity={0.3} />
                  </linearGradient>
                  <linearGradient id="loadGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                  interval={tickInterval}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<PMCTooltip />} />
                <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="4 4" />
                {/* Daily load as subtle bars */}
                <Bar
                  dataKey="load"
                  fill="url(#loadGradient)"
                  radius={[2, 2, 0, 0]}
                  maxBarSize={6}
                  opacity={0.6}
                />
                {/* TSB fill area */}
                <Area
                  type="monotone"
                  dataKey="tsb"
                  stroke="none"
                  fill="url(#tsbGradientPos)"
                  fillOpacity={1}
                  baseValue={0}
                />
                {/* CTL = Fitness line */}
                <Line
                  type="monotone"
                  dataKey="ctl"
                  stroke="hsl(217 91% 60%)"
                  strokeWidth={2.5}
                  dot={false}
                  name="Fitness (CTL)"
                />
                {/* ATL = Fatigue line */}
                <Line
                  type="monotone"
                  dataKey="atl"
                  stroke="hsl(346 77% 56%)"
                  strokeWidth={2}
                  dot={false}
                  strokeDasharray="6 3"
                  name="Fatigue (ATL)"
                />
                {/* TSB = Form line */}
                <Line
                  type="monotone"
                  dataKey="tsb"
                  stroke="hsl(142 71% 45%)"
                  strokeWidth={2}
                  dot={false}
                  name="Form (TSB)"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          {/* Legend */}
          <div className="flex flex-wrap items-center justify-center gap-4 mt-3 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-0.5 bg-blue-500 rounded-full" style={{ height: 3 }} />
              <span className="text-muted-foreground">Fitness (CTL)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 rounded-full" style={{ height: 2, borderTop: '2px dashed hsl(346 77% 56%)' }} />
              <span className="text-muted-foreground">Fatigue (ATL)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-0.5 rounded-full" style={{ height: 3, backgroundColor: 'hsl(142 71% 45%)' }} />
              <span className="text-muted-foreground">Form (TSB)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-muted-foreground/20" />
              <span className="text-muted-foreground">Daily Load</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Weekly Volume Trend */}
      {weeklyData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Weekly Training Volume</CardTitle>
            <CardDescription>Total training time by activity type (last 4 weeks)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
                  <CartesianGrid vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis
                    dataKey="weekLabel"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    unit="m"
                  />
                  <Tooltip content={<LoadTooltip />} />
                  {activeCategories.map((cat, i) => (
                    <Bar
                      key={cat}
                      dataKey={`byCategory.${cat}`}
                      stackId="a"
                      fill={CATEGORY_COLORS[cat]}
                      name={CATEGORY_LABELS[cat]}
                      radius={i === activeCategories.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
            {/* Category Legend */}
            <div className="flex flex-wrap items-center justify-center gap-3 mt-2 text-xs">
              {activeCategories.map(cat => (
                <div key={cat} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: CATEGORY_COLORS[cat] }} />
                  <span className="text-muted-foreground">{CATEGORY_LABELS[cat]}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Form Zones Guide */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="h-4 w-4" />
            Understanding Your Form
          </CardTitle>
          <CardDescription>
            TSB (Training Stress Balance) indicates your readiness to perform
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {FORM_ZONES.map(zone => (
              <div
                key={zone.label}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-xs transition-colors',
                  loadMetrics.fatigueLabel.toLowerCase().includes(zone.label.toLowerCase())
                    ? 'bg-muted ring-1 ring-primary/20'
                    : ''
                )}
              >
                <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', zone.color)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{zone.label}</span>
                    <span className="text-muted-foreground font-mono shrink-0">{zone.range}</span>
                  </div>
                  <p className="text-muted-foreground mt-0.5">{zone.desc}</p>
                </div>
                {loadMetrics.fatigueLabel.toLowerCase().includes(zone.label.toLowerCase()) && (
                  <Badge variant="outline" className="text-[10px] shrink-0">You</Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Key Insight */}
      <Card className="bg-muted/30">
        <CardContent className="p-4">
          <div className="flex gap-3 text-xs text-muted-foreground">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p>
                <strong>Fitness (CTL)</strong> rises gradually as you train consistently. It represents your body&apos;s ability to handle training load.
              </p>
              <p>
                <strong>Fatigue (ATL)</strong> responds quickly to recent training. It shows how tired you are right now.
              </p>
              <p>
                <strong>Form (TSB)</strong> is the difference between fitness and fatigue. Peak performance comes when fitness is high and fatigue has tapered — aim for TSB between -10 and +5 on race day.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
