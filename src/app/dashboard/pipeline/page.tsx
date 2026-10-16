import { appHome } from "@/lib/app-paths";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PipelineBoard } from "@/components/crm/pipeline-board";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { hasAnyOrgPermission, hasOrgPermission } from "@/lib/tenant/scope";

export default async function PipelinePage() {
  const user = await getCurrentUser();
  if (!user?.organizationId) redirect("/login");
  if (
    !hasAnyOrgPermission(user, ["deals.manage", "opportunities.view"])
  ) {
    redirect(appHome());
  }

  const canOpps = hasOrgPermission(user, "opportunities.view");
  const canProposals = hasOrgPermission(user, "deals.manage");
  const newDealHref = canOpps
    ? appHome("/opportunities")
    : appHome("/proposals");

  return (
    <div className="dx">
      <div className="page">
        <div className="page-head">
          <div>
            <h1 className="page-title">Deals</h1>
            <p className="page-sub">
              Only real conversations live here. Cold leads stay in Leads.
            </p>
          </div>
          <div className="page-actions">
            <Link href={appHome("/pipeline")} className="btn active">
              Board
            </Link>
            {canOpps ? (
              <Link href={appHome("/opportunities")} className="btn">
                Opportunities
              </Link>
            ) : null}
            {canProposals ? (
              <Link href={appHome("/proposals")} className="btn">
                Proposals
              </Link>
            ) : null}
            <Link href={newDealHref} className="btn primary">
              <Plus />
              New deal
            </Link>
          </div>
        </div>
        <PipelineBoard />
      </div>
    </div>
  );
}
