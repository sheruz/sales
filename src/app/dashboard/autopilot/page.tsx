import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { hasAnyOrgPermission, hasOrgPermission } from "@/lib/tenant/scope";
import { sourcingJobService } from "@/services/sourcing-job.service";
import { SourcingPanel } from "@/components/autopilot/sourcing-panel";
import { EmptyState } from "@/components/crm/empty-state";
import { Button } from "@/components/ui/button";

export default async function AutopilotPage() {
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

  const data = await sourcingJobService.dashboard(user.organizationId);
  const canIntegrations = hasOrgPermission(user, "integrations.manage");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Autopilot</h2>
        <p className="text-muted-foreground">
          Sourcing — Google Places finds real businesses from your ICP. Keep
          Sourcing OFF until you finish a cheap Run now test.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 rounded-lg border border-dashed p-4 text-sm">
        <span className="w-full font-medium">Test setup</span>
        <Link href="/dashboard/settings?tab=integrations">
          <Button variant="outline" size="sm">
            1. Settings → Integrations → Google Places
          </Button>
        </Link>
        <Link href="/dashboard/icp">
          <Button variant="outline" size="sm">
            2. Configure ICP
          </Button>
        </Link>
        <Link href="/dashboard/business-brain">
          <Button variant="outline" size="sm">
            3. Business Brain
          </Button>
        </Link>
        <Link href="/dashboard/companies">
          <Button variant="outline" size="sm">
            4. View Companies
          </Button>
        </Link>
        {!canIntegrations ? (
          <p className="w-full text-xs text-muted-foreground">
            Connecting the Google Places key requires integrations.manage.
          </p>
        ) : null}
      </div>

      <SourcingPanel
        initial={{
          config: data.config,
          companiesToday: data.companiesToday,
          pendingCrawls: data.pendingCrawls,
          costs: data.costs,
          recentErrors: data.recentErrors,
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
    </div>
  );
}
