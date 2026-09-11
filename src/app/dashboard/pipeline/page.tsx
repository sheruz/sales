import { PipelineBoard } from "@/components/crm/pipeline-board";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { hasAnyOrgPermission } from "@/lib/tenant/scope";

export default async function PipelinePage() {
  const user = await getCurrentUser();
  if (!user?.organizationId) redirect("/login");
  if (
    !hasAnyOrgPermission(user, ["deals.manage", "opportunities.view"])
  ) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Pipeline</h2>
        <p className="text-muted-foreground">
          Opportunity and deal progression — move work from qualified through
          meeting, proposal, negotiation, and won into revenue.
        </p>
      </div>
      <PipelineBoard />
    </div>
  );
}
