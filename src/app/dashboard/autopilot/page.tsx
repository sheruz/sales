import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { hasAnyOrgPermission, hasOrgPermission } from "@/lib/tenant/scope";
import { sourcingJobService } from "@/services/sourcing-job.service";
import { enrichmentJobService } from "@/services/enrichment-job.service";
import { cronTickService } from "@/services/cron-tick.service";
import { SourcingPanel } from "@/components/autopilot/sourcing-panel";
import { EnrichmentPanel } from "@/components/autopilot/enrichment-panel";
import { OverviewPanel } from "@/components/autopilot/overview-panel";
import { autopilotOverviewService } from "@/services/autopilot-overview.service";
import { EmptyState } from "@/components/crm/empty-state";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function AutopilotPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.organizationId) redirect("/dashboard");

  const canSourcing = hasAnyOrgPermission(user, [
    "integrations.manage",
    "campaigns.manage",
    "business_brain.manage",
  ]);

  if (!canSourcing) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">Autopilot</h2>
        <EmptyState
          title="No permission"
          description="Ask an admin for integrations.manage, campaigns.manage, or business_brain.manage."
        />
      </div>
    );
  }

  const params = await searchParams;
  const tab =
    params.tab === "enrichment"
      ? "enrichment"
      : params.tab === "sourcing"
        ? "sourcing"
        : "overview";

  let data;
  let enrichment;
  let lastTick;
  let overview;
  let schemaError: string | null = null;
  try {
    [data, enrichment, lastTick, overview] = await Promise.all([
      sourcingJobService.dashboard(user.organizationId),
      enrichmentJobService.dashboard(user.organizationId),
      cronTickService.lastTick(),
      autopilotOverviewService.get(user.organizationId, user.id),
    ]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[autopilot] dashboard load failed", msg);
    schemaError = msg;
  }

  if (schemaError || !data || !enrichment || !overview) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">Autopilot</h2>
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm space-y-2">
          <p className="font-medium">Database schema is behind this deploy.</p>
          <p className="text-muted-foreground">
            Phase 2 columns/tables are missing. On the server run:
          </p>
          <pre className="overflow-x-auto rounded bg-muted p-3 text-xs">
            {`cd /var/www/html/sales
npm run db:migrate:hunter-enrichment
pm2 restart all`}
          </pre>
          <p className="text-xs text-muted-foreground break-all">{schemaError}</p>
        </div>
      </div>
    );
  }

  const canIntegrations = hasOrgPermission(user, "integrations.manage");
  const lastCronRun = lastTick
    ? {
        startedAt: lastTick.startedAt.toISOString(),
        finishedAt: lastTick.finishedAt?.toISOString() ?? null,
        ok: lastTick.ok,
        skipped: lastTick.skipped,
        skipReason: lastTick.skipReason,
        stale: cronTickService.isStale(lastTick),
      }
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Autopilot</h2>
        <p className="text-muted-foreground">
          Google Places sourcing + Hunter decision-maker enrichment. Keep
          toggles OFF until you finish cheap manual tests.
        </p>
      </div>

      {lastCronRun?.stale || !lastCronRun ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          Cron warning: last run is missing or older than 15 minutes. Set up{" "}
          <code className="text-xs">scripts/cron-tick.sh</code> on the server.
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Last cron run:{" "}
          {new Date(
            lastCronRun.finishedAt || lastCronRun.startedAt
          ).toLocaleString()}
        </p>
      )}

      <div className="flex flex-wrap gap-2 rounded-lg border border-dashed p-4 text-sm">
        <span className="w-full font-medium">Test setup</span>
        <Link href="/dashboard/settings?tab=integrations">
          <Button variant="outline" size="sm">
            1. Google Places + Hunter keys
          </Button>
        </Link>
        <Link href="/dashboard/icp">
          <Button variant="outline" size="sm">
            2. ICP
          </Button>
        </Link>
        <Link href="/dashboard/companies">
          <Button variant="outline" size="sm">
            3. Companies
          </Button>
        </Link>
        <Link href="/dashboard/opportunities?filter=sourced">
          <Button variant="outline" size="sm">
            4. Sourced opportunities
          </Button>
        </Link>
        {!canIntegrations ? (
          <p className="w-full text-xs text-muted-foreground">
            Connecting API keys requires integrations.manage.
          </p>
        ) : null}
      </div>

      <Tabs defaultValue={tab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sourcing">Sourcing</TabsTrigger>
          <TabsTrigger value="enrichment">Enrichment</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-4">
          <OverviewPanel data={overview} />
        </TabsContent>
        <TabsContent value="sourcing" className="mt-4">
          <SourcingPanel
            initial={{
              config: data.config,
              companiesToday: data.companiesToday,
              pendingCrawls: data.pendingCrawls,
              costs: data.costs,
              recentErrors: data.recentErrors,
              lastCronRun,
              queries: data.queries.map((q) => ({
                id: q.id,
                query: q.query,
                country: q.country,
                city: q.city,
                status: q.status,
                lastRunAt: q.lastRunAt?.toISOString() ?? null,
                resultsCount: q.resultsCount,
                pageToken: q.pageToken,
                lastError: q.lastError,
              })),
            }}
          />
        </TabsContent>
        <TabsContent value="enrichment" className="mt-4">
          <EnrichmentPanel
            initial={{
              ...enrichment,
              lastCronRun,
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
