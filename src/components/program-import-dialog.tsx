
'use client';
import { logger } from '@/lib/logger';

import { useState } from 'react';
import Papa from 'papaparse';
import { Loader2, UploadCloud, CheckCircle, AlertTriangle, FileText } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { Program, Workout, Exercise, RunningProgram, RunningWorkout, PlannedRun, PaceZone, ProgramType } from '@/models/types';
import { createProgram, getProgramClient, updateProgram } from '@/services/program-service-client';
import { isUnifiedCsv, rowsToProgram } from '@/lib/program-csv';

interface ProgramImportDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onSuccess: () => void;
}

interface HyroxCsvRow {
  programName: string;
  programDescription: string;
  workoutDay: string;
  workoutTitle: string;
  exerciseName: string;
  exerciseDetails: string;
}

interface RunningCsvRow {
  programName: string;
  programDescription: string;
  targetRace: string;
  workoutDay: string;
  workoutTitle: string;
  runType: string;
  noIntervals: string;
  runDistance: string;
  runPaceZone: string;
  runDescription: string;
  runEffortLevel: string;
}

type CsvRow = HyroxCsvRow | RunningCsvRow;


export function ProgramImportDialog({ isOpen, setIsOpen, onSuccess }: ProgramImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedProgram, setParsedProgram] = useState<Omit<Program, 'id'> | null>(null);
  const [targetProgramId, setTargetProgramId] = useState<string | null>(null);
  const [targetProgramName, setTargetProgramName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
      setParsedProgram(null);
      setTargetProgramId(null);
      setTargetProgramName(null);
      parseCsv(selectedFile);
    }
  };

  const resolveTargetProgram = async (rawId: string | undefined) => {
    const id = (rawId ?? '').trim();
    if (!id) {
      setTargetProgramId(null);
      setTargetProgramName(null);
      return;
    }
    try {
      const existing = await getProgramClient(id);
      if (existing) {
        setTargetProgramId(id);
        setTargetProgramName(existing.name);
      } else {
        setTargetProgramId(null);
        setTargetProgramName(null);
        toast({
          title: 'Program not found',
          description: `No program with id "${id}" exists. A new program will be created instead.`,
        });
      }
    } catch (err) {
      logger.error('Failed to look up existing program:', err);
      setTargetProgramId(null);
      setTargetProgramName(null);
    }
  };

  const parseCsv = (csvFile: File) => {
    setIsLoading(true);
    Papa.parse<Record<string, string>>(csvFile, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        if (results.errors.length > 0) {
          setError('Failed to parse CSV. Please check the file format and headers.');
          logger.error('CSV parsing errors:', results.errors);
          setIsLoading(false);
          return;
        }
        try {
          const rows = results.data;
          const headers = results.meta.fields ?? [];

          if (isUnifiedCsv(headers)) {
            const { id, data } = rowsToProgram(rows);
            setParsedProgram(data);
            await resolveTargetProgram(id);
          } else {
            // Legacy formats: detect running vs hyrox by run-specific columns.
            const isRunningProgram = headers.includes('runType') && headers.includes('runPaceZone');
            const program = isRunningProgram
              ? transformRunningData(rows as unknown as RunningCsvRow[])
              : transformHyroxData(rows as unknown as HyroxCsvRow[]);
            setParsedProgram(program);
            // Even legacy CSVs may carry an `id` column from a hand edit.
            await resolveTargetProgram(rows[0]?.id);
          }
        } catch (e: any) {
          setError(e.message);
        } finally {
          setIsLoading(false);
        }
      },
      error: (err) => {
        setError('An error occurred while reading the file.');
        logger.error(err);
        setIsLoading(false);
      },
    });
  };
  
  const transformHyroxData = (rows: HyroxCsvRow[]): Omit<Program, 'id'> => {
      if (rows.length === 0) throw new Error('CSV is empty.');
      const { programName, programDescription } = rows[0];
      if (!programName || !programDescription) throw new Error('CSV must contain programName and programDescription.');

      const workoutsMap = new Map<number, Workout>();

      rows.forEach(row => {
          const day = parseInt(row.workoutDay, 10);
          if (isNaN(day)) throw new Error(`Invalid workoutDay found: ${row.workoutDay}`);
          
          const { workoutTitle, exerciseName, exerciseDetails } = row;
          if (!workoutTitle || !exerciseName || !exerciseDetails) throw new Error('All hyrox workout fields are required.');

          const exercise: Exercise = { name: exerciseName, details: exerciseDetails };
          
          if (workoutsMap.has(day)) {
              workoutsMap.get(day)!.exercises.push(exercise);
          } else {
              workoutsMap.set(day, { day, title: workoutTitle, exercises: [exercise], runs: [] });
          }
      });
      
      return {
          name: programName,
          description: programDescription,
          programType: 'hyrox',
          workouts: Array.from(workoutsMap.values()).sort((a, b) => a.day - b.day),
      };
  }
  
  const transformRunningData = (rows: RunningCsvRow[]): Omit<RunningProgram, 'id'> => {
      if (rows.length === 0) throw new Error('CSV is empty.');
      const { programName, programDescription, targetRace } = rows[0];
      if (!programName || !programDescription || !targetRace) throw new Error('Running CSV must contain programName, programDescription, and targetRace.');

      const workoutsMap = new Map<number, RunningWorkout>();

      rows.forEach(row => {
          const day = parseInt(row.workoutDay, 10);
          if (isNaN(day)) throw new Error(`Invalid workoutDay found: ${row.workoutDay}`);
          
          const { workoutTitle, runType, noIntervals, runDistance, runPaceZone, runDescription, runEffortLevel } = row;
          if (!workoutTitle || !runType || !runDistance || !runPaceZone || !runDescription || !runEffortLevel) {
              throw new Error('All running workout fields are required for each row.');
          }

          const plannedRun: PlannedRun = {
              type: runType as PlannedRun['type'],
              distance: parseFloat(runDistance),
              paceZone: runPaceZone as PaceZone,
              description: runDescription,
              effortLevel: parseInt(runEffortLevel, 10) as PlannedRun['effortLevel'],
              noIntervals: noIntervals ? parseInt(noIntervals, 10) : undefined,
          };
          
          if (workoutsMap.has(day)) {
              workoutsMap.get(day)!.runs.push(plannedRun);
          } else {
              workoutsMap.set(day, {
                  day,
                  title: workoutTitle,
                  runs: [plannedRun],
                  exercises: [],
              });
          }
      });
      
      return {
          name: programName,
          description: programDescription,
          programType: 'running',
          targetRace: targetRace as RunningProgram['targetRace'],
          workouts: Array.from(workoutsMap.values()).sort((a, b) => a.day - b.day),
      };
  }

  const handleImport = async () => {
    if (!parsedProgram) return;

    setIsLoading(true);
    try {
      if (targetProgramId) {
        await updateProgram(targetProgramId, parsedProgram);
        toast({
          title: 'Program updated',
          description: `"${parsedProgram.name}" has been updated successfully.`,
        });
      } else {
        await createProgram(parsedProgram);
        toast({
          title: 'Program created',
          description: `"${parsedProgram.name}" has been imported successfully.`,
        });
      }
      onSuccess();
      resetState();
    } catch (err) {
      logger.error('Failed to import program:', err);
      toast({
        title: 'Error',
        description: 'Failed to save the imported program.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetState = () => {
    setFile(null);
    setParsedProgram(null);
    setTargetProgramId(null);
    setTargetProgramName(null);
    setError(null);
    setIsLoading(false);
  }

  const handleOpenChange = (open: boolean) => {
      if (!open) {
          resetState();
      }
      setIsOpen(open);
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import Program from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file to create a new training program, or upload an exported program file to update an existing one.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
            <label htmlFor="csv-upload" className="block text-sm font-medium text-foreground mb-2">
                CSV File
            </label>
            <div className="flex items-center justify-center w-full">
                <label
                    htmlFor="file-upload"
                    className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer bg-card hover:bg-muted"
                >
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        {isLoading ? (
                            <>
                                <Loader2 className="w-8 h-8 mb-4 text-muted-foreground animate-spin" />
                                <p className="mb-2 text-sm text-muted-foreground">Processing...</p>
                            </>
                        ) : file ? (
                            <>
                                <FileText className="w-8 h-8 mb-4 text-primary" />
                                <p className="mb-2 text-sm text-foreground">{file.name}</p>
                                <p className="text-xs text-muted-foreground">Click to choose a different file</p>
                            </>
                        ) : (
                             <>
                                <UploadCloud className="w-8 h-8 mb-4 text-muted-foreground" />
                                <p className="mb-2 text-sm text-muted-foreground">
                                    <span className="font-semibold">Click to upload</span> or drag and drop
                                </p>
                                <p className="text-xs text-muted-foreground">CSV file up to 1MB</p>
                            </>
                        )}
                    </div>
                    <input id="file-upload" type="file" className="hidden" accept=".csv" onChange={handleFileChange} disabled={isLoading} />
                </label>
            </div>

            {error && (
                <div className="flex items-center gap-2 p-3 text-sm rounded-md bg-destructive/10 text-destructive">
                    <AlertTriangle className="w-4 h-4" />
                    <p>{error}</p>
                </div>
            )}

            {parsedProgram && (
                <div className="p-4 border rounded-md bg-card">
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                        {targetProgramId ? 'Will update existing program' : 'Will create new program'}
                    </h4>
                    {targetProgramId && targetProgramName && (
                        <p className="text-sm text-muted-foreground mb-2">
                            Replacing <strong>{targetProgramName}</strong> (id: <code className="text-xs">{targetProgramId}</code>) with the contents of this file.
                        </p>
                    )}
                    <p className="text-sm"><strong>Name:</strong> {parsedProgram.name}</p>
                    <p className="text-sm"><strong>Type:</strong> <span className="capitalize">{parsedProgram.programType}</span></p>
                    <p className="text-sm text-muted-foreground"><strong>Description:</strong> {parsedProgram.description}</p>
                    <p className="text-sm mt-2">
                        Found <strong>{parsedProgram.workouts.length} unique workout day(s)</strong>.
                    </p>
                </div>
            )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleOpenChange(false)}>Cancel</Button>
          <Button onClick={handleImport} disabled={!parsedProgram || isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {targetProgramId ? 'Update Program' : 'Import Program'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
