"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, isPast } from "date-fns";
import { toast } from "sonner";
import { CheckCircle2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  lead: { id: string; fullName: string; companyName: string | null } | null;
  assignedTo: { firstName: string; lastName: string } | null;
}

interface TasksListProps {
  initialTasks: Task[];
  currentFilter: string;
}

export function TasksList({ initialTasks, currentFilter }: TasksListProps) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);

  const overdueCount = tasks.filter(
    (t) => t.dueDate && isPast(new Date(t.dueDate)) && t.status === "PENDING"
  ).length;

  function setFilter(filter: string) {
    const params = new URLSearchParams();
    if (filter !== "all") params.set("filter", filter);
    router.push(`/dashboard/tasks?${params.toString()}`);
  }

  async function completeTask(taskId: string) {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "COMPLETED" }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message);
      setTasks(tasks.map((t) => (t.id === taskId ? { ...t, status: "COMPLETED" } : t)));
      toast.success("Task completed");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update task");
    }
  }

  return (
    <>
      {overdueCount > 0 && (
        <p className="text-sm text-destructive">{overdueCount} overdue tasks</p>
      )}

      <div className="flex gap-2">
        {(["all", "pending", "overdue"] as const).map((f) => (
          <Button
            key={f}
            variant={currentFilter === f ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </Button>
        ))}
      </div>

      {tasks.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No tasks found.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => {
            const isOverdue =
              task.dueDate &&
              isPast(new Date(task.dueDate)) &&
              task.status === "PENDING";

            return (
              <Card key={task.id}>
                <CardContent className="flex items-center justify-between pt-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p
                        className={`font-medium ${task.status === "COMPLETED" ? "line-through text-muted-foreground" : ""}`}
                      >
                        {task.title}
                      </p>
                      <Badge variant="outline" className="text-xs">
                        {task.priority}
                      </Badge>
                      {isOverdue && (
                        <Badge variant="destructive" className="text-xs">
                          Overdue
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                      {task.lead && (
                        <Link
                          href={`/dashboard/leads/${task.lead.id}`}
                          className="flex items-center gap-1 hover:underline"
                        >
                          {task.lead.fullName}
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                      {task.dueDate && (
                        <span>Due {format(new Date(task.dueDate), "MMM d, yyyy")}</span>
                      )}
                    </div>
                  </div>
                  {task.status !== "COMPLETED" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => completeTask(task.id)}
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Complete
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
