import { ModulePlaceholder } from "@/components/dashboard/module-placeholder";
import { FileText } from "lucide-react";

export default function ProposalsPage() {
  return (
    <ModulePlaceholder
      title="Proposals"
      description="AI-assisted proposal generation and management."
      phase="Phase 10"
      icon={FileText}
    />
  );
}
