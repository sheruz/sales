import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { hasOrgPermission } from "@/lib/tenant/scope";
import { revenueGoalService } from "@/services/revenue-goal.service";
import { AgentConsoleClient } from "@/components/agent/agent-console-client";

export default async function AgentPage() {
  const user = await getCurrentUser();
  if (!user?.organizationId) redirect("/dashboard");
  if (!hasOrgPermission(user, "agent.view")) redirect("/dashboard");

  const goals = await revenueGoalService.list(user.organizationId);
  const serialized = goals.map((g) => ({
    id: g.id,
    name: g.name,
    status: g.status,
    targetRevenue: Number(g.targetRevenue),
    currency: g.currency,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Autonomous Revenue Agent
        </h2>
        <p className="text-muted-foreground">
          Controlled autonomy against an approved revenue goal — every action is
          authorized, logged, org-scoped, and auditable.
        </p>
      </div>
      <AgentConsoleClient
        revenueGoals={serialized}
        canManage={hasOrgPermission(user, "agent.manage")}
        canApprove={hasOrgPermission(user, "agent.approve")}
      />
    </div>
  );
}
