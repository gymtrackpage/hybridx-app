'use client';
// src/components/program-audience-picker.tsx
// Chooses who a program is for: everyone, or a named set of athletes.
// Shared by the CSV import dialog (at upload time) and the "Manage access"
// dialog on the admin programs table (afterwards).

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search, Users, UserCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { getAllUsersClient } from '@/services/user-service-client';
import type { ProgramVisibility, User } from '@/models/types';
import { cn } from '@/lib/utils';

interface ProgramAudiencePickerProps {
  visibility: ProgramVisibility;
  onVisibilityChange: (visibility: ProgramVisibility) => void;
  selectedUserIds: string[];
  onSelectedUserIdsChange: (userIds: string[]) => void;
  /** Athletes kept on the program because it is their active plan. Shown so an
   *  admin understands why someone still has access after being removed. */
  retainedUserIds?: string[];
  disabled?: boolean;
}

function displayName(user: User): string {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return name || user.email || user.id;
}

export function ProgramAudiencePicker({
  visibility,
  onVisibilityChange,
  selectedUserIds,
  onSelectedUserIdsChange,
  retainedUserIds = [],
  disabled = false,
}: ProgramAudiencePickerProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Only fetch the athlete list once the admin actually chooses "specific
  // athletes" — the public case never needs it.
  useEffect(() => {
    if (visibility !== 'custom' || users.length > 0 || loading) return;

    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    getAllUsersClient()
      .then(fetched => {
        if (!cancelled) setUsers(fetched);
      })
      .catch(err => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Failed to load athletes.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [visibility, users.length, loading]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const sorted = [...users].sort((a, b) => displayName(a).localeCompare(displayName(b)));
    if (!term) return sorted;
    return sorted.filter(u =>
      displayName(u).toLowerCase().includes(term) || (u.email ?? '').toLowerCase().includes(term),
    );
  }, [users, search]);

  const selected = useMemo(() => new Set(selectedUserIds), [selectedUserIds]);
  const retained = useMemo(() => new Set(retainedUserIds), [retainedUserIds]);

  const toggle = (userId: string) => {
    if (disabled) return;
    const next = new Set(selected);
    if (next.has(userId)) next.delete(userId);
    else next.add(userId);
    onSelectedUserIdsChange(Array.from(next));
  };

  return (
    <div className="space-y-4">
      <RadioGroup
        value={visibility}
        onValueChange={value => onVisibilityChange(value as ProgramVisibility)}
        disabled={disabled}
        className="grid gap-2"
      >
        <Label
          htmlFor="visibility-public"
          className={cn(
            'flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors',
            visibility === 'public' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50',
          )}
        >
          <RadioGroupItem value="public" id="visibility-public" className="mt-0.5" />
          <div className="space-y-0.5">
            <p className="text-sm font-medium flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> Everyone
            </p>
            <p className="text-xs text-muted-foreground">
              Appears in the program list for every athlete.
            </p>
          </div>
        </Label>

        <Label
          htmlFor="visibility-custom"
          className={cn(
            'flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors',
            visibility === 'custom' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50',
          )}
        >
          <RadioGroupItem value="custom" id="visibility-custom" className="mt-0.5" />
          <div className="space-y-0.5">
            <p className="text-sm font-medium flex items-center gap-1.5">
              <UserCheck className="h-3.5 w-3.5" /> Specific athletes
            </p>
            <p className="text-xs text-muted-foreground">
              Only the athletes you choose can see and start it.
            </p>
          </div>
        </Label>
      </RadioGroup>

      {visibility === 'custom' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Assigned athletes</Label>
            <Badge variant="outline" className="text-xs">
              {selectedUserIds.length} selected
            </Badge>
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8"
              disabled={disabled || loading}
            />
          </div>

          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading athletes…
            </div>
          )}

          {loadError && (
            <p className="text-sm text-destructive py-2">{loadError}</p>
          )}

          {!loading && !loadError && (
            <ScrollArea className="h-56 rounded-md border">
              <div className="p-1">
                {filtered.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No athletes match that search.</p>
                ) : (
                  filtered.map(user => (
                    <label
                      key={user.id}
                      className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/60 cursor-pointer"
                    >
                      <Checkbox
                        checked={selected.has(user.id)}
                        onCheckedChange={() => toggle(user.id)}
                        disabled={disabled}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{displayName(user)}</p>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      </div>
                      {retained.has(user.id) && !selected.has(user.id) && (
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          still training on it
                        </Badge>
                      )}
                    </label>
                  ))
                )}
              </div>
            </ScrollArea>
          )}

          {selectedUserIds.length === 0 && !loading && (
            <p className="text-xs text-muted-foreground">
              Pick at least one athlete — a custom program with nobody assigned would be invisible to everyone.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
