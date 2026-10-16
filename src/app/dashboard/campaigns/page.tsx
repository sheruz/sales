import { appHome } from "@/lib/app-paths";
import Link from "next/link";
import { redirect } from "next/navigation";
import { campaignService } from "@/services/campaign.service";
import prisma from "@/lib/db/prisma";
import { CampaignsList } from "@/components/campaigns/campaigns-list";
import { getCurrentUser } from "@/lib/auth/session";
import { hasAnyOrgPermission, hasOrgPermission } from "@/lib/tenant/scope";
import { Button } from "@/components/ui/button";

export default async function CampaignsPage() {
  const user = await getCurrentUser();
  if (!user?.organizationId) redirect(appHome());
  if (!hasAnyOrgPermission(user, ["campaigns.manage", "campaigns.view"])) {
    redirect(appHome());
  }

  const canManage = hasOrgPermission(user, "campaigns.manage");
  const canSequences = hasAnyOrgPermission(user, [
    "sequences.view",
    "sequences.manage",
  ]);

  const [campaigns, services] = await Promise.all([
    campaignService.list(user.organizationId),
    canManage
      ? prisma.service.findMany({
          where: { organizationId: user.organizationId, isActive: true },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const serialized = campaigns.map((c) => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Campaigns</h2>
          <p className="text-muted-foreground">
            Outreach programs with Contact enrollments and sequences.
          </p>
        </div>
        {canSequences ? (
          <Link href={appHome("/sequences")}>
            <Button variant="outline" size="sm">
              Sequences
            </Button>
          </Link>
        ) : null}
      </div>
      <CampaignsList
        initialCampaigns={serialized}
        services={services}
        canManage={canManage}
      />
    </div>
  );
}
