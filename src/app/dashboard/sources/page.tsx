import { appHome } from "@/lib/app-paths";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { hasOrgPermission } from "@/lib/tenant/scope";
import { getFeatureFlags } from "@/lib/features/flags";
import { sourceConnectorService } from "@/services/source-connector.service";
import { SourcesPageClient } from "@/components/connectors/sources-page-client";
import { EmptyState } from "@/components/crm/empty-state";

export default async function SourcesPage() {
  const user = await getCurrentUser();
  if (!user?.organizationId) redirect(appHome());
  if (!hasOrgPermission(user, "integrations.manage")) redirect(appHome());

  const flags = await getFeatureFlags(user.organizationId);
  if (!flags.sources_enabled) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Sources</h2>
          <p className="text-muted-foreground">
            Legacy scrapers are disabled for Client Autopilot.
          </p>
        </div>
        <EmptyState
          title="Sources disabled"
          description="Hiring/funding/Meta scrapers are off (sources_enabled=false). Google Places and Meta Lead Ads replace them in later phases."
          actionHref={appHome("/autopilot")}
          actionLabel="Open Autopilot"
        />
      </div>
    );
  }

  const [connectors, catalog] = await Promise.all([
    sourceConnectorService.list(user.organizationId),
    sourceConnectorService.catalog(user.organizationId),
  ]);

  const serialized = connectors.map((c) => ({
    id: c.id,
    type: c.type,
    name: c.name,
    provider: c.provider,
    status: c.status,
    lastSyncAt: c.lastSyncAt?.toISOString() ?? null,
    lastError: c.lastError,
    createdAt: c.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Source Connectors</h2>
        <p className="text-muted-foreground">
          Ingest hiring, funding, research, RFP, and CRM signals into the Opportunity
          Engine.
        </p>
      </div>
      <SourcesPageClient initialConnectors={serialized} catalog={catalog} />
    </div>
  );
}
