import { ModulePlaceholder } from "@/components/dashboard/module-placeholder";
import { Users } from "lucide-react";

export default function LeadsPage() {
  return (
    <ModulePlaceholder
      title="Leads"
      description="Manage and track your sales leads."
      phase="Phase 3"
      icon={Users}
    />
  );
}
