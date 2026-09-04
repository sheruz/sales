import { randomUUID } from "crypto";
import prisma from "@/lib/db/prisma";
import {
  CampaignStatus,
  OpportunityStatus,
  OutreachSequenceStatus,
  Prisma,
  SequenceEnrollmentStatus,
  SequenceEnrollmentStopReason,
  type SequenceEnrollment,
} from "@prisma/client";
import { NotFoundError, ValidationError } from "@/lib/api/response";
import {
  ACTIVE_ENROLLMENT_STATUSES,
  computeNextRunAt,
} from "@/lib/sequences/runtime";

export type EnrollInput = {
  sequenceId: string;
  contactId: string;
  opportunityId?: string | null;
  campaignId?: string | null;
  /** LEGACY optional */
  leadId?: string | null;
  enrolledById?: string | null;
  startImmediately?: boolean;
};

export type EnrollmentListQuery = {
  page?: number;
  limit?: number;
  status?: SequenceEnrollmentStatus;
  sequenceId?: string;
  campaignId?: string;
  opportunityId?: string;
  contactId?: string;
};

const OPEN_DUP_STATUSES: SequenceEnrollmentStatus[] = [
  SequenceEnrollmentStatus.PENDING,
  SequenceEnrollmentStatus.ACTIVE,
  SequenceEnrollmentStatus.PROCESSING,
  SequenceEnrollmentStatus.PAUSED,
];

