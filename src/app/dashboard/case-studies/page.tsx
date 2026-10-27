import { appHome } from "@/lib/app-paths";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { hasOrgPermission } from "@/lib/tenant/scope";
import { caseStudyService } from "@/services/case-study.service";
import { CaseStudiesPageClient } from "@/components/business-brain/case-studies-page-client";

export default async function CaseStudiesPage() {
  const user = await getCurrentUser();
  if (!user?.organizationId) redirect(appHome());
  if (!hasOrgPermission(user, "business_brain.manage")) redirect(appHome());

  const rows = await caseStudyService.list(user.organizationId, true);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Case studies</h2>
        <p className="text-muted-foreground">
          Niche proof for Proof-of-Work Day 7 emails. Real numbers only.
        </p>
      </div>
      <CaseStudiesPageClient
        initialRows={rows.map((r) => ({
          id: r.id,
          clientType: r.clientType,
          problem: r.problem,
          whatBuilt: r.whatBuilt,
          result: r.result,
          status: r.status,
        }))}
      />
    </div>
  );
}
