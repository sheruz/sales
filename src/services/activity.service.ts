import prisma from "@/lib/db/prisma";
import { ActivityType, Prisma } from "@prisma/client";
import { NotFoundError, ValidationError } from "@/lib/api/response";

interface LogActivityInput {
  organizationId: string;
  leadId?: string;
  dealId?: string;
  userId?: string;
  type: ActivityType;
  title: string;
  description?: string;
  metadata?: Prisma.InputJsonValue;
}

export class ActivityService {
  /**
   * organizationId must come from authenticated/job org context — never from clients.
   * Parent lead/deal (when provided) must belong to the same organization.
   */
  async log(input: LogActivityInput) {
    if (input.leadId) {
      const lead = await prisma.lead.findFirst({
        where: {
          id: input.leadId,
          organizationId: input.organizationId,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!lead) throw new NotFoundError("Lead not found");
    }
    if (input.dealId) {
      const deal = await prisma.deal.findFirst({
        where: {
          id: input.dealId,
          organizationId: input.organizationId,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!deal) throw new NotFoundError("Deal not found");
    }
    if (!input.leadId && !input.dealId) {
      // Allow org-scoped system events without a parent, but require org.
      if (!input.organizationId) {
        throw new ValidationError("organizationId is required for activities");
      }
    }

    return prisma.activity.create({
      data: {
        organizationId: input.organizationId,
        leadId: input.leadId,
        dealId: input.dealId,
        userId: input.userId,
        type: input.type,
        title: input.title,
        description: input.description,
        metadata: input.metadata,
      },
    });
  }

  async getByLeadId(organizationId: string, leadId: string, limit = 50) {
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!lead) throw new NotFoundError("Lead not found");

    return prisma.activity.findMany({
      where: { organizationId, leadId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }
}

export const activityService = new ActivityService();
