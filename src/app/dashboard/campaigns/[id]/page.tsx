import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { campaignService } from "@/services/campaign.service";
import { CampaignDetail } from "@/components/campaigns/campaign-detail";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CAMPAIGN_STATUS_LABELS } from "@/lib/constants/automation";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CampaignDetailPage({ params }: PageProps) {
  const { id } = await params;

  let data;
  try {
    data = await campaignService.getStats(id);
  } catch {
    notFound();
  }

  const { campaign, stats } = data;

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
    </div>
  );
}
