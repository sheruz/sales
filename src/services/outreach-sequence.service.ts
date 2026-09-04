import prisma from "@/lib/db/prisma";
import {
  ConversationChannel,
  OutreachSequenceStatus,
  type Prisma,
} from "@prisma/client";
import { NotFoundError, ValidationError } from "@/lib/api/response";
import { entitlementService } from "@/services/entitlement.service";
import { FEATURE_KEYS } from "@/lib/billing/features";

export type SequenceStepInput = {
  stepOrder: number;
  delayMinutes?: number;
  channel?: ConversationChannel;
  subjectTemplate?: string | null;
  bodyTemplate: string;
  condition?: Prisma.InputJsonValue | null;
  isActive?: boolean;
};

export class OutreachSequenceService {
  async list(organizationId: string) {
    return prisma.outreachSequence.findMany({
      where: { organizationId },
      include: {
        steps: { orderBy: { stepOrder: "asc" } },
        _count: {
          select: {
            enrollments: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  async getById(organizationId: string, id: string) {
    const sequence = await prisma.outreachSequence.findFirst({
      where: { id, organizationId },
      include: {
        steps: { orderBy: { stepOrder: "asc" } },
        _count: {
          select: { enrollments: true },
        },
      },
    });
    if (!sequence) throw new NotFoundError("Sequence not found");

    const [active, completed, stopped, paused] = await Promise.all([
      prisma.sequenceEnrollment.count({
        where: {
          organizationId,
          sequenceId: id,
          status: { in: ["ACTIVE", "PENDING", "PROCESSING"] },
        },
      }),
      prisma.sequenceEnrollment.count({
        where: { organizationId, sequenceId: id, status: "COMPLETED" },
      }),
      prisma.sequenceEnrollment.count({
        where: { organizationId, sequenceId: id, status: "STOPPED" },
      }),
      prisma.sequenceEnrollment.count({
        where: { organizationId, sequenceId: id, status: "PAUSED" },
      }),
    ]);

    return {
      ...sequence,
      enrollmentStats: { active, completed, stopped, paused },
    };
  }

  async create(
    organizationId: string,
    input: {
      name: string;
      description?: string | null;
      status?: OutreachSequenceStatus;
      stopOnReply?: boolean;
      stopOnMeeting?: boolean;
      stopOnUnsubscribe?: boolean;
      steps?: SequenceStepInput[];
    }
  ) {
    if (!input.name.trim()) throw new ValidationError("Sequence name required");
    await entitlementService.assertSeatAvailable(
      organizationId,
      FEATURE_KEYS.SEQUENCES
    );
    return prisma.outreachSequence.create({
      data: {
        organizationId,
        name: input.name.trim(),
        description: input.description,
        status: input.status ?? OutreachSequenceStatus.DRAFT,
        stopOnReply: input.stopOnReply ?? true,
        stopOnMeeting: input.stopOnMeeting ?? true,
        stopOnUnsubscribe: input.stopOnUnsubscribe ?? true,
        steps: input.steps?.length
          ? {
              create: input.steps.map((s) => ({
                stepOrder: s.stepOrder,
                delayMinutes: s.delayMinutes ?? 0,
                channel: s.channel ?? ConversationChannel.EMAIL,
                subjectTemplate: s.subjectTemplate,
                bodyTemplate: s.bodyTemplate,
                condition: s.condition ?? undefined,
                isActive: s.isActive ?? true,
              })),
            }
          : undefined,
      },
      include: { steps: { orderBy: { stepOrder: "asc" } } },
    });
  }

  async update(
    organizationId: string,
    id: string,
    input: {
      name?: string;
      description?: string | null;
      status?: OutreachSequenceStatus;
      stopOnReply?: boolean;
      stopOnMeeting?: boolean;
      stopOnUnsubscribe?: boolean;
      steps?: SequenceStepInput[];
    }
  ) {
    await this.getById(organizationId, id);
    if (input.steps) {
      await prisma.outreachSequenceStep.deleteMany({ where: { sequenceId: id } });
      await prisma.outreachSequenceStep.createMany({
        data: input.steps.map((s) => ({
          sequenceId: id,
          stepOrder: s.stepOrder,
          delayMinutes: s.delayMinutes ?? 0,
          channel: s.channel ?? ConversationChannel.EMAIL,
          subjectTemplate: s.subjectTemplate,
          bodyTemplate: s.bodyTemplate,
          condition: (s.condition ?? undefined) as Prisma.InputJsonValue | undefined,
          isActive: s.isActive ?? true,
        })),
      });
    }
    return prisma.outreachSequence.update({
      where: { id },
      data: {
        name: input.name?.trim(),
        description: input.description,
        status: input.status,
        stopOnReply: input.stopOnReply,
        stopOnMeeting: input.stopOnMeeting,
        stopOnUnsubscribe: input.stopOnUnsubscribe,
      },
      include: { steps: { orderBy: { stepOrder: "asc" } } },
    });
  }

  async archive(organizationId: string, id: string) {
    await this.getById(organizationId, id);
    return prisma.outreachSequence.update({
      where: { id },
      data: { status: OutreachSequenceStatus.ARCHIVED },
    });
  }
}

export const outreachSequenceService = new OutreachSequenceService();
