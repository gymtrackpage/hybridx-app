'use client';

import { useEffect, useState } from 'react';
import {
  Users,
  Activity,
  Clock,
  Smartphone,
  TrendingUp,
  Download,
  BarChart2,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';

interface AnalyticsData {
  retention: { dau: number; wau: number; mau: number };
  onboardingFunnel: { step: number; label: string; count: number }[];
  signupPageViews: number;
  platforms: { platform: string; sessions: number }[];
  topPages: { path: string; count: number }[];
  sessionDuration: {
    avgSeconds: number;
    buckets: { label: string; count: number }[];
    totalSessions: number;
  };
  pwa: { shown: number; accepted: number; dismissed: number; installRate: number };
  dauChart: { date: string; users: number }[];
  totalEvents: number;
  windowDays: number;
}

const dauChartConfig: ChartConfig = {
  users: { label: 'Active Users', color: 'hsl(var(--primary))' },
};

const durationChartConfig: ChartConfig = {
  count: { label: 'Sessions', color: 'hsl(var(--primary))' },
};

function formatSeconds(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState('30');
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/analytics?days=${days}`, { credentials: 'include' });
      if (!res.ok) throw new Error(await res.text());
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [days]);

  const funnelMax = data?.onboardingFunnel[0]?.count || 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Analytics</h1>
          <p className="text-muted-foreground">
            User behaviour, retention, and engagement insights.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6 text-destructive">{error}</CardContent>
        </Card>
      )}

      {loading && !data && (
        <div className="text-muted-foreground text-sm">Loading analytics...</div>
      )}

      {data && (
        <>
          {/* Retention KPIs */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Daily Active Users</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{data.retention.dau}</div>
                <p className="text-xs text-muted-foreground mt-1">Last 24 hours</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Weekly Active Users</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{data.retention.wau}</div>
                <p className="text-xs text-muted-foreground mt-1">Last 7 days</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Monthly Active Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{data.retention.mau}</div>
                <p className="text-xs text-muted-foreground mt-1">Last 30 days</p>
              </CardContent>
            </Card>
          </div>

          {/* DAU chart */}
          {data.dauChart.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart2 className="h-4 w-4" />
                  Daily Active Users — Last {days} Days
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={dauChartConfig} className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.dauChart}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => v.slice(5)} // MM-DD
                        interval="preserveStartEnd"
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis tickLine={false} axisLine={false} allowDecimals={false} tick={{ fontSize: 11 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="users" fill="var(--color-users)" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
          )}

          {/* Onboarding Funnel */}
          <Card>
            <CardHeader>
              <CardTitle>Onboarding Funnel</CardTitle>
              <CardDescription>
                {data.signupPageViews} signup page views in the last {days} days
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.onboardingFunnel.map((row, i) => {
                const pct = funnelMax > 0 ? Math.round((row.count / funnelMax) * 100) : 0;
                const dropPct =
                  i > 0 && data.onboardingFunnel[i - 1].count > 0
                    ? Math.round(
                        (1 - row.count / data.onboardingFunnel[i - 1].count) * 100
                      )
                    : 0;
                return (
                  <div key={row.step} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{row.label}</span>
                      <div className="flex items-center gap-2">
                        {i > 0 && dropPct > 0 && (
                          <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50 text-xs">
                            −{dropPct}%
                          </Badge>
                        )}
                        <span className="text-muted-foreground w-8 text-right">{row.count}</span>
                      </div>
                    </div>
                    <Progress value={pct} className="h-2" />
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Session Duration + PWA side by side */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Session Duration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Session Duration
                </CardTitle>
                <CardDescription>
                  Avg {formatSeconds(data.sessionDuration.avgSeconds)} across{' '}
                  {data.sessionDuration.totalSessions} sessions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={durationChartConfig} className="h-40 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.sessionDuration.buckets}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                      <YAxis tickLine={false} axisLine={false} allowDecimals={false} tick={{ fontSize: 11 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="count" fill="var(--color-count)" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* PWA Install */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  PWA Installation
                </CardTitle>
                <CardDescription>
                  Install rate: {data.pwa.installRate}%
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Prompt shown</span>
                    <span className="font-medium">{data.pwa.shown}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-green-600">Installed</span>
                    <span className="font-medium text-green-600">{data.pwa.accepted}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-red-500">Dismissed</span>
                    <span className="font-medium text-red-500">{data.pwa.dismissed}</span>
                  </div>
                </div>
                {data.pwa.shown > 0 && (
                  <Progress value={data.pwa.installRate} className="h-3" />
                )}
                {data.pwa.shown === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No PWA prompts recorded yet. Data will appear once users visit on web/mobile.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Platform breakdown + Top Pages side by side */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Platform */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4" />
                  Platform Breakdown
                </CardTitle>
                <CardDescription>Sessions by platform</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.platforms.length === 0 && (
                  <p className="text-sm text-muted-foreground">No sessions recorded yet.</p>
                )}
                {data.platforms
                  .sort((a, b) => b.sessions - a.sessions)
                  .map(({ platform, sessions }) => {
                    const total = data.platforms.reduce((s, p) => s + p.sessions, 0);
                    const pct = total > 0 ? Math.round((sessions / total) * 100) : 0;
                    const colors: Record<string, string> = {
                      web: 'bg-blue-500',
                      pwa: 'bg-green-500',
                      ios: 'bg-gray-700',
                      android: 'bg-emerald-500',
                    };
                    return (
                      <div key={platform} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="capitalize font-medium">{platform}</span>
                          <span className="text-muted-foreground">
                            {sessions} ({pct}%)
                          </span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${colors[platform] ?? 'bg-primary'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </CardContent>
            </Card>

            {/* Top Pages */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart2 className="h-4 w-4" />
                  Top Pages
                </CardTitle>
                <CardDescription>Most visited routes</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.topPages.length === 0 && (
                  <p className="text-sm text-muted-foreground">No page views recorded yet.</p>
                )}
                {data.topPages.map(({ path, count }, i) => {
                  const maxCount = data.topPages[0]?.count ?? 1;
                  const pct = Math.round((count / maxCount) * 100);
                  return (
                    <div key={path} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-mono text-xs truncate max-w-[160px]">{path}</span>
                        <span className="text-muted-foreground ml-2 shrink-0">{count}</span>
                      </div>
                      <Progress value={pct} className="h-1.5" />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          <p className="text-xs text-muted-foreground text-right">
            {data.totalEvents.toLocaleString()} events analysed · {days}-day window
          </p>
        </>
      )}
    </div>
  );
}
