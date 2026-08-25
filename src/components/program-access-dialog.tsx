'use client';
// src/components/program-access-dialog.tsx
// Edits who an existing program applies to. Saving goes through
// /api/admin/programs/assignments, which is the only place that can tell
// whether a removed athlete is mid-program (it needs to read their user doc).

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ProgramAudiencePicker } from '@/components/program-audience-picker';
import type { Program, ProgramVisibility } from '@/models/types';

interface ProgramAccessDialogProps {
  program: Program | null;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onSuccess: () => void;
}

export function ProgramAccessDialog({ program, isOpen, setIsOpen, onSuccess }: ProgramAccessDialogProps) {
  const [visibility, setVisibility] = useState<ProgramVisibility>('public');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!program) return;
    setVisibility(program.visibility === 'custom' ? 'custom' : 'public');
    setSelectedUserIds(program.assignedUserIds ?? []);
  }, [program]);

  const handleSave = async () => {
    if (!program) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/programs/assignments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ programId: program.id, visibility, assignedUserIds: selectedUserIds }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Failed to update program access.');

      const retained: string[] = body.retainedFromThisChange ?? [];
      toast({
        title: 'Access updated',
        description:
          visibility === 'public'
            ? `"${program.name}" is now available to everyone.`
            : retained.length > 0
              ? `${selectedUserIds.length} athlete(s) assigned. ${retained.length} removed athlete(s) kept access because it is their active plan.`
              : `${selectedUserIds.length} athlete(s) can now see "${program.name}".`,
      });
      onSuccess();
      setIsOpen(false);
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to update program access.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const nothingSelected = visibility === 'custom' && selectedUserIds.length === 0;

  return (
    <Dialog open={isOpen} onOpenChange={open => !saving && setIsOpen(open)}>
      <DialogContent className="max-h-[85dvh] w-[calc(100%-1.5rem)] max-w-lg overflow-y-auto sm:w-full">
        <DialogHeader>
          <DialogTitle>Manage access</DialogTitle>
          <DialogDescription>
            Choose who {program ? `"${program.name}"` : 'this program'} is available to.
          </DialogDescription>
        </DialogHeader>

        <ProgramAudiencePicker
          visibility={visibility}
          onVisibilityChange={setVisibility}
          selectedUserIds={selectedUserIds}
          onSelectedUserIdsChange={setSelectedUserIds}
          retainedUserIds={program?.retainedUserIds}
          disabled={saving}
        />

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => setIsOpen(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || nothingSelected}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save access
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
