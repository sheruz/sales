import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { sourceConnectorService } from "@/services/source-connector.service";
import { SourcesPageClient } from "@/components/connectors/sources-page-client";

export default async function SourcesPage() {
  const user = await getCurrentUser();
  if (!user?.organizationId) redirect("/dashboard");

  const [connectors, catalog] = await Promise.all([
    sourceConnectorService.list(user.organizationId),
    Promise.resolve(sourceConnectorService.catalog()),
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
