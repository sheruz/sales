import { appHome } from "@/lib/app-paths";
import { taskService } from "@/services/task.service";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { hasAnyOrgPermission } from "@/lib/tenant/scope";
import { TasksList } from "@/components/tasks/tasks-list";

interface PageProps {
  searchParams: Promise<{ filter?: string }>;
}

export default async function TasksPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user?.organizationId) redirect("/login");
  if (!hasAnyOrgPermission(user, ["leads.view", "opportunities.view"])) {
    redirect(appHome());
  }

  const { filter } = await searchParams;
  const overdue = filter === "overdue";

  const tasks = await taskService.list(user.organizationId, {
    assignedToId: user.role === "SALES_REPRESENTATIVE" ? user.id : undefined,
    overdue,
    status: filter === "pending" ? "PENDING" : undefined,
  });

  const serialized = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    dueDate: t.dueDate?.toISOString() ?? null,
    lead: t.lead
      ? {
          id: t.lead.id,
          fullName: t.lead.fullName,
          companyName: t.lead.companyName,
        }
      : null,
    opportunity: t.opportunity
      ? {
          id: t.opportunity.id,
          stage: t.opportunity.stage,
          companyName: t.opportunity.company?.name ?? null,
        }
      : null,
    company: t.company ? { id: t.company.id, name: t.company.name } : null,
    contact: t.contact
      ? { id: t.contact.id, fullName: t.contact.fullName }
      : null,
    assignedTo: t.assignedTo
      ? {
          firstName: t.assignedTo.firstName,
          lastName: t.assignedTo.lastName,
        }
      : null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Tasks</h2>
        <p className="text-muted-foreground">
          Follow-ups linked to opportunities and contacts when available.
          Lead-only tasks are marked Legacy.
        </p>
      </div>
      <TasksList
        key={filter ?? "all"}
        initialTasks={serialized}
        currentFilter={filter ?? "all"}
      />
    </div>
  );
}
