
'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, Dumbbell, Route, Trash2, Calendar, Zap } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getAllPrograms, getPersonalPrograms, deletePersonalProgram } from '@/services/program-service-client';
import { getUserClient, updateUser } from '@/services/user-service-client';
import type { Program, User } from '@/models/types';
import { onAuthStateChanged } from 'firebase/auth';
import { getAuthInstance } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';

export default function ProgramsPage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [personalPrograms, setPersonalPrograms] = useState<Program[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    const fetchProgramsAndUser = async () => {
      try {
        const fetchedPrograms = await getAllPrograms();
        setPrograms(fetchedPrograms);

        const auth = await getAuthInstance();
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
          if (firebaseUser) {
            const currentUser = await getUserClient(firebaseUser.uid);
            setUser(currentUser);
            
            // Fetch Personal Programs
            const personal = await getPersonalPrograms(firebaseUser.uid);
            setPersonalPrograms(personal);
          }
          setLoading(false);
        });
        
        return () => unsubscribe();
      } catch (error) {
        console.error('Failed to load data:', error);
        toast({
          title: 'Error',
          description: 'Failed to load programs. Please try again later.',
          variant: 'destructive',
        });
        setLoading(false);
      }
    };
    fetchProgramsAndUser();
  }, [toast]);

  const handleDeletePersonalPlan = async (programId: string) => {
      if (!user) return;
      if (confirm('Are you sure you want to delete this custom plan?')) {
          try {
              await deletePersonalProgram(user.id, programId);
              setPersonalPrograms(prev => prev.filter(p => p.id !== programId));
              toast({ title: 'Plan deleted', description: 'The custom program has been removed.' });
          } catch (e) {
              toast({ title: 'Error', description: 'Failed to delete plan.', variant: 'destructive' });
          }
      }
  };

  const handleStartPersonalPlan = async (program: Program) => {
      if (!user) return;
      try {
          await updateUser(user.id, {
              programId: program.id,
              customProgram: program.workouts, // Important for legacy support
              startDate: new Date(),
          });
          setUser(prev => prev ? ({ ...prev, programId: program.id }) : null);
          toast({ title: 'Program Started', description: `${program.name} is now your active plan.` });
          router.push('/dashboard');
      } catch (e) {
          toast({ title: 'Error', description: 'Failed to start plan.', variant: 'destructive' });
      }
  }
  
  const renderProgramCards = (programType: 'hyrox' | 'running' | undefined) => {
    const filteredPrograms = programs.filter(p => (p.programType || 'hyrox') === programType);

    if (filteredPrograms.length === 0) {
        return <p className="text-muted-foreground col-span-full text-center py-8">No {programType} programs available yet.</p>
    }

    return filteredPrograms.map((program) => {
        const isCurrentProgram = user?.programId === program.id;
        return (
            <Card key={program.id} className="flex flex-col">
                <CardHeader>
                    <CardTitle>{program.name}</CardTitle>
                    <CardDescription className="line-clamp-3 h-[60px]">{program.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow">
                    <div className="flex items-center text-sm text-muted-foreground gap-4">
                        <div className="flex items-center gap-1.5">
                            {program.programType === 'running' ? <Route className="h-4 w-4" /> : <Dumbbell className="h-4 w-4" />}
                            <span>{program.workouts.length} workouts</span>
                        </div>
                    </div>
                </CardContent>
                <CardFooter>
                    {isCurrentProgram ? (
                        <Button className="w-full" disabled>
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Currently Active
                        </Button>
                    ) : (
                        <Button className="w-full" variant="outline" asChild>
                          <Link href={`/programs/${program.id}/view`}>
                            View Program
                          </Link>
                        </Button>
                    )}
                </CardFooter>
            </Card>
        );
    });
  }

  const renderPersonalPrograms = () => {
      if (personalPrograms.length === 0) {
          return (
              <div className="col-span-full text-center py-12 border rounded-lg border-dashed bg-muted/20">
                  <Zap className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-medium text-lg">No Personal Plans Yet</h3>
                  <p className="text-muted-foreground text-sm max-w-md mx-auto mt-2">
                      Use the "Train for an Event" feature on your dashboard to generate custom, AI-powered training plans tailored to your race schedule.
                  </p>
                  <Button variant="outline" className="mt-6" asChild>
                      <Link href="/dashboard">Go to Dashboard</Link>
                  </Button>
              </div>
          );
      }

      return personalPrograms.map((program) => {
        const isCurrentProgram = user?.programId === program.id;
        return (
            <Card key={program.id} className="flex flex-col border-primary/20 bg-primary/5">
                <CardHeader>
                    <div className="flex justify-between items-start gap-4">
                        <CardTitle className="text-lg">{program.name}</CardTitle>
                        <Badge variant="outline" className="shrink-0 bg-background">Custom Plan</Badge>
                    </div>
                    <CardDescription className="line-clamp-3 h-[60px]">{program.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow">
                    <div className="flex items-center text-sm text-muted-foreground gap-4">
                        <div className="flex items-center gap-1.5">
                            <Calendar className="h-4 w-4" />
                            <span>{(program.workouts.length / 7).toFixed(0)} Weeks</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            {program.programType === 'running' ? <Route className="h-4 w-4" /> : <Dumbbell className="h-4 w-4" />}
                            <span>{program.programType === 'running' ? 'Running' : 'Hybrid'}</span>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="flex gap-2">
                    {isCurrentProgram ? (
                        <Button className="w-full flex-1" disabled>
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Active
                        </Button>
                    ) : (
                        <Button className="w-full flex-1" onClick={() => handleStartPersonalPlan(program)}>
                            Start Plan
                        </Button>
                    )}
                    <Button variant="destructive" size="icon" onClick={() => handleDeletePersonalPlan(program.id)}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </CardFooter>
            </Card>
        );
      });
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-4 w-2/3 mt-2" />
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader>
              <CardContent><Skeleton className="h-16 w-full" /></CardContent>
              <CardFooter><Skeleton className="h-10 w-full" /></CardFooter>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
        <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Browse Programs</h1>
            <p className="text-muted-foreground">Find the perfect training plan to match your goals and schedule.</p>
        </div>

        <Tabs defaultValue="my-plans">
            <TabsList className="grid w-full grid-cols-3 md:w-[600px]">
                <TabsTrigger value="my-plans">My Plans</TabsTrigger>
                <TabsTrigger value="hybrid">Hybrid Programs</TabsTrigger>
                <TabsTrigger value="running">Running Plans</TabsTrigger>
            </TabsList>
            
            <TabsContent value="my-plans">
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-6">
                    {renderPersonalPrograms()}
                </div>
            </TabsContent>

            <TabsContent value="hybrid">
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-6">
                    {renderProgramCards('hyrox')}
                </div>
            </TabsContent>
            
            <TabsContent value="running">
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-6">
                    {renderProgramCards('running')}
                </div>
            </TabsContent>
        </Tabs>
    </div>
  );
}
