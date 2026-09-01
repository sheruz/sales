import { ModulePlaceholder } from "@/components/dashboard/module-placeholder";
import { Target } from "lucide-react";

export default function CampaignsPage() {
  return (
    <ModulePlaceholder
      title="Campaigns"
      description="Create and manage outreach campaigns."
      phase="Phase 4"
      icon={Target}
    />
  );
}
