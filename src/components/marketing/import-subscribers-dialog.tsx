'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Papa from 'papaparse';
import { AlertTriangle, Loader2, Upload } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { importSubscribers } from '@/lib/marketing/actions';

const NONE = '__none__';

/** Guess a column by common header names, so the usual export just works. */
function guessColumn(headers: string[], candidates: string[]): string {
  const found = headers.find((h) => candidates.includes(h.trim().toLowerCase()));
  return found ?? NONE;
}

export function ImportSubscribersDialog() {
  const router = useRouter();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState({ email: NONE, firstName: NONE, lastName: NONE });
  const [tag, setTag] = useState('');
  const [consent, setConsent] = useState(false);
  const [importing, setImporting] = useState(false);

  const reset = () => {
    setRows([]);
    setHeaders([]);
    setMapping({ email: NONE, firstName: NONE, lastName: NONE });
    setTag('');
    setConsent(false);
  };

  const handleFile = (file: File) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const cols = result.meta.fields ?? [];
        setHeaders(cols);
        setRows(result.data);
        setMapping({
          email: guessColumn(cols, ['email', 'email address', 'e-mail']),
          firstName: guessColumn(cols, ['first name', 'firstname', 'first', 'given name']),
          lastName: guessColumn(cols, ['last name', 'lastname', 'last', 'surname']),
        });
      },
      error: () => toast({ title: 'Could not read that file', variant: 'destructive' }),
    });
  };

  const handleImport = async () => {
    if (mapping.email === NONE) return;
    setImporting(true);

    const payload = rows
      .map((row) => ({
        email: row[mapping.email]?.trim() ?? '',
        firstName: mapping.firstName !== NONE ? row[mapping.firstName]?.trim() : undefined,
        lastName: mapping.lastName !== NONE ? row[mapping.lastName]?.trim() : undefined,
      }))
      .filter((r) => r.email);

    const result = await importSubscribers(payload, {
      consent,
      extraTag: tag.trim() || undefined,
    });
    setImporting(false);

    if (result.success) {
      toast({
        title: 'Import complete',
        description: `${result.data.added} added, ${result.data.merged} merged, ${result.data.skipped} skipped.`,
      });
      reset();
      setOpen(false);
      router.refresh();
    } else {
      toast({ title: 'Import failed', description: result.error, variant: 'destructive' });
    }
  };

  const validRows = mapping.email === NONE
    ? 0
    : rows.filter((r) => r[mapping.email]?.trim()).length;

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full sm:w-auto">
          <Upload className="mr-2 h-4 w-4" />
          Import CSV
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[85dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto sm:w-full">
        <DialogHeader>
          <DialogTitle>Import subscribers</DialogTitle>
          <DialogDescription>
            Addresses already on the list are merged, not duplicated.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="csv-file">CSV file</Label>
            <Input
              id="csv-file"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </div>

          {headers.length > 0 && (
            <>
              <p className="text-sm text-muted-foreground">
                {rows.length.toLocaleString()} rows read. Map the columns:
              </p>

              <div className="space-y-3">
                {(
                  [
                    ['email', 'Email (required)'],
                    ['firstName', 'First name'],
                    ['lastName', 'Last name'],
                  ] as const
                ).map(([field, label]) => (
                  <div key={field} className="grid gap-1.5 sm:grid-cols-2 sm:items-center sm:gap-3">
                    <Label className="text-sm">{label}</Label>
                    <Select
                      value={mapping[field]}
                      onValueChange={(v) => setMapping({ ...mapping, [field]: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a column" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Not in this file</SelectItem>
                        {headers.map((h) => (
                          <SelectItem key={h} value={h}>
                            {h}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label htmlFor="import-tag">Tag these contacts</Label>
                <Input
                  id="import-tag"
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                  placeholder="e.g. event-london-2026"
                />
              </div>

              {/* Consent is an explicit declaration, not a default. An imported
                  list without a lawful basis is the fastest way to damage a
                  sending domain, and the person clicking Import is the only one
                  who knows where the file came from. */}
              <div className="flex items-start gap-3 rounded-lg border p-3">
                <Checkbox
                  id="import-consent"
                  checked={consent}
                  onCheckedChange={(v) => setConsent(v === true)}
                  className="mt-0.5"
                />
                <Label htmlFor="import-consent" className="text-sm font-normal leading-relaxed">
                  These people actively opted in to marketing email from HYBRIDX, and I can
                  evidence when and how. Without this they are added to the list but no campaign
                  will reach them.
                </Label>
              </div>

              {!consent && validRows > 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Importing without consent</AlertTitle>
                  <AlertDescription>
                    The {validRows.toLocaleString()} contacts will be stored and taggable, but
                    excluded from every send until they opt in.
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={importing || validRows === 0}>
            {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Import {validRows > 0 ? validRows.toLocaleString() : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
