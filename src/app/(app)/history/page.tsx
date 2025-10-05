// src/app/(app)/history/page.tsx
'use client';

import { useEffect, useState, useMemo } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { format } from 'date-fns';
import { Search, Filter, Calendar, CheckCircle2, XCircle, Clock, Trophy, Dumbbell, Route, ChevronDown, ChevronUp } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { getAuthInstance } from '@/lib/firebase';
import { getAllUserSessions, type WorkoutSession } from '@/services/session-service-client';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { formatExerciseDetails } from '@/utils/text-formatter';
import type { Workout, RunningWorkout, Exercise, PlannedRun } from '@/models/types';
import { ShareWorkoutDialog } from '@/components/share-workout-dialog';

export default function WorkoutHistoryPage() {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'skipped'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'hyrox' | 'running'>('all');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'duration'>('date-desc');
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());

  const toggleExpanded = (sessionId: string) => {
    setExpandedSessions(prev => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
  };

  useEffect(() => {
    const initialize = async () => {
      const auth = await getAuthInstance();
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (user) {
          try {
            const userSessions = await getAllUserSessions(user.uid);
            setSessions(userSessions);
          } catch (error) {
            console.error('Error fetching workout history:', error);
          } finally {
            setLoading(false);
          }
        } else {
          setLoading(false);
        }
      });
      return unsubscribe;
    };

    let unsubscribe: () => void;
    initialize().then((unsub) => (unsubscribe = unsub));

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const filteredAndSortedSessions = useMemo(() => {
    let filtered = sessions;

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter((session) =>
        session.workoutTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        session.notes?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter === 'completed') {
      filtered = filtered.filter((session) => session.finishedAt && !session.skipped);
    } else if (statusFilter === 'skipped') {
      filtered = filtered.filter((session) => session.skipped);
    }

    // Type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter((session) => session.programType === typeFilter);
    }

    // Sort
    filtered.sort((a, b) => {
      if (sortBy === 'date-desc') {
        return b.workoutDate.getTime() - a.workoutDate.getTime();
      } else if (sortBy === 'date-asc') {
        return a.workoutDate.getTime() - b.workoutDate.getTime();
      } else {
        // Sort by duration
        const aDuration = a.duration || 0;
        const bDuration = b.duration || 0;
        return bDuration - aDuration;
      }
    });

    return filtered;
  }, [sessions, searchQuery, statusFilter, typeFilter, sortBy]);

  const stats = useMemo(() => {
    const completed = sessions.filter((s) => s.finishedAt && !s.skipped);
    const totalDuration = completed.reduce((sum, s) => sum + (s.duration || 0), 0);
    const avgDuration = completed.length > 0 ? totalDuration / completed.length : 0;

    return {
      total: sessions.length,
      completed: completed.length,
      skipped: sessions.filter((s) => s.skipped).length,
      avgDuration: Math.round(avgDuration),
    };
  }, [sessions]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-1/3" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-20" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-1/4" />
          </CardHeader>
          <CardContent className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Workout History</h1>
        <p className="text-muted-foreground">Track your progress and review past workouts.</p>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed}</div>
            <p className="text-xs text-muted-foreground">
              {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}% completion rate
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgDuration}</div>
            <p className="text-xs text-muted-foreground">minutes per workout</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Skipped</CardTitle>
            <XCircle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.skipped}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search workouts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="skipped">Skipped</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={typeFilter} onValueChange={(value: any) => setTypeFilter(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="hyrox">HYROX</SelectItem>
                  <SelectItem value="running">Running</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Sort By</Label>
              <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date-desc">Newest First</SelectItem>
                  <SelectItem value="date-asc">Oldest First</SelectItem>
                  <SelectItem value="duration">Duration</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Workout List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {filteredAndSortedSessions.length} {filteredAndSortedSessions.length === 1 ? 'Workout' : 'Workouts'}
          </h2>
          {(searchQuery || statusFilter !== 'all' || typeFilter !== 'all') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
                setTypeFilter('all');
              }}
            >
              Clear Filters
            </Button>
          )}
        </div>

        {filteredAndSortedSessions.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Trophy className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No workouts found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {searchQuery || statusFilter !== 'all' || typeFilter !== 'all'
                  ? 'Try adjusting your filters or search query.'
                  : 'Start your fitness journey by completing your first workout!'}
              </p>
              <Link href="/dashboard">
                <Button>Go to Dashboard</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredAndSortedSessions.map((session) => {
              const isCompleted = session.finishedAt && !session.skipped;

              return (
                <Card key={session.id} className={cn('transition-all hover:shadow-md', {
                  'border-green-500/50': isCompleted,
                  'border-orange-500/50': session.skipped,
                })}>
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-start gap-3">
                          <div className={cn('p-2 rounded-lg mt-1', {
                            'bg-blue-500/10': session.programType === 'hyrox',
                            'bg-green-500/10': session.programType === 'running',
                          })}>
                            {session.programType === 'running' ? (
                              <Route className="h-5 w-5 text-green-500" />
                            ) : (
                              <Dumbbell className="h-5 w-5 text-blue-500" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-lg">{session.workoutTitle}</h3>
                              {isCompleted && (
                                <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/50">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Completed
                                </Badge>
                              )}
                              {session.skipped && (
                                <Badge variant="outline" className="bg-orange-500/10 text-orange-700 border-orange-500/50">
                                  Skipped
                                </Badge>
                              )}
                              {session.uploadedToStrava && (
                                <Badge variant="outline" className="bg-purple-500/10 text-purple-700 border-purple-500/50">
                                  Strava
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {format(session.workoutDate, 'MMM d, yyyy')}
                              </span>
                              {session.duration && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {session.duration} min
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {session.notes && (
                          <>
                            <Separator className="my-2" />
                            <p className="text-sm text-muted-foreground italic pl-14">
                              "{session.notes}"
                            </p>
                          </>
                        )}

                        {session.extendedExercises && session.extendedExercises.length > 0 && (
                          <div className="pl-14 pt-2">
                            <p className="text-xs font-medium text-muted-foreground mb-1">Extended with:</p>
                            <div className="flex flex-wrap gap-1">
                              {session.extendedExercises.slice(0, 3).map((ex, idx) => (
                                <Badge key={idx} variant="secondary" className="text-xs">
                                  {ex.name}
                                </Badge>
                              ))}
                              {session.extendedExercises.length > 3 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{session.extendedExercises.length - 3} more
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Workout Details Section */}
                        {session.workoutDetails && (
                          <>
                            <Separator className="my-3" />
                            <div className="pl-14">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleExpanded(session.id)}
                                className="h-8 px-2 text-xs -ml-2"
                              >
                                {expandedSessions.has(session.id) ? (
                                  <>
                                    <ChevronUp className="h-4 w-4 mr-1" />
                                    Hide Details
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="h-4 w-4 mr-1" />
                                    Show Details
                                  </>
                                )}
                              </Button>

                              {expandedSessions.has(session.id) && (
                                <div className="mt-3 space-y-3">
                                  {session.workoutDetails.programType === 'running' ? (
                                    // Running workout details
                                    <div className="space-y-2">
                                      {(session.workoutDetails as RunningWorkout).runs.map((run: PlannedRun, idx: number) => (
                                        <div key={idx} className="bg-muted/30 rounded-lg p-3">
                                          <div className="flex items-start gap-2">
                                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary mt-0.5">
                                              {idx + 1}
                                            </div>
                                            <div className="flex-1">
                                              <p className="font-medium text-sm">{run.description}</p>
                                              <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                                                <span>{run.distance}km</span>
                                                <span className="capitalize">{run.paceZone} pace</span>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    // HYROX/strength workout details
                                    <div className="space-y-2">
                                      {(session.workoutDetails as Workout).exercises.map((exercise: Exercise, idx: number) => {
                                        const formattedDetails = formatExerciseDetails(exercise.details);
                                        return (
                                          <div key={idx} className="bg-muted/30 rounded-lg p-3">
                                            <div className="flex items-start gap-2">
                                              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary mt-0.5">
                                                {idx + 1}
                                              </div>
                                              <div className="flex-1">
                                                <p className="font-medium text-sm mb-1">{exercise.name}</p>
                                                {formattedDetails.length > 0 && (
                                                  <div className="space-y-1">
                                                    {formattedDetails.map((line, lineIdx) => (
                                                      <div key={lineIdx} className="text-xs text-muted-foreground">
                                                        {line.type === 'bullet' ? (
                                                          <div className="flex items-start gap-2">
                                                            <span className="text-primary mt-0.5">•</span>
                                                            <span className="flex-1">{line.content}</span>
                                                          </div>
                                                        ) : (
                                                          <p>{line.content}</p>
                                                        )}
                                                      </div>
                                                    ))}
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>

                      <div className="flex md:flex-col gap-2 md:items-end">
                        {isCompleted && (
                          <ShareWorkoutDialog session={session} />
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
