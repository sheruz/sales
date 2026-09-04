import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { hasOrgPermission } from "@/lib/tenant/scope";
import { AnalyticsClient } from "@/components/dashboard/analytics-client";

export default async function AnalyticsPage() {
  const user = await getCurrentUser();
  if (!user?.organizationId) redirect("/dashboard");
  if (!hasOrgPermission(user, "analytics.view")) redirect("/dashboard");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Revenue analytics</h2>
        <p className="text-muted-foreground">
          Deep dive: funnel, sources, services, conversions, and learning
          insights — not your daily action board.
        </p>
      </div>
      <AnalyticsClient />
    </div>
  );
}
