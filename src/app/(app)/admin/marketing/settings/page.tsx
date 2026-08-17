import { getSettings } from '@/lib/marketing/queue';
import { isBulkTransportConfigured } from '@/lib/marketing/transport';
import { isTokenSecretConfigured } from '@/lib/marketing/tokens';
import { MarketingSettingsForm } from '@/components/marketing/settings-form';

export const dynamic = 'force-dynamic';

export default async function MarketingSettingsPage() {
  const settings = await getSettings();

  // Read on the server so the page reports what the running process actually
  // has, rather than what the deploy config is supposed to provide.
  const health = {
    transportConfigured: isBulkTransportConfigured(),
    tokenSecretConfigured: isTokenSecretConfigured(),
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? null,
    fromAddress:
      process.env.MARKETING_EMAIL_FROM ?? process.env.EMAIL_FROM ?? null,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline text-3xl font-bold">Marketing settings</h1>
        <p className="mt-1 text-muted-foreground">
          Sender identity, delivery throughput and the global sending switch.
        </p>
      </div>

      <MarketingSettingsForm settings={settings} health={health} />
    </div>
  );
}
