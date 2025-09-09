
'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, Dumbbell, Route } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getAllPrograms } from '@/services/program-service-client';
import { getUserClient } from '@/services/user-service-client';
import type { Program, User } from '@/models/types';
import { onAuthStateChanged } from 'firebase/auth';
import { getAuthInstance } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

export default function ProgramsPage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

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

        <Tabs defaultValue="hybrid">
            <TabsList className="grid w-full grid-cols-2 md:w-96">
                <TabsTrigger value="hybrid">Hybrid Programs</TabsTrigger>
                <TabsTrigger value="running">Running Plans</TabsTrigger>
            </TabsList>
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
