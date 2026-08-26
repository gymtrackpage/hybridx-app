import { getKnowledgeSnapshot } from '@/lib/marketing/knowledge';
import { getSettings } from '@/lib/marketing/queue';
import { describeCap } from '@/lib/marketing/frequency';
import { CampaignStudio } from '@/components/marketing/campaign-studio';

export const dynamic = 'force-dynamic';

export default async function StudioPage() {
  const [snapshot, settings] = await Promise.all([getKnowledgeSnapshot(), getSettings()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline text-2xl font-bold sm:text-3xl">Campaign studio</h1>
        <p className="mt-1 max-w-3xl text-muted-foreground">
          Describe what you want to send. The studio plans the sequence, drafts each email against
          live HYBRIDX facts, and wires up the sending — as a one-off broadcast or an automation
          that runs on a trigger.
        </p>
      </div>

      <CampaignStudio
        knowledge={{
          trialDays: snapshot.trialDays,
          priceLabel: snapshot.priceLabel,
          programCount: snapshot.programs.length,
          mailable: snapshot.totalMailable,
          hasHistory: snapshot.bestCampaigns.length > 0,
        }}
        frequencyCapNote={describeCap(settings.frequencyCapPerWeek)}
      />
    </div>
  );
}
