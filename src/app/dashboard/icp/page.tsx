import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { icpService } from "@/services/icp.service";
import { IcpPageClient } from "@/components/business-brain/icp-page-client";

export default async function IcpPage() {
  const user = await getCurrentUser();
  if (!user?.organizationId) redirect("/dashboard");

  const icps = await icpService.list(user.organizationId, true);

  const serialized = icps.map((icp) => ({
    id: icp.id,
    name: icp.name,
    description: icp.description,
    industries: icp.industries,
    countries: icp.countries,
    regions: icp.regions,
    companySizes: icp.companySizes,
    jobSignals: icp.jobSignals,
    buyingSignals: icp.buyingSignals,
    decisionMakerTitles: icp.decisionMakerTitles,
    exclusions: icp.exclusions,
    priority: icp.priority,
    status: icp.status,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Ideal Customer Profiles</h2>
        <p className="text-muted-foreground">
          Define who you sell to — industries, signals, and exclusions for targeting.
        </p>
      </div>
      <IcpPageClient initialIcps={serialized} />
    </div>
  );
}
