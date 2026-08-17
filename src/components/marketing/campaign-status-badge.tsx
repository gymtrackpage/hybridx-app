import { Badge } from '@/components/ui/badge';
import type { CampaignStatus } from '@/lib/marketing/types';

const VARIANTS: Record<CampaignStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-muted text-muted-foreground hover:bg-muted' },
  scheduled: { label: 'Scheduled', className: 'bg-blue-500/15 text-blue-600 hover:bg-blue-500/15 dark:text-blue-400' },
  sending: { label: 'Sending', className: 'bg-amber-500/15 text-amber-600 hover:bg-amber-500/15 dark:text-amber-400' },
  sent: { label: 'Sent', className: 'bg-green-500/15 text-green-600 hover:bg-green-500/15 dark:text-green-400' },
  paused: { label: 'Paused', className: 'bg-orange-500/15 text-orange-600 hover:bg-orange-500/15 dark:text-orange-400' },
  failed: { label: 'Failed', className: 'bg-destructive/15 text-destructive hover:bg-destructive/15' },
};

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  const variant = VARIANTS[status] ?? VARIANTS.draft;
  return (
    <Badge variant="secondary" className={variant.className}>
      {variant.label}
    </Badge>
  );
}
