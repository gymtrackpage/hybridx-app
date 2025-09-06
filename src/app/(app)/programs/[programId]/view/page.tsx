// src/app/(app)/programs/[programId]/view/page.tsx
'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { onAuthStateChanged } from 'firebase/auth';
import { Loader2, ArrowLeft, Printer, CalendarPlus } from 'lucide-react';

import { auth } from '@/lib/firebase';
import type { Program, User } from '@/models/types';
import { getProgramClient } from '@/services/program-service-client';
import { getUserClient, updateUser } from '@/services/user-service-client';
import { useToast } from '@/hooks/use-toast';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ProgramCalendarView } from '@/components/program-calendar-view';
import { ProgramScheduleDialog } from '@/components/program-schedule-dialog';

export default function ProgramViewPage({ params }: { params: Promise<{ programId: string }> }) {
  const [program, setProgram] = useState<Program | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isScheduling, setIsScheduling] = useState(false);
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  
  // Unwrap the params Promise
  const { programId } = use(params);
  
  useEffect(() => {
    const fetchData = async (id: string) => {
      if (!id) {
        router.push('/programs');
        return;
      }

      try {
        const [fetchedProgram, unsubscribeAuth] = await Promise.all([
          getProgramClient(id),
          onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
              const currentUser = await getUserClient(firebaseUser.uid);
              setUser(currentUser);
            }
          })
        ]);

        if (!fetchedProgram) {
          toast({ title: 'Error', description: 'Program not found.', variant: 'destructive' });
          router.push('/programs');
          return;
        }

        setProgram(fetchedProgram);
        return () => unsubscribeAuth();
      } catch (error) {
        console.error('Failed to load program:', error);
        toast({ title: 'Error', description: 'Failed to load program details.', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };
    
    if (programId) {
      fetchData(programId);
    }
  }, [programId, router, toast]);

  const handlePrint = () => {
    window.print();
  };
  
  const handleScheduleProgram = async (programId: string, startDate: Date) => {
    if (!user) {
        toast({ title: 'Error', description: 'You must be logged in to schedule a program.', variant: 'destructive' });
        return;
    }

    setIsScheduling(true);
    try {
        await updateUser(user.id, { programId, startDate });
        toast({
            title: 'Program Scheduled!',
            description: 'Your new training program has been added to your calendar.',
        });
        setIsScheduleDialogOpen(false);
        router.push('/dashboard');
    } catch (error) {
        console.error('Failed to schedule program:', error);
        toast({
            title: 'Error',
            description: 'Could not schedule the program. Please try again.',
            variant: 'destructive',
        });
    } finally {
        setIsScheduling(false);
    }
  };
  
  const isCurrentProgram = user?.programId === program?.id;

  if (loading) {
    return <Skeleton className="w-full h-[80vh]" />;
  }

  if (!program) {
    return null; // Should be redirected by useEffect
  }

  return (
    <>
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <Button variant="outline" asChild>
            <Link href="/programs">
                <ArrowLeft className="mr-2" />
                Back to Programs
            </Link>
        </Button>
        <div className="flex gap-2 w-full sm:w-auto">
            {!isCurrentProgram && (
              <Button onClick={() => setIsScheduleDialogOpen(true)} className="w-full">
                  <CalendarPlus className="mr-2" />
                  Schedule Program
              </Button>
            )}
            <Button variant="accent" onClick={handlePrint} className="w-full">
                <Printer className="mr-2" />
                Print / Download PDF
            </Button>
        </div>
      </div>
      
      <ProgramCalendarView program={program} />

      <ProgramScheduleDialog
        program={program}
        isOpen={isScheduleDialogOpen}
        onClose={() => setIsScheduleDialogOpen(false)}
        onSchedule={handleScheduleProgram}
        isScheduling={isScheduling}
      />
    </>
  );
}
