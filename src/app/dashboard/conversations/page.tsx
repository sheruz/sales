import { ModulePlaceholder } from "@/components/dashboard/module-placeholder";
import { MessageSquare } from "lucide-react";

export default function ConversationsPage() {
  return (
    <ModulePlaceholder
      title="Conversations"
      description="Unified view of all lead communications."
      phase="Phase 8"
      icon={MessageSquare}
    />
  );
}
