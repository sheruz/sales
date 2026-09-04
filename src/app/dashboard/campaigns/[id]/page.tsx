import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { campaignService } from "@/services/campaign.service";
import { CampaignDetail } from "@/components/campaigns/campaign-detail";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CAMPAIGN_STATUS_LABELS } from "@/lib/constants/automation";
import { getCurrentUser } from "@/lib/auth/session";

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

  const { sequenceEnrollmentService } = await import(
    "@/services/sequence-enrollment.service"
  );
  const enrollments = await sequenceEnrollmentService
    .list(user.organizationId, { campaignId: id, limit: 20 })
    .catch(() => ({ items: [] as never[] }));

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
            <Badge variant={campaign.status === "ACTIVE" ? "default" : "secondary"}>
              {CAMPAIGN_STATUS_LABELS[campaign.status] ?? campaign.status}
            </Badge>
          </div>
          {campaign.service && (
            <p className="text-muted-foreground">Service: {campaign.service.name}</p>
          )}
        </div>
      </div>
      <CampaignDetail campaign={campaign} stats={stats} />

      <div className="rounded-md border p-4">
        <h3 className="mb-2 text-sm font-semibold">
          Opportunity/Contact enrollments (canonical)
        </h3>
        <p className="mb-3 text-xs text-muted-foreground">
          Legacy lead enrollments remain in CampaignDetail above. This section
          lists SequenceEnrollment rows for Opportunity/Contact.
        </p>
        {enrollments.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No canonical enrollments</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {enrollments.items.map(
              (e: {
                id: string;
                status: string;
                contact: { fullName: string };
                sequence: { name: string };
                currentStepOrder: number;
              }) => (
                <li key={e.id}>
                  {e.contact.fullName} · {e.sequence.name} · step{" "}
                  {e.currentStepOrder} · {e.status}
                </li>
              )
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
