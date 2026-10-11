import Link from "next/link";
import { PipelineBoard } from "@/components/crm/pipeline-board";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { hasAnyOrgPermission, hasOrgPermission } from "@/lib/tenant/scope";
import { Button } from "@/components/ui/button";

export default async function PipelinePage() {
  const user = await getCurrentUser();
  if (!user?.organizationId) redirect("/login");
  if (
    !hasAnyOrgPermission(user, ["deals.manage", "opportunities.view"])
  ) {
    redirect("/dashboard");
  }

  const canOpps = hasOrgPermission(user, "opportunities.view");
  const canProposals = hasOrgPermission(user, "deals.manage");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Pipeline</h2>
          <p className="text-muted-foreground">
            Opportunity and deal progression — move work from qualified through
            meeting, proposal, negotiation, and won into revenue.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canOpps ? (
            <Link href="/dashboard/opportunities">
              <Button variant="outline" size="sm">
                Opportunities
              </Button>
            </Link>
          ) : null}
          {canProposals ? (
            <Link href="/dashboard/proposals">
              <Button variant="outline" size="sm">
                Proposals
              </Button>
            </Link>
          ) : null}
        </div>
      </div>
      <PipelineBoard />
    </div>
  );
}
