import { randomUUID } from "crypto";
import prisma from "@/lib/db/prisma";
import {
  CompanyTimelineEventType,
  TimelineActor,
  type Prisma,
} from "@prisma/client";

export type TimelineRecordInput = {
  organizationId: string;
  companyId: string;
  type: CompanyTimelineEventType;
  title: string;
  details?: Record<string, unknown> | null;
  contactId?: string | null;
  opportunityId?: string | null;
  actor?: TimelineActor;
  userId?: string | null;
  /** When set, duplicate inserts for the same company+key are skipped */
  dedupeKey?: string | null;
  createdAt?: Date;
};

export class TimelineService {
  async record(input: TimelineRecordInput) {
    const dedupeKey = input.dedupeKey?.trim() || null;
    if (dedupeKey) {
      const existing = await prisma.companyTimelineEvent.findFirst({
        where: { companyId: input.companyId, dedupeKey },
        select: { id: true },
      });
      if (existing) return existing;
    }

    try {
      return await prisma.companyTimelineEvent.create({
        data: {
          id: randomUUID(),
          organizationId: input.organizationId,
          companyId: input.companyId,
          contactId: input.contactId ?? null,
          opportunityId: input.opportunityId ?? null,
          type: input.type,
          title: input.title,
          details: (input.details ?? undefined) as
            | Prisma.InputJsonValue
            | undefined,
          actor: input.actor ?? TimelineActor.SYSTEM,
          userId: input.userId ?? null,
          dedupeKey,
          ...(input.createdAt ? { createdAt: input.createdAt } : {}),
        },
      });
    } catch (err) {
      // Unique race on dedupeKey
      if (dedupeKey) {
        const existing = await prisma.companyTimelineEvent.findFirst({
          where: { companyId: input.companyId, dedupeKey },
        });
        if (existing) return existing;
      }
      console.warn(
        "[timeline] record failed",
        err instanceof Error ? err.message : err
      );
      return null;
    }
  }

  async listForCompany(organizationId: string, companyId: string, take = 50) {
    return prisma.companyTimelineEvent.findMany({
      where: { organizationId, companyId },
      orderBy: { createdAt: "desc" },
      take,
    });
  }
}

export const timelineService = new TimelineService();