export class SequenceEnrollmentService {
  async list(organizationId: string, query: EnrollmentListQuery = {}) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 25));
    const skip = (page - 1) * limit;

    const where: Prisma.SequenceEnrollmentWhereInput = {
      organizationId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.sequenceId ? { sequenceId: query.sequenceId } : {}),
      ...(query.campaignId ? { campaignId: query.campaignId } : {}),
      ...(query.opportunityId ? { opportunityId: query.opportunityId } : {}),
      ...(query.contactId ? { contactId: query.contactId } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.sequenceEnrollment.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip,
        take: limit,
        include: {
          sequence: { select: { id: true, name: true, status: true } },
          campaign: { select: { id: true, name: true, status: true } },
          opportunity: {
            select: { id: true, stage: true, status: true, whyNow: true },
          },
          contact: {
            select: {
              id: true,
              fullName: true,
              email: true,
              title: true,
              companyId: true,
            },
          },
          executions: {
            orderBy: { executedAt: "desc" },
            take: 5,
          },
        },
      }),
      prisma.sequenceEnrollment.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async getById(organizationId: string, id: string) {
    const enrollment = await prisma.sequenceEnrollment.findFirst({
      where: { id, organizationId },
      include: {
        sequence: {
          include: { steps: { orderBy: { stepOrder: "asc" } } },
        },
        campaign: true,
        opportunity: {
          include: {
            company: { select: { id: true, name: true, domain: true } },
            primarySignal: { select: { id: true, title: true } },
          },
        },
        contact: {
          include: {
            company: { select: { id: true, name: true, domain: true } },
          },
        },
        lead: { select: { id: true, fullName: true, email: true } },
        executions: { orderBy: { executedAt: "desc" }, take: 50 },
      },
    });
    if (!enrollment) throw new NotFoundError("Enrollment not found");
    return enrollment;
  }

  /**
   * Enroll Contact (+ optional Opportunity) into Sequence.
   * Does NOT require Lead. Prevents duplicate open enrollments per org+sequence+contact.
   */
  async enroll(organizationId: string, input: EnrollInput) {
    const sequence = await prisma.outreachSequence.findFirst({
      where: { id: input.sequenceId, organizationId },
      include: { steps: { orderBy: { stepOrder: "asc" } } },
    });
    if (!sequence) throw new ValidationError("Sequence not found");
    if (sequence.status === OutreachSequenceStatus.ARCHIVED) {
      throw new ValidationError("Cannot enroll into an archived sequence");
    }
    if (!sequence.steps.length) {
      throw new ValidationError("Sequence has no steps");
    }

    const contact = await prisma.contact.findFirst({
      where: { id: input.contactId, organizationId },
    });
    if (!contact) throw new ValidationError("Contact not found in your organization");
    if (!contact.email?.trim()) {
      throw new ValidationError("Contact must have an email to enroll");
    }

    let opportunityId = input.opportunityId ?? null;
    if (opportunityId) {
      const opportunity = await prisma.opportunity.findFirst({
        where: { id: opportunityId, organizationId },
      });
      if (!opportunity) {
        throw new ValidationError("Opportunity not found in your organization");
      }
      if (opportunity.companyId !== contact.companyId) {
        throw new ValidationError(
          "Contact does not belong to the opportunity company"
        );
      }
    }

    let campaignId = input.campaignId ?? null;
    if (campaignId) {
      const campaign = await prisma.campaign.findFirst({
        where: {
          id: campaignId,
          organizationId,
          deletedAt: null,
        },
      });
      if (!campaign) {
        throw new ValidationError("Campaign not found in your organization");
      }
    }

    let leadId = input.leadId ?? contact.leadId ?? null;
    if (leadId) {
      const lead = await prisma.lead.findFirst({
        where: { id: leadId, organizationId, deletedAt: null },
        select: { id: true },
      });
      if (!lead) leadId = null;
    }

    const existing = await prisma.sequenceEnrollment.findFirst({
      where: {
        organizationId,
        sequenceId: sequence.id,
        contactId: contact.id,
        status: { in: OPEN_DUP_STATUSES },
      },
    });
    if (existing) {
      throw new ValidationError(
        "Contact already has an active enrollment in this sequence"
      );
    }

    const firstStep = sequence.steps[0];
    const now = new Date();
    const startImmediately = input.startImmediately !== false;
    const nextRunAt = startImmediately
      ? now
      : computeNextRunAt(now, firstStep.delayMinutes);

    try {
      const enrollment = await prisma.sequenceEnrollment.create({
        data: {
          organizationId,
          sequenceId: sequence.id,
          campaignId,
          opportunityId,
          contactId: contact.id,
          leadId,
          status: SequenceEnrollmentStatus.ACTIVE,
          currentStepOrder: firstStep.stepOrder,
          nextRunAt,
          startedAt: now,
          enrolledById: input.enrolledById ?? null,
          idempotencyKey: `enroll:${organizationId}:${sequence.id}:${contact.id}:${randomUUID()}`,
        },
        include: {
          sequence: { select: { id: true, name: true } },
          contact: { select: { id: true, fullName: true, email: true } },
          opportunity: { select: { id: true, stage: true } },
        },
      });

      if (opportunityId && campaignId) {
        await prisma.opportunity.updateMany({
          where: {
            id: opportunityId,
            organizationId,
            campaignId: null,
          },
          data: { campaignId },
        });
      }

      return enrollment;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        throw new ValidationError(
          "Contact already has an active enrollment in this sequence"
        );
      }
      throw err;
    }
  }

  async pause(organizationId: string, id: string) {
    const enrollment = await this.requireMutable(organizationId, id);
    if (
      enrollment.status !== SequenceEnrollmentStatus.ACTIVE &&
      enrollment.status !== SequenceEnrollmentStatus.PENDING
    ) {
      throw new ValidationError("Only active enrollments can be paused");
    }
    return prisma.sequenceEnrollment.update({
      where: { id },
      data: {
        status: SequenceEnrollmentStatus.PAUSED,
        pausedAt: new Date(),
        claimToken: null,
        claimedAt: null,
      },
    });
  }

  async resume(organizationId: string, id: string) {
    const enrollment = await this.requireMutable(organizationId, id);
    if (enrollment.status !== SequenceEnrollmentStatus.PAUSED) {
      throw new ValidationError("Only paused enrollments can be resumed");
    }
    return prisma.sequenceEnrollment.update({
      where: { id },
      data: {
        status: SequenceEnrollmentStatus.ACTIVE,
        pausedAt: null,
        nextRunAt: enrollment.nextRunAt ?? new Date(),
      },
    });
  }

  async stop(
    organizationId: string,
    id: string,
    reason: SequenceEnrollmentStopReason = SequenceEnrollmentStopReason.MANUAL
  ) {
    await this.requireMutable(organizationId, id);
    return prisma.sequenceEnrollment.update({
      where: { id },
      data: {
        status: SequenceEnrollmentStatus.STOPPED,
        stoppedAt: new Date(),
        stopReason: reason,
        nextRunAt: null,
        claimToken: null,
        claimedAt: null,
      },
    });
  }

  async retry(organizationId: string, id: string) {
    const enrollment = await this.getById(organizationId, id);
    if (enrollment.status !== SequenceEnrollmentStatus.FAILED) {
      throw new ValidationError("Only failed enrollments can be retried");
    }
    return prisma.sequenceEnrollment.update({
      where: { id },
      data: {
        status: SequenceEnrollmentStatus.ACTIVE,
        lastError: null,
        retryCount: 0,
        nextRunAt: new Date(),
        claimToken: null,
        claimedAt: null,
      },
    });
  }

  /** Stop open enrollments for a contact after reply (hook from inbox). */
  async stopForContactReply(organizationId: string, contactId: string) {
    return prisma.sequenceEnrollment.updateMany({
      where: {
        organizationId,
        contactId,
        status: {
          in: [
            SequenceEnrollmentStatus.ACTIVE,
            SequenceEnrollmentStatus.PENDING,
            SequenceEnrollmentStatus.PAUSED,
            SequenceEnrollmentStatus.PROCESSING,
          ],
        },
        sequence: { stopOnReply: true },
      },
      data: {
        status: SequenceEnrollmentStatus.STOPPED,
        stoppedAt: new Date(),
        stopReason: SequenceEnrollmentStopReason.REPLIED,
        nextRunAt: null,
        claimToken: null,
        claimedAt: null,
      },
    });
  }

  async stopForContactUnsubscribe(organizationId: string, contactId: string) {
    return prisma.sequenceEnrollment.updateMany({
      where: {
        organizationId,
        contactId,
        status: {
          in: [
            SequenceEnrollmentStatus.ACTIVE,
            SequenceEnrollmentStatus.PENDING,
            SequenceEnrollmentStatus.PAUSED,
            SequenceEnrollmentStatus.PROCESSING,
          ],
        },
        sequence: { stopOnUnsubscribe: true },
      },
      data: {
        status: SequenceEnrollmentStatus.STOPPED,
        stoppedAt: new Date(),
        stopReason: SequenceEnrollmentStopReason.UNSUBSCRIBED,
        nextRunAt: null,
        claimToken: null,
        claimedAt: null,
      },
    });
  }

  private async requireMutable(
    organizationId: string,
    id: string
  ): Promise<SequenceEnrollment> {
    const enrollment = await prisma.sequenceEnrollment.findFirst({
      where: { id, organizationId },
    });
    if (!enrollment) throw new NotFoundError("Enrollment not found");
    if (
      enrollment.status === SequenceEnrollmentStatus.COMPLETED ||
      enrollment.status === SequenceEnrollmentStatus.STOPPED
    ) {
      throw new ValidationError(`Enrollment is already ${enrollment.status}`);
    }
    return enrollment;
  }
}

export const sequenceEnrollmentService = new SequenceEnrollmentService();

export { ACTIVE_ENROLLMENT_STATUSES };
