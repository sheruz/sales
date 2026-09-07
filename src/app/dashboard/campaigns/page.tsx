import { redirect } from "next/navigation";
import { campaignService } from "@/services/campaign.service";
import prisma from "@/lib/db/prisma";
import { CampaignsList } from "@/components/campaigns/campaigns-list";
import { getCurrentUser } from "@/lib/auth/session";
import { hasOrgPermission } from "@/lib/tenant/scope";

export default async function CampaignsPage() {
  const user = await getCurrentUser();
  if (!user?.organizationId) redirect("/dashboard");
  if (!hasOrgPermission(user, "campaigns.manage")) {
    redirect("/dashboard");
  }

  const [campaigns, services] = await Promise.all([
    campaignService.list(user.organizationId),
    prisma.service.findMany({
      where: { organizationId: user.organizationId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const serialized = campaigns.map((c) => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Campaigns</h2>
        <p className="text-muted-foreground">
          Canonical Contact/Opportunity enrollments plus legacy Lead discovery.
          Prefer Sequences for new outreach automation.
        </p>
      </div>
      <CampaignsList
        initialCampaigns={serialized}
        services={services}
        canManage
      />
    </div>
  );
}
