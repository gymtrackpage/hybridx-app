'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus } from 'lucide-react';
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
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { addSubscriber } from '@/lib/marketing/actions';

export function AddSubscriberDialog() {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ email: '', firstName: '', lastName: '', tags: '', consent: false });

  const reset = () =>
    setForm({ email: '', firstName: '', lastName: '', tags: '', consent: false });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const result = await addSubscriber({
      email: form.email,
      firstName: form.firstName || undefined,
      lastName: form.lastName || undefined,
      tags: form.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      consent: form.consent,
    });

    setSaving(false);

    if (result.success) {
      toast({
        title: result.data.created ? 'Subscriber added' : 'Subscriber updated',
        description: result.data.created
          ? form.email
          : `${form.email} was already on the list — tags merged.`,
      });
      reset();
      setOpen(false);
      router.refresh();
    } else {
      toast({ title: 'Could not add', description: result.error, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add subscriber
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add a subscriber</DialogTitle>
            <DialogDescription>
              Adding an existing address merges the tags rather than creating a duplicate.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="athlete@example.com"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="firstName">First name</Label>
                <Input
                  id="firstName"
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last name</Label>
                <Input
                  id="lastName"
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags</Label>
              <Input
                id="tags"
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                placeholder="vip, event-london, comma separated"
              />
            </div>

            <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
              <div className="space-y-1">
                <Label htmlFor="consent">Marketing consent</Label>
                <p className="text-xs text-muted-foreground">
                  Only enable this if they actively agreed to receive marketing email. Without it
                  they are on the list but no campaign will reach them.
                </p>
              </div>
              <Switch
                id="consent"
                checked={form.consent}
                onCheckedChange={(v) => setForm({ ...form, consent: v })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !form.email}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add subscriber
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
