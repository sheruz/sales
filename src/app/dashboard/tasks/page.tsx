import { ModulePlaceholder } from "@/components/dashboard/module-placeholder";
import { ListTodo } from "lucide-react";

export default function TasksPage() {
  return (
    <ModulePlaceholder
      title="Tasks"
      description="Track follow-ups and action items."
      phase="Phase 3"
      icon={ListTodo}
    />
  );
}
