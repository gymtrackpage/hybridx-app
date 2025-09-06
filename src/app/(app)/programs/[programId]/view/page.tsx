// src/app/(app)/programs/[programId]/view/page.tsx
'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { onAuthStateChanged } from 'firebase/auth';
import { Loader2, ArrowLeft, Printer, CalendarPlus } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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
  const [isDownloading, setIsDownloading] = useState(false);
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

  const handleDownloadPDF = async () => {
    if (!program) return;
    setIsDownloading(true);
    try {
      toast({ title: 'Generating PDF...', description: 'Please wait while we create your training calendar.' });
      
      const element = document.querySelector('.print-container');
      if (!element) return;
  
      const canvas = await html2canvas(element as HTMLElement, {
        scale: 2,
        useCORS: true,
        logging: false,
        width: element.scrollWidth,
        height: element.scrollHeight,
      });
  
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });
  
      const imgWidth = 297; // A4 landscape width in mm
      const pageHeight = 210; // A4 landscape height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
  
      let position = 0;
  
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
  
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
  
      const fileName = `${program.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_training_calendar.pdf`;
      pdf.save(fileName);
      
      toast({ title: 'PDF Downloaded!', description: 'Your training calendar has been saved.' });
    } catch (error) {
      console.error('PDF generation failed:', error);
      toast({ 
        title: 'Error', 
        description: 'Failed to generate PDF. Please try the print option instead.',
        variant: 'destructive' 
      });
    } finally {
      setIsDownloading(false);
    }
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
              <Button onClick={() => setIsScheduleDialogOpen(true)} className="w-full" disabled={isScheduling}>
                  <CalendarPlus className="mr-2" />
                  Schedule Program
              </Button>
            )}
            <Button variant="accent" onClick={handleDownloadPDF} className="w-full" disabled={isDownloading}>
                {isDownloading ? <Loader2 className="mr-2 animate-spin" /> : <Printer className="mr-2" />}
                {isDownloading ? 'Generating...' : 'Download PDF'}
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
