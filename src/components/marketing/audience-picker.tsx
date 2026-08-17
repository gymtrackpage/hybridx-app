'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDebounce } from 'use-debounce';
import { previewAudience } from '@/lib/marketing/actions';
import type { SegmentDefinition } from '@/lib/marketing/segments';

const SUBSCRIPTION_OPTIONS = [
  { value: 'any', label: 'Any subscription status' },
  { value: 'trial', label: 'On a free trial' },
  { value: 'active', label: 'Paying subscribers' },
  { value: 'expired', label: 'Expired' },
  { value: 'canceled', label: 'Cancelled' },
  { value: 'paused', label: 'Paused' },
] as const;

const ENGAGEMENT_OPTIONS = [
  { value: 'any', label: 'Any engagement' },
  { value: 'never', label: 'Never logged a workout' },
  { value: 'started', label: 'Has logged at least one workout' },
] as const;

interface Props {
  tags: Array<{ tag: string; count: number }>;
  value: SegmentDefinition;
  onChange: (segment: SegmentDefinition) => void;
  disabled?: boolean;
}

/**
 * Builds a segment and shows how many people it currently reaches.
 *
 * The live count matters more than it looks: an audience described only in
 * words is the easiest way to send a campaign to far more — or far fewer —
 * people than intended. The count comes from the same resolver the send uses,
 * so what is shown here is what will be mailed.
 */
export function AudiencePicker({ tags, value, onChange, disabled }: Props) {
  const [count, setCount] = useState<number | null>(null);
  const [sample, setSample] = useState<string[]>([]);
  const [excluded, setExcluded] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  // Debounced so dragging a number field does not fire a resolve per keystroke.
  const [debounced] = useDebounce(value, 500);

  const refresh = useCallback(async (segment: SegmentDefinition) => {
    setLoading(true);
    const result = await previewAudience(segment);
    setLoading(false);

    if (result.success) {
      setCount(result.data.size);
      setSample(result.data.sample);
      setExcluded(result.data.excluded);
    } else {
      setCount(null);
    }
  }, []);

  useEffect(() => {
    void refresh(debounced);
  }, [debounced, refresh]);

  const selectedTag = value.anyTags?.[0] ?? 'all';
  const subscription = value.athlete?.subscriptionStatus?.[0] ?? 'any';
  const engagement =
    value.athlete?.maxCompletedWorkouts === 0
      ? 'never'
      : value.athlete?.minCompletedWorkouts === 1
        ? 'started'
        : 'any';

  /** Rebuild the segment, dropping empty predicate objects so `{}` means "everyone". */
  const update = (patch: {
    tag?: string;
    subscription?: string;
    engagement?: string;
    inactiveForDays?: number | undefined;
  }) => {
    const nextTag = patch.tag ?? selectedTag;
    const nextSubscription = patch.subscription ?? subscription;
    const nextEngagement = patch.engagement ?? engagement;
    const nextInactive =
      'inactiveForDays' in patch ? patch.inactiveForDays : value.athlete?.inactiveForDays;

    const athlete: NonNullable<SegmentDefinition['athlete']> = {};
    if (nextSubscription !== 'any') {
      athlete.subscriptionStatus = [
        nextSubscription as NonNullable<
          NonNullable<SegmentDefinition['athlete']>['subscriptionStatus']
        >[number],
      ];
    }
    if (nextEngagement === 'never') athlete.maxCompletedWorkouts = 0;
    if (nextEngagement === 'started') athlete.minCompletedWorkouts = 1;
    if (nextInactive !== undefined && nextInactive > 0) athlete.inactiveForDays = nextInactive;

    onChange({
      ...(nextTag !== 'all' ? { anyTags: [nextTag] } : {}),
      ...(Object.keys(athlete).length ? { athlete } : {}),
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Tag</Label>
          <Select
            value={selectedTag}
            onValueChange={(tag) => update({ tag })}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Everyone on the list</SelectItem>
              {tags.map((t) => (
                <SelectItem key={t.tag} value={t.tag}>
                  {t.tag} ({t.count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Subscription</Label>
          <Select
            value={subscription}
            onValueChange={(v) => update({ subscription: v })}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUBSCRIPTION_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Training</Label>
          <Select
            value={engagement}
            onValueChange={(v) => update({ engagement: v })}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ENGAGEMENT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="inactive-days">Inactive for at least (days)</Label>
          <Input
            id="inactive-days"
            type="number"
            min={0}
            placeholder="Any"
            disabled={disabled}
            value={value.athlete?.inactiveForDays ?? ''}
            onChange={(e) =>
              update({
                inactiveForDays: e.target.value ? Number(e.target.value) : undefined,
              })
            }
          />
        </div>
      </div>

      <div className="rounded-lg border bg-muted/40 p-3">
        <div className="flex items-center gap-2">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <Users className="h-4 w-4 text-muted-foreground" />
          )}
          <p className="text-sm font-medium">
            {count === null
              ? 'Could not resolve this audience'
              : `${count.toLocaleString()} ${count === 1 ? 'person' : 'people'} will receive this`}
          </p>
        </div>

        {sample.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            e.g. {sample.slice(0, 3).join(', ')}
            {count && count > 3 ? ` and ${(count - 3).toLocaleString()} more` : ''}
          </p>
        )}

        {(excluded.noConsent ?? 0) > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="outline" className="text-[10px]">
              {excluded.noConsent} excluded — no marketing consent
            </Badge>
          </div>
        )}
      </div>
    </div>
  );
}
