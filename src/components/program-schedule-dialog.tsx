'use client';

import { useState } from 'react';
import { format, addDays } from 'date-fns';
import { Calendar as CalendarIcon, Loader2 } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import type { Program } from '@/models/types';
import { cn } from '@/lib/utils';
import { ScrollArea } from './ui/scroll-area';

interface ProgramScheduleDialogProps {
  program: Program | null;
  isOpen: boolean;
  onClose: () => void;
  onSchedule: (programId: string, startDate: Date) => void;
  isScheduling: boolean;
}

export function ProgramScheduleDialog({
  program,
  isOpen,
  onClose,
  onSchedule,
  isScheduling,
}: ProgramScheduleDialogProps) {
  const [startDate, setStartDate] = useState<Date | undefined>(new Date());

  const handleSchedule = () => {
    if (program && startDate) {
      onSchedule(program.id, startDate);
    }
  };
  
  const handleStartToday = () => {
      const today = new Date();
      setStartDate(today);
      if (program) {
        onSchedule(program.id, today);
      }
  }

  if (!program) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{program.name}</DialogTitle>
          <DialogDescription>{program.description}</DialogDescription>
        </DialogHeader>

        <div className="my-4">
            <h4 className="font-semibold mb-2">Weekly Workout Schedule</h4>
            <ScrollArea className="h-64 pr-4">
            <Accordion type="single" collapsible className="w-full">
                {program.workouts.map((workout) => (
                    <AccordionItem value={`day-${workout.day}`} key={workout.day}>
                        <AccordionTrigger>Day {workout.day}: {workout.title}</AccordionTrigger>
                        <AccordionContent>
                            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                                {workout.exercises.map((exercise, index) => (
                                    <li key={index}>
                                        <span className="font-medium text-foreground">{exercise.name}:</span> {exercise.details}
                                    </li>
                                ))}
                            </ul>
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
            </ScrollArea>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
            <div className="flex items-center gap-2">
                 <Popover>
                    <PopoverTrigger asChild>
                    <Button
                        variant={"outline"}
                        className={cn(
                        "w-[280px] justify-start text-left font-normal",
                        !startDate && "text-muted-foreground"
                        )}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, "PPP") : <span>Pick a start date</span>}
                    </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                    <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={setStartDate}
                        initialFocus
                    />
                    </PopoverContent>
                </Popover>
                <Button onClick={handleSchedule} disabled={isScheduling || !startDate}>
                    {isScheduling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Schedule
                </Button>
            </div>
             <Button onClick={handleStartToday} disabled={isScheduling} className="sm:ml-auto">
                {isScheduling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Start Today
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
