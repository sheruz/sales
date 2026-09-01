import { ModulePlaceholder } from "@/components/dashboard/module-placeholder";
import { Calendar } from "lucide-react";

export default function MeetingsPage() {
  return (
    <ModulePlaceholder
      title="Meetings"
      description="Schedule and manage client meetings."
      phase="Phase 9"
      icon={Calendar}
    />
  );
}
