import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { hasOrgPermission } from "@/lib/tenant/scope";
import { sourcingJobService } from "@/services/sourcing-job.service";
import { SourcingPanel } from "@/components/autopilot/sourcing-panel";
import { EmptyState } from "@/components/crm/empty-state";

export default async function AutopilotPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.organizationId) redirect("/dashboard");

  if (!hasOrgPermission(user, "integrations.manage")) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">Autopilot</h2>
        <EmptyState
          title="No permission"
          description="You need integrations.manage to configure Autopilot sourcing."
        />
      </div>
    );
  }

  const data = await sourcingJobService.dashboard(user.organizationId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Autopilot</h2>
        <p className="text-muted-foreground">
          Sourcing — Google Places finds real businesses from your ICP. Off until
          you enable it.
        </p>
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
