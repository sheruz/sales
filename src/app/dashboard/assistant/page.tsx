import { ModulePlaceholder } from "@/components/dashboard/module-placeholder";
import { Bot } from "lucide-react";

export default function AssistantPage() {
  return (
    <ModulePlaceholder
      title="AI Assistant"
      description="Internal AI chat for sales insights and recommendations."
      phase="Phase 11"
      icon={Bot}
    />
  );
}
