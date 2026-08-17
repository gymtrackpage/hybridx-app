'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, Sparkles } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { createCampaign } from '@/lib/marketing/actions';

/**
 * Creates a blank campaign and opens the editor.
 *
 * Deliberately offered alongside a link to the studio: the studio is the better
 * route for anything with a goal behind it, and starting blank is for the cases
 * where the copy already exists in someone's head.
 */
export function NewCampaignButton() {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    setCreating(true);
    const result = await createCampaign({ subject: subject.trim() || 'Untitled campaign' });
    setCreating(false);

    if (result.success) {
      setOpen(false);
      router.push(`/admin/marketing/campaigns/${result.data.id}/edit`);
    } else {
      toast({ title: 'Could not create', description: result.error, variant: 'destructive' });
    }
  };

  return (
    <div className="flex gap-2">
      <Button asChild variant="outline">
        <a href="/admin/marketing/studio">
          <Sparkles className="mr-2 h-4 w-4" />
          Use the studio
        </a>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Blank campaign
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New campaign</DialogTitle>
            <DialogDescription>
              Starts an empty draft. Nothing sends until you choose an audience and send it.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-4">
            <Label htmlFor="new-subject">Subject line</Label>
            <Input
              id="new-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Your HYROX race plan is ready"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleCreate();
                }
              }}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create and edit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
