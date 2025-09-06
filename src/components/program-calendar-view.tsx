// src/components/program-calendar-view.tsx
import type { Program } from '@/models/types';
import { Logo } from '@/components/icons';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';

interface ProgramCalendarViewProps {
  program: Program;
}

export function ProgramCalendarView({ program }: ProgramCalendarViewProps) {
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const workoutsByDay = new Map(program.workouts.map(w => [w.day, w]));
  const maxDay = program.workouts.reduce((max, w) => Math.max(max, w.day), 0);
  const totalWeeks = Math.ceil(maxDay / 7);

  return (
    <div className="print-container bg-background text-foreground font-sans p-4 sm:p-8 rounded-lg border shadow-sm">
       <style jsx global>{`
        @media print {
          @page { 
            size: A4 landscape; 
            margin: 15mm; 
          }
          body { 
            -webkit-print-color-adjust: exact; 
            print-color-adjust: exact;
            margin: 0;
            padding: 0;
          }
          .print-container { 
            width: 100%; 
            margin: 0; 
            padding: 10mm;
            border: none; 
            box-shadow: none; 
            background: white !important;
          }
          .day-cell { 
            page-break-inside: avoid; 
            border: 1px solid #333 !important; 
            background: white !important;
            min-height: 120px;
            font-size: 0.75rem;
          }
          .grid {
             gap: 1px !important;
          }
        }
      `}</style>
      
      <header className="mb-6 flex flex-col sm:flex-row justify-between items-start gap-4">
        <div>
          <h1 className="text-3xl font-bold font-headline">{program.name}</h1>
          <p className="text-muted-foreground max-w-2xl mt-1">{program.description}</p>
        </div>
        <div className="flex items-center gap-2 text-primary shrink-0">
            <Logo className="h-8 w-8 text-primary" />
          <span className="text-lg font-semibold font-headline">HYBRIDX.CLUB</span>
        </div>
      </header>

      <Separator className="mb-6" />

      {Array.from({ length: totalWeeks }).map((_, weekIndex) => {
        const weekNumber = weekIndex + 1;
        return (
          <div key={`week-${weekNumber}`} className="mb-6">
            <h2 className="text-xl font-bold mb-3 font-headline">Week {weekNumber}</h2>
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: 7 }).map((_, dayIndex) => {
                const dayNumberInGrid = weekIndex * 7 + dayIndex + 1;
                const workout = dayNumberInGrid <= maxDay ? workoutsByDay.get(dayNumberInGrid) : null;
                const isRestDay = workout?.title.toLowerCase().includes('rest') || workout?.title.toLowerCase().includes('recovery');
                
                return (
                  <div
                    key={`day-${dayNumberInGrid}`}
                    className="day-cell border rounded-lg p-3 min-h-[150px] flex flex-col bg-card"
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-semibold">{dayNames[dayIndex]}</span>
                      {dayNumberInGrid <= maxDay && (
                         <Badge variant="secondary" className="text-xs">{dayNumberInGrid}</Badge>
                      )}
                    </div>

                    {workout ? (
                      isRestDay ? (
                        <div className="flex-grow flex items-center justify-center">
                          <p className="text-sm font-medium text-muted-foreground">{workout.title}</p>
                        </div>
                      ) : (
                        <div className="flex-grow space-y-2">
                          <h3 className="text-sm font-semibold text-primary">{workout.title}</h3>
                          <ul className="space-y-1.5 text-xs text-muted-foreground">
                            {workout.exercises.map((exercise, i) => (
                              <li key={i}>
                                <strong className="text-foreground/90">{exercise.name}:</strong> {exercise.details}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )
                    ) : (
                      <div className="flex-grow"></div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
