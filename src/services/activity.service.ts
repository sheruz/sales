import prisma from "@/lib/db/prisma";
import { ActivityType, Prisma } from "@prisma/client";

interface LogActivityInput {
  leadId?: string;
  dealId?: string;
  userId?: string;
  type: ActivityType;
  title: string;
  description?: string;
  metadata?: Prisma.InputJsonValue;
}

export class ActivityService {
  async log(input: LogActivityInput) {
    return prisma.activity.create({ data: input });
  }

  async getByLeadId(leadId: string, limit = 50) {
    return prisma.activity.findMany({
      where: { leadId },
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
