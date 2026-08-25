'use client';

import { useEffect, useState } from 'react';
import { PlusCircle, MoreHorizontal, Trash2, Edit, Upload, Users, UserCheck } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  getAllPrograms,
  getAllCustomPrograms,
  deleteProgram,
  deleteCustomProgram,
} from '@/services/program-service-client';
import { Badge } from '@/components/ui/badge';
import { ProgramAccessDialog } from '@/components/program-access-dialog';
import { isCustomProgram } from '@/lib/program-visibility';
import type { Program } from '@/models/types';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ProgramForm } from '@/components/program-form';
import { ProgramImportDialog } from '@/components/program-import-dialog';
import { ProgramExportButton } from '@/components/program-export-button';


export default function AdminProgramsPage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const [accessProgram, setAccessProgram] = useState<Program | null>(null);
  const [isAccessOpen, setIsAccessOpen] = useState(false);
  const { toast } = useToast();

  const fetchPrograms = async () => {
    setLoading(true);
    try {
      // Custom programs live in their own collection so the public listing can
      // stay an unrestricted query — admins see both here.
      const [publicPrograms, customPrograms] = await Promise.all([
        getAllPrograms(),
        getAllCustomPrograms(),
      ]);
      setPrograms([...publicPrograms, ...customPrograms]);
    } catch (error) {
      console.error('Failed to fetch programs:', error);
      toast({
        title: 'Error',
        description: 'Failed to load training programs.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrograms();
  }, []);
  
  const handleEdit = (program: Program) => {
    setSelectedProgram(program);
    setIsFormOpen(true);
  };
  
  const handleAddNew = () => {
    setSelectedProgram(null);
    setIsFormOpen(true);
  };

  const handleManageAccess = (program: Program) => {
    setAccessProgram(program);
    setIsAccessOpen(true);
  };

  const handleDelete = async (program: Program) => {
    try {
      if (isCustomProgram(program)) {
        await deleteCustomProgram(program.id);
      } else {
        await deleteProgram(program.id);
      }
      toast({
        title: 'Success',
        description: 'Program deleted successfully.',
      });
      fetchPrograms(); // Refresh the list
    } catch (error) {
      console.error('Failed to delete program:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete the program.',
        variant: 'destructive',
      });
    }
  };
  
  const handleFormSuccess = () => {
    setIsFormOpen(false);
    setSelectedProgram(null);
    fetchPrograms();
  }
  
  const handleImportSuccess = () => {
    setIsImportOpen(false);
    fetchPrograms();
  }

  const rowActions = (program: Program) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 w-9 shrink-0 p-0">
          <span className="sr-only">Open menu</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleEdit(program)}>
          <Edit className="mr-2 h-4 w-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleManageAccess(program)}>
          <UserCheck className="mr-2 h-4 w-4" />
          Manage access
        </DropdownMenuItem>
        <ProgramExportButton program={program} />
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
            </DropdownMenuItem>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the program.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => handleDelete(program)}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const availabilityBadge = (program: Program) =>
    isCustomProgram(program) ? (
      <Badge variant="outline" className="gap-1.5 font-normal">
        <UserCheck className="h-3 w-3" />
        {(program.assignedUserIds ?? []).length} athlete(s)
      </Badge>
    ) : (
      <Badge variant="secondary" className="gap-1.5 font-normal">
        <Users className="h-3 w-3" />
        Everyone
      </Badge>
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Manage Programs</h1>
          <p className="text-sm text-muted-foreground sm:text-base">Add, edit, or remove training programs.</p>
        </div>
        {/* Two equal columns on a phone keeps both actions reachable with a
            thumb instead of squeezing them against the title. */}
        <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
            <Button variant="outline" onClick={() => setIsImportOpen(true)}>
                <Upload className="mr-2 h-4 w-4" />
                <span className="sm:hidden">Import CSV</span>
                <span className="hidden sm:inline">Import from CSV</span>
            </Button>
            <Button onClick={handleAddNew}>
            <PlusCircle className="mr-2 h-4 w-4" />
            <span className="sm:hidden">Add Program</span>
            <span className="hidden sm:inline">Add New Program</span>
            </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle>Existing Programs</CardTitle>
          <CardDescription>A list of all available training programs in the system.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:p-6 sm:pt-0">
          {/* Phones get a stacked list; the 4-column table returns at md, where
              there is room for it. */}
          <div className="divide-y border-t md:hidden">
            {loading ? (
              <p className="p-4 text-center text-sm text-muted-foreground">Loading programs...</p>
            ) : programs.length > 0 ? (
              programs.map((program) => (
                <div key={program.id} className="flex items-start gap-3 p-4">
                  <div className="min-w-0 flex-1 space-y-2">
                    <p className="font-medium leading-snug">{program.name}</p>
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {program.description}
                    </p>
                    {availabilityBadge(program)}
                  </div>
                  {rowActions(program)}
                </div>
              ))
            ) : (
              <p className="p-4 text-center text-sm text-muted-foreground">No programs found.</p>
            )}
          </div>

          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-[170px]">Available to</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center">
                      Loading programs...
                    </TableCell>
                  </TableRow>
                ) : programs.length > 0 ? (
                  programs.map((program) => (
                    <TableRow key={program.id}>
                      <TableCell className="font-medium">{program.name}</TableCell>
                      <TableCell className="text-muted-foreground max-w-md truncate">{program.description}</TableCell>
                      <TableCell>{availabilityBadge(program)}</TableCell>
                      <TableCell>{rowActions(program)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center">
                      No programs found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      
      <ProgramForm
        isOpen={isFormOpen}
        setIsOpen={setIsFormOpen}
        program={selectedProgram}
        onSuccess={handleFormSuccess}
      />
      <ProgramImportDialog
        isOpen={isImportOpen}
        setIsOpen={setIsImportOpen}
        onSuccess={handleImportSuccess}
       />
      <ProgramAccessDialog
        program={accessProgram}
        isOpen={isAccessOpen}
        setIsOpen={setIsAccessOpen}
        onSuccess={fetchPrograms}
      />
    </div>
  );
}
