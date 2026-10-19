import prisma from "@/lib/db/prisma";
import {
  ConversationChannel,
  EmailStyle,
  OutreachSequenceStatus,
  SequenceEnrollmentStatus,
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
  emailStyle?: EmailStyle;
  condition?: Prisma.InputJsonValue | null;
  isActive?: boolean;
};

const OPEN_ENROLLMENT: SequenceEnrollmentStatus[] = [
  SequenceEnrollmentStatus.PENDING,
  SequenceEnrollmentStatus.ACTIVE,
  SequenceEnrollmentStatus.PROCESSING,
  SequenceEnrollmentStatus.PAUSED,
];

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

    const status = input.status ?? OutreachSequenceStatus.DRAFT;
    if (status === OutreachSequenceStatus.ACTIVE) {
      this.assertActivatableSteps(input.steps ?? []);
    }

    return prisma.outreachSequence.create({
      data: {
        organizationId,
        name: input.name.trim(),
        description: input.description,
        status,
        stopOnReply: input.stopOnReply ?? true,
        stopOnMeeting: input.stopOnMeeting ?? true,
        stopOnUnsubscribe: input.stopOnUnsubscribe ?? true,
        steps: input.steps?.length
          ? {
              create: input.steps.map((s) => this.normalizeStep(s)),
            }
          : undefined,
      },
      include: { steps: { orderBy: { stepOrder: "asc" } } },
    });
  }

  /**
   * Update sequence metadata and/or replace steps.
   * Edit safety (Phase 4 Option B): running enrollments use stepsSnapshot.
   * Replacing steps only affects NEW enrollments.
   */
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
    const existing = await this.getById(organizationId, id);

    if (existing.status === OutreachSequenceStatus.ARCHIVED) {
      if (input.status && input.status !== OutreachSequenceStatus.ARCHIVED) {
        // allow un-archive to DRAFT/PAUSED only via explicit status
      } else if (input.steps || input.name || input.description !== undefined) {
        throw new ValidationError(
          "Archived sequences cannot be edited — restore status first"
        );
      }
    }

    if (input.status === OutreachSequenceStatus.ACTIVE) {
      const stepsForCheck =
        input.steps ??
        existing.steps.map((s) => ({
          stepOrder: s.stepOrder,
          delayMinutes: s.delayMinutes,
          channel: s.channel,
          subjectTemplate: s.subjectTemplate,
          bodyTemplate: s.bodyTemplate,
          isActive: s.isActive,
        }));
      this.assertActivatableSteps(stepsForCheck);
    }

    const openCount = await prisma.sequenceEnrollment.count({
      where: {
        organizationId,
        sequenceId: id,
        status: { in: OPEN_ENROLLMENT },
      },
    });

    if (input.steps) {
      for (const step of input.steps) {
        if (
          step.channel &&
          step.channel !== ConversationChannel.EMAIL &&
          step.isActive !== false
        ) {
          // Allow storing unsupported channels but they will not execute
        }
      }
      await prisma.$transaction(async (tx) => {
        await tx.outreachSequenceStep.deleteMany({ where: { sequenceId: id } });
        if (input.steps!.length) {
          await tx.outreachSequenceStep.createMany({
            data: input.steps!.map((s) => ({
              sequenceId: id,
              ...this.normalizeStep(s),
            })),
          });
        }
        await tx.outreachSequence.update({
          where: { id },
          data: {
            name: input.name?.trim(),
            description: input.description,
            status: input.status,
            stopOnReply: input.stopOnReply,
            stopOnMeeting: input.stopOnMeeting,
            stopOnUnsubscribe: input.stopOnUnsubscribe,
          },
        });
      });
    } else {
      await prisma.outreachSequence.update({
        where: { id },
        data: {
          name: input.name?.trim(),
          description: input.description,
          status: input.status,
          stopOnReply: input.stopOnReply,
          stopOnMeeting: input.stopOnMeeting,
          stopOnUnsubscribe: input.stopOnUnsubscribe,
        },
      });
    }

    const updated = await this.getById(organizationId, id);
    return {
      ...updated,
      editSafety: {
        strategy: "enrollment_steps_snapshot" as const,
        openEnrollments: openCount,
        stepsUpdatedAffectsNewOnly: Boolean(input.steps),
      },
    };
  }

  async archive(organizationId: string, id: string) {
    await this.getById(organizationId, id);
    return prisma.outreachSequence.update({
      where: { id },
      data: { status: OutreachSequenceStatus.ARCHIVED },
      include: { steps: { orderBy: { stepOrder: "asc" } } },
    });
  }

  async setStatus(
    organizationId: string,
    id: string,
    status: OutreachSequenceStatus
  ) {
    return this.update(organizationId, id, { status });
  }

  private normalizeStep(s: SequenceStepInput) {
    return {
      stepOrder: s.stepOrder,
      delayMinutes: s.delayMinutes ?? 0,
      channel: s.channel ?? ConversationChannel.EMAIL,
      subjectTemplate: s.subjectTemplate ?? null,
      bodyTemplate: s.bodyTemplate,
      emailStyle: EmailStyle.BRANDED,
      condition: (s.condition ?? undefined) as Prisma.InputJsonValue | undefined,
      isActive: s.isActive ?? true,
    };
  }

  private assertActivatableSteps(
    steps: {
      bodyTemplate?: string;
      channel?: ConversationChannel | string;
      isActive?: boolean;
    }[]
  ) {
    const active = steps.filter((s) => s.isActive !== false);
    if (!active.length) {
      throw new ValidationError("Cannot activate a sequence with no active steps");
    }
    for (const s of active) {
      if (!s.bodyTemplate?.trim()) {
        throw new ValidationError("Each active step needs an email body");
      }
    }
  }
}

export const outreachSequenceService = new OutreachSequenceService();
