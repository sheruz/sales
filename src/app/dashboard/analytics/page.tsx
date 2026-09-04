import { AnalyticsClient } from "@/components/dashboard/analytics-client";

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Revenue analytics</h2>
        <p className="text-muted-foreground">
          Funnel, sources, services, conversions, and what historically produces
          revenue for your organization.
        </p>
      </div>
      <AnalyticsClient />
    </div>
  );
}
