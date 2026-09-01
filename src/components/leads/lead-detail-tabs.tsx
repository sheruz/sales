"use client";

import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { ActivityType } from "@prisma/client";
import {
  CheckCircle2,
  Circle,
  MessageSquare,
  Pencil,
  Plus,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

interface Note {
  id: string;
  content: string;
  createdAt: string;
  user: { firstName: string; lastName: string };
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  assignedTo: { firstName: string; lastName: string } | null;
}

interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  description: string | null;
  createdAt: string;
  user: { firstName: string; lastName: string } | null;
}

interface LeadDetailTabsProps {
  leadId: string;
  initialNotes: Note[];
  initialTasks: Task[];
  initialActivities: Activity[];
}

const activityIcons: Partial<Record<ActivityType, React.ReactNode>> = {
  LEAD_CREATED: <Plus className="h-4 w-4" />,
  LEAD_UPDATED: <Pencil className="h-4 w-4" />,
  NOTE_ADDED: <MessageSquare className="h-4 w-4" />,
  TASK_CREATED: <Circle className="h-4 w-4" />,
  TASK_COMPLETED: <CheckCircle2 className="h-4 w-4" />,
  LEAD_ASSIGNED: <User className="h-4 w-4" />,
  STATUS_CHANGED: <Pencil className="h-4 w-4" />,
};

export function LeadDetailTabs({
  leadId,
  initialNotes,
  initialTasks,
  initialActivities,
}: LeadDetailTabsProps) {
  const [notes, setNotes] = useState(initialNotes);
  const [tasks, setTasks] = useState(initialTasks);
  const activities = initialActivities;
  const [noteContent, setNoteContent] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [isAddingTask, setIsAddingTask] = useState(false);

  async function addNote() {
    if (!noteContent.trim()) return;
    setIsAddingNote(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: noteContent }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message);
      setNotes([data.data, ...notes]);
      setNoteContent("");
      toast.success("Note added");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add note");
    } finally {
      setIsAddingNote(false);
    }
  }

  async function addTask() {
    if (!taskTitle.trim()) return;
    setIsAddingTask(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: taskTitle }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message);
      setTasks([...tasks, data.data]);
      setTaskTitle("");
      toast.success("Task created");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create task");
    } finally {
      setIsAddingTask(false);
    }
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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update task");
    }
  }

  return (
    <Tabs defaultValue="activity">
      <TabsList>
        <TabsTrigger value="activity">Activity ({activities.length})</TabsTrigger>
        <TabsTrigger value="notes">Notes ({notes.length})</TabsTrigger>
        <TabsTrigger value="tasks">Tasks ({tasks.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="activity" className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Activity Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            {activities.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <div className="space-y-4">
                {activities.map((activity) => (
                  <div key={activity.id} className="flex gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                      {activityIcons[activity.type] ?? <Circle className="h-4 w-4" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{activity.title}</p>
                      {activity.description && (
                        <p className="text-sm text-muted-foreground">{activity.description}</p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {activity.user
                          ? `${activity.user.firstName} ${activity.user.lastName} · `
                          : ""}
                        {format(new Date(activity.createdAt), "MMM d, yyyy h:mm a")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="notes" className="mt-4 space-y-4">
        <Card>
          <CardContent className="pt-6 space-y-3">
            <Textarea
              placeholder="Add a note..."
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              rows={3}
            />
            <Button onClick={addNote} disabled={isAddingNote} size="sm">
              {isAddingNote ? "Adding..." : "Add Note"}
            </Button>
          </CardContent>
        </Card>
        {notes.map((note) => (
          <Card key={note.id}>
            <CardContent className="pt-4">
              <p className="text-sm whitespace-pre-wrap">{note.content}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {note.user.firstName} {note.user.lastName} ·{" "}
                {format(new Date(note.createdAt), "MMM d, yyyy h:mm a")}
              </p>
            </CardContent>
          </Card>
        ))}
      </TabsContent>

      <TabsContent value="tasks" className="mt-4 space-y-4">
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Task title..."
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTask()}
              />
              <Button onClick={addTask} disabled={isAddingTask} size="sm">
                Add
              </Button>
            </div>
          </CardContent>
        </Card>
        {tasks.map((task) => (
          <Card key={task.id}>
            <CardContent className="flex items-center justify-between pt-4">
              <div>
                <p className={`text-sm font-medium ${task.status === "COMPLETED" ? "line-through text-muted-foreground" : ""}`}>
                  {task.title}
                </p>
                <div className="mt-1 flex gap-2">
                  <Badge variant="outline" className="text-xs">{task.priority}</Badge>
                  {task.dueDate && (
                    <span className="text-xs text-muted-foreground">
                      Due {format(new Date(task.dueDate), "MMM d")}
                    </span>
                  )}
                </div>
              </div>
              {task.status !== "COMPLETED" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => completeTask(task.id)}
                >
                  Complete
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </TabsContent>
    </Tabs>
  );
}
