'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Target, AlertTriangle } from 'lucide-react';

// ── Daniels VDOT Mathematics ─────────────────────────────────────────────────

function percentVO2(t: number): number {
  return (
    0.8 +
    0.1894393 * Math.exp(-0.012778 * t) +
    0.2989558 * Math.exp(-0.1932605 * t)
  );
}

function vo2AtVelocity(v: number): number {
  return -4.6 + 0.182258 * v + 0.000104 * v * v;
}

function velocityAtVO2(vo2: number): number {
  const a = 0.000104, b = 0.182258, c = -(vo2 + 4.6);
  return (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
}

function calcVDOT(distanceMetres: number, timeMinutes: number): number {
  const v = distanceMetres / timeMinutes;
  const vo2 = vo2AtVelocity(v);
  const pct = percentVO2(timeMinutes);
  return vo2 / pct;
}

const METRES_PER_MILE = 1609.344;

function velocityToPace(vMperMin: number, perMile = false): string {
  const unitMetres = perMile ? METRES_PER_MILE : 1000;
  const secsPerUnit = (unitMetres / vMperMin) * 60;
  const mins = Math.floor(secsPerUnit / 60);
  const secs = Math.round(secsPerUnit % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function paceRange(vdot: number, loFrac: number, hiFrac: number, perMile = false): string {
  const lo = velocityToPace(velocityAtVO2(vdot * loFrac), perMile);
  const hi = velocityToPace(velocityAtVO2(vdot * hiFrac), perMile);
  return `${hi} – ${lo}`;
}

// ── Training zones per Daniels ────────────────────────────────────────────────

interface Zone {
  zone: string;
  code: string;
  description: string;
  pace: string;
  effort: string;
  colorClass: string;
  bgClass: string;
}

function getTrainingPaces(vdot: number, perMile = false): Zone[] {
  return [
    {
      zone: 'E / Easy',
      code: 'E',
      description: 'Conversational aerobic base',
      pace: paceRange(vdot, 0.59, 0.74, perMile),
      effort: 'Zone 1–2',
      colorClass: 'text-green-400 border-l-green-400',
      bgClass: 'bg-green-400',
    },
    {
      zone: 'M / Marathon',
      code: 'M',
      description: 'Marathon race pace',
      pace: paceRange(vdot, 0.75, 0.84, perMile),
      effort: 'Zone 3',
      colorClass: 'text-blue-400 border-l-blue-400',
      bgClass: 'bg-blue-400',
    },
    {
      zone: 'T / Threshold',
      code: 'T',
      description: 'Comfortably hard, ~60 min max',
      pace: paceRange(vdot, 0.83, 0.88, perMile),
      effort: 'Zone 3–4',
      colorClass: 'text-amber-400 border-l-amber-400',
      bgClass: 'bg-amber-400',
    },
    {
      zone: 'I / Interval',
      code: 'I',
      description: '3–5 min repeats, VO₂max stimulus',
      pace: paceRange(vdot, 0.95, 1.0, perMile),
      effort: 'Zone 5',
      colorClass: 'text-orange-400 border-l-orange-400',
      bgClass: 'bg-orange-400',
    },
    {
      zone: 'R / Repetition',
      code: 'R',
      description: 'Short fast reps, pure speed',
      pace: paceRange(vdot, 1.05, 1.2, perMile),
      effort: 'Zone 5+',
      colorClass: 'text-fuchsia-400 border-l-fuchsia-400',
      bgClass: 'bg-fuchsia-400',
    },
  ];
}

// ── Race distance options ─────────────────────────────────────────────────────

const DISTANCES = [
  { label: '1,500m', metres: 1500 },
  { label: '1 Mile', metres: 1609.34 },
  { label: '3,000m', metres: 3000 },
  { label: '5K', metres: 5000 },
  { label: '8K', metres: 8000 },
  { label: '10K', metres: 10000 },
  { label: '15K', metres: 15000 },
  { label: 'Half Marathon', metres: 21097.5 },
  { label: 'Marathon', metres: 42195 },
];

function timeToMinutes(h: string, m: string, s: string): number {
  return parseInt(h || '0') * 60 + parseInt(m || '0') + parseInt(s || '0') / 60;
}

function vdotColor(vdot: number): string {
  if (vdot >= 70) return 'text-fuchsia-400';
  if (vdot >= 60) return 'text-orange-400';
  if (vdot >= 50) return 'text-amber-400';
  if (vdot >= 40) return 'text-blue-400';
  return 'text-green-400';
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function VDOTCalculatorPage() {
  const [distIdx, setDistIdx] = useState(3); // default 5K
  const [hours, setHours] = useState('');
  const [mins, setMins] = useState('');
  const [secs, setSecs] = useState('');
  const [result, setResult] = useState<{ vdot: number } | null>(null);
  const [error, setError] = useState('');
  const [perMile, setPerMile] = useState(false);

  const calculate = useCallback(() => {
    const totalMins = timeToMinutes(hours, mins, secs);
    if (totalMins <= 0) {
      setError('Enter a finish time above zero.');
      setResult(null);
      return;
    }
    const distMetres = DISTANCES[distIdx].metres;
    if (distMetres / totalMins < 1000 / 12) {
      setError('Pace seems too slow — check your time.');
      setResult(null);
      return;
    }
    const vdot = calcVDOT(distMetres, totalMins);
    if (vdot < 20 || vdot > 85) {
      setError('Result out of VDOT range (20–85). Check your inputs.');
      setResult(null);
      return;
    }
    setError('');
    setResult({ vdot });
  }, [distIdx, hours, mins, secs]);

  const timeLabel = [
    parseInt(hours) > 0 ? `${hours}h` : null,
    `${mins || '0'}m`,
    `${secs || '0'}s`,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="secondary" className="text-xs">Training Tools</Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">VDOT Calculator</h1>
          <p className="text-muted-foreground mt-1">
            Enter a recent race result to get your VDOT score and all five Jack Daniels training zone paces.
          </p>
        </div>
        <Target className="h-8 w-8 text-accent shrink-0 mt-1" />
      </div>

      {/* Input card */}
      <Card>
        <CardHeader>
          <CardTitle>Race Result</CardTitle>
          <CardDescription>Select your distance and enter your finishing time</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* Distance selector */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Race Distance</p>
            <div className="grid grid-cols-3 gap-2">
              {DISTANCES.map((d, i) => (
                <button
                  key={d.label}
                  onClick={() => setDistIdx(i)}
                  className={cn(
                    'rounded-lg border px-2 py-2.5 text-sm font-medium transition-colors',
                    distIdx === i
                      ? 'border-accent bg-accent text-accent-foreground font-bold'
                      : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Time inputs */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Finish Time</p>
            <div className="grid grid-cols-[1fr_12px_1fr_12px_1fr] items-center gap-0">
              <div className="space-y-1">
                <input
                  type="number"
                  min="0"
                  max="23"
                  placeholder="0"
                  value={hours}
                  onChange={e => setHours(e.target.value)}
                  className="w-full rounded-lg border border-border bg-muted/40 px-2 py-2.5 text-center text-xl font-semibold tabular-nums text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <p className="text-center text-[10px] uppercase tracking-widest text-muted-foreground">HH</p>
              </div>
              <p className="text-center text-xl font-bold text-muted-foreground/50 pb-5">:</p>
              <div className="space-y-1">
                <input
                  type="number"
                  min="0"
                  max="59"
                  placeholder="25"
                  value={mins}
                  onChange={e => setMins(e.target.value)}
                  className="w-full rounded-lg border border-border bg-muted/40 px-2 py-2.5 text-center text-xl font-semibold tabular-nums text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <p className="text-center text-[10px] uppercase tracking-widest text-muted-foreground">MM</p>
              </div>
              <p className="text-center text-xl font-bold text-muted-foreground/50 pb-5">:</p>
              <div className="space-y-1">
                <input
                  type="number"
                  min="0"
                  max="59"
                  placeholder="00"
                  value={secs}
                  onChange={e => setSecs(e.target.value)}
                  className="w-full rounded-lg border border-border bg-muted/40 px-2 py-2.5 text-center text-xl font-semibold tabular-nums text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <p className="text-center text-[10px] uppercase tracking-widest text-muted-foreground">SS</p>
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <Button onClick={calculate} className="w-full" size="lg" variant="accent">
            Calculate VDOT
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <>
          {/* VDOT score */}
          <Card>
            <CardContent className="pt-6 pb-6 flex flex-col items-center gap-1">
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Your VDOT Score</p>
              <p className={cn('text-7xl font-extrabold tabular-nums leading-none tracking-tighter', vdotColor(result.vdot))}>
                {result.vdot.toFixed(1)}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Based on {DISTANCES[distIdx].label} in {timeLabel}
              </p>
            </CardContent>
          </Card>

          {/* Training zones */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Training Zone Paces</CardTitle>
                {/* km / mi toggle */}
                <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-1">
                  {(['km', 'mi'] as const).map(unit => {
                    const active = unit === 'mi' ? perMile : !perMile;
                    return (
                      <button
                        key={unit}
                        onClick={() => setPerMile(unit === 'mi')}
                        className={cn(
                          'rounded-md px-3 py-1 text-xs font-semibold transition-colors',
                          active
                            ? 'bg-accent text-accent-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                        )}
                      >
                        {unit}
                      </button>
                    );
                  })}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {getTrainingPaces(result.vdot, perMile).map(z => (
                <div
                  key={z.code}
                  className={cn(
                    'flex items-center justify-between gap-3 rounded-lg border border-border border-l-[3px] bg-muted/20 px-4 py-3',
                    z.colorClass
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm font-bold', z.colorClass.split(' ')[0])}>
                      {z.zone}
                    </p>
                    <p className="text-xs text-muted-foreground">{z.description}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold tabular-nums tracking-tight">
                      {z.pace}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {z.effort} · /{perMile ? 'mi' : 'km'}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Note */}
          <p className="text-xs text-muted-foreground text-center leading-relaxed px-2">
            Paces derived from Daniels&apos; Running Formula. T pace shown as a range — use the slower end for cruise intervals, faster end for shorter tempo runs.{' '}
            <span className="text-accent font-medium">Hyrox athletes:</span> E and T paces are your primary training targets.
          </p>
        </>
      )}
    </div>
  );
}
