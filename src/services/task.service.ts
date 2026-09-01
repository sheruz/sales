import prisma from "@/lib/db/prisma";
import { ActivityType, TaskStatus } from "@prisma/client";
import { NotFoundError } from "@/lib/api/response";
import { activityService } from "@/services/activity.service";
import type { CreateTaskInput } from "@/lib/validations/lead";

export class TaskService {
  async list(filters?: {
    leadId?: string;
    assignedToId?: string;
    status?: TaskStatus;
    overdue?: boolean;
  }) {
    return prisma.task.findMany({
      where: {
        ...(filters?.leadId ? { leadId: filters.leadId } : {}),
        ...(filters?.assignedToId ? { assignedToId: filters.assignedToId } : {}),
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.overdue
          ? {
              status: TaskStatus.PENDING,
              dueDate: { lt: new Date() },
            }
          : {}),
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      include: {
        lead: { select: { id: true, fullName: true, companyName: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async create(
    input: CreateTaskInput & { leadId?: string },
    userId: string
  ) {
    if (input.leadId) {
      const lead = await prisma.lead.findFirst({
        where: { id: input.leadId, deletedAt: null },
      });
      if (!lead) throw new NotFoundError("Lead not found");
    }

    const task = await prisma.task.create({
      data: {
        title: input.title,
        description: input.description || null,
        leadId: input.leadId || null,
        assignedToId: input.assignedToId ?? userId,
        createdById: userId,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        priority: input.priority ?? "MEDIUM",
      },
      include: {
        lead: { select: { id: true, fullName: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (input.leadId) {
      await activityService.log({
        leadId: input.leadId,
        userId,
        type: ActivityType.TASK_CREATED,
        title: "Task created",
        description: input.title,
      });
    }

    return task;
  }

  async updateStatus(taskId: string, status: TaskStatus, userId: string) {
    const task = await prisma.task.update({
      where: { id: taskId },
      data: { status },
      include: {
        lead: { select: { id: true, fullName: true } },
      },
    });

    if (task.leadId && status === TaskStatus.COMPLETED) {
      await activityService.log({
        leadId: task.leadId,
        userId,
        type: ActivityType.TASK_COMPLETED,
        title: "Task completed",
        description: task.title,
      });
    }

    return task;
  }

  async delete(taskId: string) {
    await prisma.task.delete({ where: { id: taskId } });
  }
}

export const taskService = new TaskService();
