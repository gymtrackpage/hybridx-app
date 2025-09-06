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
  
      // Create a temporary clone for PDF generation with optimized styles
      const clone = element.cloneNode(true) as HTMLElement;
      clone.style.position = 'absolute';
      clone.style.left = '-9999px';
      clone.style.top = '0';
      clone.style.width = '1200px'; // Fixed width for consistency
      clone.style.background = 'white';
      clone.style.padding = '20px';
      clone.style.fontFamily = 'Arial, sans-serif';
      
      // Apply PDF-specific styles to the clone
      const style = document.createElement('style');
      style.textContent = `
        .pdf-clone h1 { font-size: 18px !important; margin-bottom: 8px !important; }
        .pdf-clone p { font-size: 12px !important; margin-bottom: 15px !important; }
        .pdf-clone h2 { font-size: 14px !important; margin: 10px 0 8px 0 !important; }
        .pdf-clone .day-cell { 
          min-height: 100px !important; 
          padding: 6px !important;
          border: 1px solid #333 !important;
          font-size: 9px !important;
          margin-bottom: 2px !important;
        }
        .pdf-clone .day-cell h3 { font-size: 10px !important; margin-bottom: 4px !important; }
        .pdf-clone .day-cell li { 
          font-size: 8px !important; 
          line-height: 1.2 !important;
          margin-bottom: 1px !important;
        }
        .pdf-clone .day-cell strong { font-size: 8px !important; }
        .pdf-clone .grid { gap: 1px !important; }
        .pdf-clone .badge { font-size: 8px !important; padding: 2px 4px !important; }
        .pdf-clone .text-sm { font-size: 8px !important; }
        .pdf-clone .text-xs { font-size: 7px !important; }
      `;
      
      clone.className += ' pdf-clone';
      document.head.appendChild(style);
      document.body.appendChild(clone);
  
      // Generate canvas with higher quality settings
      const canvas = await html2canvas(clone, {
        scale: 1.5,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: 1200,
        height: clone.scrollHeight,
      });
  
      // Clean up
      document.body.removeChild(clone);
      document.head.removeChild(style);
  
      const imgData = canvas.toDataURL('image/png', 0.95);
      
      // Create PDF with optimized settings
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });
  
      const pageWidth = 297; // A4 landscape width
      const pageHeight = 210; // A4 landscape height
      const margin = 10;
      const imgWidth = pageWidth - (margin * 2);
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
  
      let position = margin;
      let remainingHeight = imgHeight;
      let pageCount = 1;
  
      // Add first page
      pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
  
      // Add additional pages if content is too long
      while (remainingHeight > (pageHeight - margin * 2)) {
        remainingHeight -= (pageHeight - margin * 2);
        pdf.addPage();
        pageCount++;
        
        const yOffset = -(pageCount - 1) * (pageHeight - margin * 2);
        pdf.addImage(imgData, 'PNG', margin, yOffset + margin, imgWidth, imgHeight);
      }
  
      const fileName = `${program.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_training_calendar.pdf`;
      pdf.save(fileName);
      
      toast({ title: 'PDF Downloaded!', description: `Your ${pageCount}-page training calendar has been saved.` });
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
