import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { campaignService } from "@/services/campaign.service";
import { outreachSequenceService } from "@/services/outreach-sequence.service";
import { sequenceEnrollmentService } from "@/services/sequence-enrollment.service";
import { CampaignDetail } from "@/components/campaigns/campaign-detail";
import { CampaignCanonicalPanel } from "@/components/campaigns/campaign-canonical-panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CAMPAIGN_STATUS_LABELS } from "@/lib/constants/automation";
import { getCurrentUser } from "@/lib/auth/session";
import { hasAnyOrgPermission } from "@/lib/tenant/scope";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CampaignDetailPage({ params }: PageProps) {
  const user = await getCurrentUser();
  if (!user?.organizationId) redirect("/dashboard");

  const { id } = await params;

  let data;
  try {
    data = await campaignService.getStats(user.organizationId, id);
  } catch {
    notFound();
  }

  const { campaign, stats } = data;

  const [enrollments, sequences] = await Promise.all([
    sequenceEnrollmentService
      .list(user.organizationId, { campaignId: id, limit: 50 })
      .catch(() => ({ items: [] as never[] })),
    hasAnyOrgPermission(user, ["sequences.view", "sequences.manage"])
      ? outreachSequenceService.list(user.organizationId)
      : Promise.resolve([]),
  ]);

  const canManage = hasAnyOrgPermission(user, [
    "campaigns.manage",
    "sequences.manage",
    "opportunities.update",
  ]);
  const canBridge = hasAnyOrgPermission(user, [
    "campaigns.manage",
    "sequences.manage",
    "leads.update",
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/campaigns">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight">{campaign.name}</h2>
            <Badge
              variant={campaign.status === "ACTIVE" ? "default" : "secondary"}
            >
              {CAMPAIGN_STATUS_LABELS[campaign.status] ?? campaign.status}
            </Badge>
          </div>
          {campaign.service && (
            <p className="text-muted-foreground">
              Service: {campaign.service.name}
            </p>
          )}
        </div>
      </div>

      <CampaignDetail
        campaign={campaign}
        stats={{
          totalLeads: stats.totalLeads,
          automatedLeads: stats.automatedLeads,
          repliedLeads: stats.repliedLeads,
          hotLeads: stats.hotLeads,
        }}
      />

      <CampaignCanonicalPanel
        campaignId={campaign.id}
        defaultSequenceId={campaign.defaultSequenceId}
        sequences={sequences.map((s) => ({
          id: s.id,
          name: s.name,
          status: s.status,
        }))}
        enrollments={enrollments.items as never[]}
        legacyLeads={campaign.campaignLeads.map((cl) => ({
          id: cl.id,
          bridgedAt: cl.bridgedAt,
          lead: {
            id: cl.lead.id,
            fullName: cl.lead.fullName,
            email: cl.lead.email,
            company: cl.lead.companyName,
            status: cl.lead.status,
            automationStatus: cl.lead.automationStatus,
          },
          sequenceEnrollment: cl.sequenceEnrollment,
        }))}
        canManage={canManage}
        canBridge={canBridge}
      />
    </div>
  );
}
