import { ModulePlaceholder } from "@/components/dashboard/module-placeholder";
import { BarChart3 } from "lucide-react";

export default function AnalyticsPage() {
  return (
    <ModulePlaceholder
      title="Analytics"
      description="Sales metrics, campaign performance, and conversion analytics."
      phase="Phase 11"
      icon={BarChart3}
    />
  );
}
