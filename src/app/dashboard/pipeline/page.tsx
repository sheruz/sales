import { ModulePlaceholder } from "@/components/dashboard/module-placeholder";
import { Briefcase } from "lucide-react";

export default function PipelinePage() {
  return (
    <ModulePlaceholder
      title="Pipeline"
      description="Kanban-style sales pipeline and deal management."
      phase="Phase 9"
      icon={Briefcase}
    />
  );
}
