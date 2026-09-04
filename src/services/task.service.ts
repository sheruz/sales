import prisma from "@/lib/db/prisma";
import { ActivityType, TaskStatus, TaskType, TaskPriority } from "@prisma/client";
import { NotFoundError } from "@/lib/api/response";
import { activityService } from "@/services/activity.service";

export class TaskService {
  async list(
    organizationId: string,
    filters?: {
      leadId?: string;
      opportunityId?: string;
      assignedToId?: string;
      status?: TaskStatus;
      overdue?: boolean;
    }
  ) {
    return prisma.task.findMany({
      where: {
        organizationId,
        ...(filters?.leadId ? { leadId: filters.leadId } : {}),
        ...(filters?.opportunityId
          ? { opportunityId: filters.opportunityId }
          : {}),
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
        opportunity: {
          select: {
            id: true,
            stage: true,
            company: { select: { name: true } },
          },
        },
        company: { select: { id: true, name: true } },
        contact: { select: { id: true, fullName: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async create(
    organizationId: string,
    input: {
      title: string;
      description?: string | null;
      type?: TaskType;
      priority?: TaskPriority;
      dueDate?: string | null;
      assignedToId?: string | null;
      leadId?: string | null;
      opportunityId?: string | null;
      companyId?: string | null;
      contactId?: string | null;
      dealId?: string | null;
    },
    userId: string
  ) {
    let companyId = input.companyId;
    let contactId = input.contactId;
    let leadId = input.leadId;

    if (input.opportunityId) {
      const opp = await prisma.opportunity.findFirst({
        where: { id: input.opportunityId, organizationId },
      });
      if (!opp) throw new NotFoundError("Opportunity not found");
      companyId = companyId ?? opp.companyId;
      contactId = contactId ?? opp.primaryContactId;
      leadId = leadId ?? opp.leadId;
    }

    if (leadId) {
      const lead = await prisma.lead.findFirst({
        where: { id: leadId, organizationId, deletedAt: null },
      });
      if (!lead) throw new NotFoundError("Lead not found");
    }

    const task = await prisma.task.create({
      data: {
        organizationId,
        title: input.title,
        description: input.description || null,
        type: input.type ?? TaskType.OTHER,
        leadId: leadId || null,
        opportunityId: input.opportunityId || null,
        companyId: companyId || null,
        contactId: contactId || null,
        dealId: input.dealId || null,
        assignedToId: input.assignedToId ?? userId,
        createdById: userId,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        priority: input.priority ?? TaskPriority.MEDIUM,
      },
      include: {
        lead: { select: { id: true, fullName: true } },
        opportunity: { select: { id: true, stage: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (leadId) {
      await activityService.log({
        leadId,
        userId,
        type: ActivityType.TASK_CREATED,
        title: "Task created",
        description: input.title,
      });
    }

    return task;
  }

  async updateStatus(
    organizationId: string,
    taskId: string,
    status: TaskStatus,
    userId: string
  ) {
    const existing = await prisma.task.findFirst({
      where: { id: taskId, organizationId },
    });
    if (!existing) throw new NotFoundError("Task not found");

    const task = await prisma.task.update({
      where: { id: taskId },
      data: {
        status,
        completedAt: status === TaskStatus.COMPLETED ? new Date() : null,
      },
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

  async delete(organizationId: string, taskId: string) {
    const existing = await prisma.task.findFirst({
      where: { id: taskId, organizationId },
    });
    if (!existing) throw new NotFoundError("Task not found");
    await prisma.task.delete({ where: { id: taskId } });
  }
}

export const taskService = new TaskService();
