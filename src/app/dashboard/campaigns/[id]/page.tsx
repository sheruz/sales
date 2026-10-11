import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { campaignService } from "@/services/campaign.service";
import { campaignAnalyticsService } from "@/services/campaign-analytics.service";
import { outreachSequenceService } from "@/services/outreach-sequence.service";
import { sequenceEnrollmentService } from "@/services/sequence-enrollment.service";
import { CampaignDetail } from "@/components/campaigns/campaign-detail";
import { CampaignCanonicalPanel } from "@/components/campaigns/campaign-canonical-panel";
import { CampaignAnalyticsPanel } from "@/components/campaigns/campaign-analytics-panel";
import { CampaignBridgePreviewPanel } from "@/components/campaigns/campaign-bridge-preview-panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CAMPAIGN_STATUS_LABELS } from "@/lib/constants/automation";
import { getCurrentUser } from "@/lib/auth/session";
import { hasAnyOrgPermission, hasOrgPermission } from "@/lib/tenant/scope";
import { getFeatureFlags } from "@/lib/features/flags";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CampaignDetailPage({ params }: PageProps) {
  const user = await getCurrentUser();
  if (!user?.organizationId) redirect("/dashboard");
  if (!hasAnyOrgPermission(user, ["campaigns.manage", "campaigns.view"])) {
    redirect("/dashboard");
  }

  const { id } = await params;

  let data;
  try {
    data = await campaignService.getStats(user.organizationId, id);
  } catch {
    notFound();
  }

  const { campaign, stats } = data;

  let analytics: Awaited<
    ReturnType<typeof campaignAnalyticsService.getCampaignAnalytics>
  > | null = null;
  try {
    analytics = await campaignAnalyticsService.getCampaignAnalytics(
      user.organizationId,
      id
    );
  } catch {
    analytics = null;
  }

  let enrollmentsError: string | null = null;
  let enrollments: Awaited<
    ReturnType<typeof sequenceEnrollmentService.list>
  > = {
    items: [],
    pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
  };
  try {
    enrollments = await sequenceEnrollmentService.list(user.organizationId, {
      campaignId: id,
      limit: 50,
    });
  } catch {
    enrollmentsError = "Could not load canonical enrollments";
  }

  const sequences = hasAnyOrgPermission(user, [
    "sequences.view",
    "sequences.manage",
  ])
    ? await outreachSequenceService.list(user.organizationId)
    : [];

  const canManageCampaigns = hasOrgPermission(user, "campaigns.manage");
  const canEnroll = hasAnyOrgPermission(user, [
    "campaigns.manage",
    "sequences.manage",
    "opportunities.update",
  ]);
  const canBridge = hasAnyOrgPermission(user, [
    "campaigns.manage",
    "sequences.manage",
    "leads.update",
  ]);

  const flags = await getFeatureFlags(user.organizationId);
  const showLegacyDiscovery =
    flags.linkedin_discovery_ui_enabled || flags.legacy_enabled;

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

      {analytics ? (
        <CampaignAnalyticsPanel
          canonical={analytics.canonical}
          legacy={analytics.legacy}
        />
      ) : (
        <p className="text-sm text-muted-foreground">Analytics unavailable</p>
      )}

      <section className="space-y-3">
        <div>
          <h3 className="text-base font-semibold">Canonical outreach</h3>
          <p className="text-sm text-muted-foreground">
            Default sequence, Contact enrollments, and cutover preview. Lead is
            not required.
          </p>
        </div>
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
          canManageCampaigns={canManageCampaigns}
          canEnroll={canEnroll}
          canBridge={canBridge}
        />
        <CampaignBridgePreviewPanel
          campaignId={campaign.id}
          canPreview={canBridge}
        />
        {enrollmentsError ? (
          <p className="text-sm text-destructive">{enrollmentsError}</p>
        ) : null}
      </section>

      {showLegacyDiscovery ? (
        <section className="space-y-3 border-t pt-6">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold">
              Legacy discovery & automation
            </h3>
            <Badge
              variant="outline"
              className="border-amber-500/40 text-amber-700 dark:text-amber-400"
            >
              Legacy
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            LinkedIn discovery creates Leads / CampaignLeads. These counts are
            not the same population as canonical enrollments above.
          </p>
          <CampaignDetail
            campaign={campaign}
            stats={{
              totalLeads: stats.totalLeads,
              automatedLeads: stats.automatedLeads,
              repliedLeads: stats.repliedLeads,
              hotLeads: stats.hotLeads,
              canonicalEnrollments: stats.canonicalEnrollments,
            }}
            canManageCampaigns={canManageCampaigns}
          />
        </section>
      ) : null}
    </div>
  );
}
