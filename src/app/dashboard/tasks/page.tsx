import { taskService } from "@/services/task.service";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { TasksList } from "@/components/tasks/tasks-list";

interface PageProps {
  searchParams: Promise<{ filter?: string }>;
}

export default async function TasksPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user?.organizationId) redirect("/login");

  const { filter } = await searchParams;
  const overdue = filter === "overdue";

  const tasks = await taskService.list(user.organizationId, {
    assignedToId: user.role === "SALES_REPRESENTATIVE" ? user.id : undefined,
    overdue,
    status: filter === "pending" ? "PENDING" : undefined,
  });

  const serialized = tasks.map((t) => ({
    ...t,
    dueDate: t.dueDate?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Tasks</h2>
        <p className="text-muted-foreground">Track follow-ups and action items.</p>
      </div>
      <TasksList
        key={filter ?? "all"}
        initialTasks={serialized}
        currentFilter={filter ?? "all"}
      />
    </div>
  );
}
