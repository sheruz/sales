import { randomUUID } from "crypto";
import prisma from "@/lib/db/prisma";
import {
  CampaignStatus,
  ConversationChannel,
  OpportunityStatus,
  OutreachSequenceStatus,
  SequenceEnrollmentStatus,
  SequenceEnrollmentStopReason,
  SequenceExecutionStatus,
} from "@prisma/client";
import { inboxService } from "@/services/inbox.service";
import { emailSafetyService } from "@/services/email-safety.service";
import {
  buildSequenceTemplateVars,
  computeNextRunAt,
  enrollmentStepIdempotencyKey,
  renderSequenceTemplate,
} from "@/lib/sequences/runtime";

const CLAIM_STALE_MS = 5 * 60_000;
const BATCH_SIZE = 20;

type ProcessResult = {
  enrollmentId: string;
  organizationId: string;
  status: string;
  reason?: string;
};

/**
 * Canonical sequence executor (Phase 3).
 * Reuses inboxService.sendOutreach + emailSafetyService — does not create a second email engine.
 * Claim via conditional UPDATE (status ACTIVE → PROCESSING) for concurrency safety.
 */
export class SequenceExecutorService {
  async processDueEnrollments(limit = BATCH_SIZE): Promise<ProcessResult[]> {
    const results: ProcessResult[] = [];
    const claimed = await this.claimDue(limit);
    for (const enrollment of claimed) {
      try {
        const result = await this.executeClaimed(enrollment.id, enrollment.claimToken!);
        results.push(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : "executor failed";
        await this.failOrRetry(enrollment.id, enrollment.organizationId, message);
        results.push({
          enrollmentId: enrollment.id,
          organizationId: enrollment.organizationId,
          status: "error",
          reason: message,
        });
      }
    }
    return results;
  }

  /**
   * Atomically claim due ACTIVE enrollments.
   * Stale PROCESSING claims (crashed workers) are reclaimed.
   */
  async claimDue(limit = BATCH_SIZE) {
    const now = new Date();
    const staleBefore = new Date(now.getTime() - CLAIM_STALE_MS);

    // Reclaim stale PROCESSING
    await prisma.sequenceEnrollment.updateMany({
      where: {
        status: SequenceEnrollmentStatus.PROCESSING,
        claimedAt: { lt: staleBefore },
      },
      data: {
        status: SequenceEnrollmentStatus.ACTIVE,
        claimToken: null,
        claimedAt: null,
      },
    });

    const due = await prisma.sequenceEnrollment.findMany({
      where: {
        status: SequenceEnrollmentStatus.ACTIVE,
        nextRunAt: { lte: now },
      },
      orderBy: { nextRunAt: "asc" },
      take: limit,
      select: { id: true, organizationId: true },
    });

    const claimed: { id: string; organizationId: string; claimToken: string }[] =
      [];

    for (const row of due) {
      const token = randomUUID();
      const updated = await prisma.sequenceEnrollment.updateMany({
        where: {
          id: row.id,
          organizationId: row.organizationId,
          status: SequenceEnrollmentStatus.ACTIVE,
          nextRunAt: { lte: now },
        },
        data: {
          status: SequenceEnrollmentStatus.PROCESSING,
          claimedAt: now,
          claimToken: token,
        },
      });
      if (updated.count === 1) {
        claimed.push({
          id: row.id,
          organizationId: row.organizationId,
          claimToken: token,
        });
      }
    }

    return claimed;
  }

  async executeClaimed(
    enrollmentId: string,
    claimToken: string
  ): Promise<ProcessResult> {
    const enrollment = await prisma.sequenceEnrollment.findFirst({
      where: {
        id: enrollmentId,
        status: SequenceEnrollmentStatus.PROCESSING,
        claimToken,
      },
      include: {
        sequence: {
          include: { steps: { orderBy: { stepOrder: "asc" } } },
        },
        campaign: true,
        contact: { include: { company: true } },
        opportunity: {
          include: {
            company: true,
            recommendedService: true,
            primarySignal: true,
          },
        },
        organization: { select: { id: true, name: true } },
      },
    });

    if (!enrollment) {
      return {
        enrollmentId,
        organizationId: "unknown",
        status: "skipped",
        reason: "claim_lost",
      };
    }

    const orgId = enrollment.organizationId;

    // Stop condition checks
    const stop = await this.evaluateStopConditions(enrollment);
    if (stop) {
      await prisma.sequenceEnrollment.updateMany({
        where: { id: enrollment.id, claimToken, organizationId: orgId },
        data: {
          status: SequenceEnrollmentStatus.STOPPED,
          stoppedAt: new Date(),
          stopReason: stop,
          nextRunAt: null,
          claimToken: null,
          claimedAt: null,
        },
      });
      return {
        enrollmentId: enrollment.id,
        organizationId: orgId,
        status: "stopped",
        reason: stop,
      };
    }

    const step = enrollment.sequence.steps.find(
      (s) => s.stepOrder === enrollment.currentStepOrder && s.isActive
    );
    if (!step) {
      await prisma.sequenceEnrollment.updateMany({
        where: { id: enrollment.id, claimToken, organizationId: orgId },
        data: {
          status: SequenceEnrollmentStatus.COMPLETED,
          completedAt: new Date(),
          stopReason: SequenceEnrollmentStopReason.COMPLETED_NATURALLY,
          nextRunAt: null,
          claimToken: null,
          claimedAt: null,
        },
      });
      return {
        enrollmentId: enrollment.id,
        organizationId: orgId,
        status: "completed",
        reason: "no_active_step",
      };
    }

    if (step.channel !== ConversationChannel.EMAIL) {
      // Phase 3: email only — skip non-email steps without failing forever
      const next = this.findNextStep(
        enrollment.sequence.steps,
        enrollment.currentStepOrder
      );
      if (!next) {
        await this.complete(enrollment.id, orgId, claimToken);
        return {
          enrollmentId: enrollment.id,
          organizationId: orgId,
          status: "completed",
        };
      }
      await prisma.sequenceEnrollment.updateMany({
        where: { id: enrollment.id, claimToken, organizationId: orgId },
        data: {
          status: SequenceEnrollmentStatus.ACTIVE,
          currentStepOrder: next.stepOrder,
          nextRunAt: computeNextRunAt(new Date(), next.delayMinutes),
          claimToken: null,
          claimedAt: null,
        },
      });
      return {
        enrollmentId: enrollment.id,
        organizationId: orgId,
        status: "skipped_channel",
        reason: step.channel,
      };
    }

    const toEmail = enrollment.contact.email?.trim();
    if (!toEmail) {
      await this.stopEnrollment(
        enrollment.id,
        orgId,
        claimToken,
        SequenceEnrollmentStopReason.CONTACT_INVALID
      );
      return {
        enrollmentId: enrollment.id,
        organizationId: orgId,
        status: "stopped",
        reason: "CONTACT_INVALID",
      };
    }

    const suppressed = await emailSafetyService.isSuppressed(orgId, toEmail);
    if (suppressed) {
      await this.stopEnrollment(
        enrollment.id,
        orgId,
        claimToken,
        SequenceEnrollmentStopReason.SUPPRESSED
      );
      return {
        enrollmentId: enrollment.id,
        organizationId: orgId,
        status: "stopped",
        reason: "SUPPRESSED",
      };
    }

    // Org daily email limit (in addition to account limits enforced by inbox)
    const orgLimitOk = await this.checkOrgDailyEmailLimit(orgId);
    if (!orgLimitOk) {
      // Defer without failing — keep ACTIVE, schedule later
      await prisma.sequenceEnrollment.updateMany({
        where: { id: enrollment.id, claimToken, organizationId: orgId },
        data: {
          status: SequenceEnrollmentStatus.ACTIVE,
          nextRunAt: new Date(Date.now() + 60 * 60_000),
          lastError: "Organization daily email limit reached — deferred",
          claimToken: null,
          claimedAt: null,
        },
      });
      return {
        enrollmentId: enrollment.id,
        organizationId: orgId,
        status: "deferred",
        reason: "org_daily_limit",
      };
    }

    const idempotencyKey = enrollmentStepIdempotencyKey(
      enrollment.id,
      step.stepOrder
    );

    // Already executed this step?
    const prior = await prisma.sequenceEnrollmentExecution.findUnique({
      where: { idempotencyKey },
    });
    if (prior?.status === SequenceExecutionStatus.SUCCESS) {
      return this.advanceAfterSuccess(
        enrollment,
        claimToken,
        step.stepOrder
      );
    }

    const company =
      enrollment.opportunity?.company ?? enrollment.contact.company;
    const vars = buildSequenceTemplateVars({
      contact: enrollment.contact,
      company,
      opportunity: enrollment.opportunity,
      organization: enrollment.organization,
      service: enrollment.opportunity?.recommendedService,
    });

    const subject = renderSequenceTemplate(
      step.subjectTemplate ||
        `Following up with {{company.name}}`,
      vars
    );
    const body = renderSequenceTemplate(step.bodyTemplate, vars);

    const senderUserId =
      enrollment.enrolledById ||
      enrollment.opportunity?.ownerId ||
      null;
    if (!senderUserId) {
      throw new Error(
        "No enrolledBy/owner user available to send from email account"
      );
    }

    try {
      const sent = await inboxService.sendOutreach({
        organizationId: orgId,
        userId: senderUserId,
        toEmail,
        subject,
        body,
        companyId: company?.id ?? enrollment.contact.companyId,
        contactId: enrollment.contactId,
        opportunityId: enrollment.opportunityId,
        leadId: enrollment.leadId,
        idempotencyKey,
      });

      await prisma.sequenceEnrollmentExecution.create({
        data: {
          organizationId: orgId,
          enrollmentId: enrollment.id,
          stepOrder: step.stepOrder,
          status: SequenceExecutionStatus.SUCCESS,
          messageId: sent.message.id,
          idempotencyKey,
          metadata: { subject },
        },
      });

      return this.advanceAfterSuccess(
        enrollment,
        claimToken,
        step.stepOrder
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "send failed";

      // Duplicate idempotency from safety layer = treat as already sent
      if (
        message.toLowerCase().includes("duplicate idempotency") ||
        message.toLowerCase().includes("idempotency key")
      ) {
        await prisma.sequenceEnrollmentExecution.upsert({
          where: { idempotencyKey },
          create: {
            organizationId: orgId,
            enrollmentId: enrollment.id,
            stepOrder: step.stepOrder,
            status: SequenceExecutionStatus.SUCCESS,
            idempotencyKey,
            metadata: { recovered: true },
          },
          update: {},
        });
        return this.advanceAfterSuccess(
          enrollment,
          claimToken,
          step.stepOrder
        );
      }

      await prisma.sequenceEnrollmentExecution.create({
        data: {
          organizationId: orgId,
          enrollmentId: enrollment.id,
          stepOrder: step.stepOrder,
          status: SequenceExecutionStatus.FAILED,
          error: message.slice(0, 2000),
          idempotencyKey: `${idempotencyKey}:fail:${randomUUID()}`,
        },
      });

      await this.failOrRetry(enrollment.id, orgId, message, claimToken);
      return {
        enrollmentId: enrollment.id,
        organizationId: orgId,
        status: "failed",
        reason: message,
      };
    }
  }

  private async advanceAfterSuccess(
    enrollment: {
      id: string;
      organizationId: string;
      currentStepOrder: number;
      sequence: { steps: { stepOrder: number; delayMinutes: number; isActive: boolean }[] };
    },
    claimToken: string,
    completedStepOrder: number
  ): Promise<ProcessResult> {
    const next = this.findNextStep(
      enrollment.sequence.steps,
      completedStepOrder
    );
    const now = new Date();

    if (!next) {
      await this.complete(
        enrollment.id,
        enrollment.organizationId,
        claimToken
      );
      return {
        enrollmentId: enrollment.id,
        organizationId: enrollment.organizationId,
        status: "completed",
      };
    }

    await prisma.sequenceEnrollment.updateMany({
      where: {
        id: enrollment.id,
        organizationId: enrollment.organizationId,
        claimToken,
      },
      data: {
        status: SequenceEnrollmentStatus.ACTIVE,
        currentStepOrder: next.stepOrder,
        nextRunAt: computeNextRunAt(now, next.delayMinutes),
        lastExecutedAt: now,
        lastError: null,
        retryCount: 0,
        claimToken: null,
        claimedAt: null,
      },
    });

    return {
      enrollmentId: enrollment.id,
      organizationId: enrollment.organizationId,
      status: "advanced",
      reason: `next_step_${next.stepOrder}`,
    };
  }

  private findNextStep(
    steps: { stepOrder: number; delayMinutes: number; isActive: boolean }[],
    afterOrder: number
  ) {
    return steps
      .filter((s) => s.isActive && s.stepOrder > afterOrder)
      .sort((a, b) => a.stepOrder - b.stepOrder)[0];
  }

  private async evaluateStopConditions(enrollment: {
    organizationId: string;
    contactId: string;
    opportunityId: string | null;
    campaignId: string | null;
    sequence: {
      status: OutreachSequenceStatus;
      stopOnReply: boolean;
      stopOnMeeting: boolean;
      stopOnUnsubscribe: boolean;
    };
    campaign: { status: CampaignStatus; deletedAt: Date | null } | null;
    opportunity: {
      status: OpportunityStatus;
      stage: string;
    } | null;
    contact: { email: string | null; id: string };
  }): Promise<SequenceEnrollmentStopReason | null> {
    if (
      enrollment.sequence.status === OutreachSequenceStatus.ARCHIVED ||
      enrollment.sequence.status === OutreachSequenceStatus.DRAFT
    ) {
      return SequenceEnrollmentStopReason.SEQUENCE_INACTIVE;
    }
    // PAUSED sequence: do not execute — defer by returning SEQUENCE_INACTIVE for stop,
    // or we could leave ACTIVE and skip. Spec: sequence deactivated → stop.
    if (enrollment.sequence.status === OutreachSequenceStatus.PAUSED) {
      return SequenceEnrollmentStopReason.SEQUENCE_INACTIVE;
    }

    if (enrollment.campaign) {
      if (
        enrollment.campaign.deletedAt ||
        enrollment.campaign.status === CampaignStatus.COMPLETED ||
        enrollment.campaign.status === CampaignStatus.DRAFT
      ) {
        return SequenceEnrollmentStopReason.CAMPAIGN_INACTIVE;
      }
      if (enrollment.campaign.status === CampaignStatus.PAUSED) {
        return SequenceEnrollmentStopReason.CAMPAIGN_INACTIVE;
      }
    }

    if (
      enrollment.opportunity &&
      (enrollment.opportunity.status === OpportunityStatus.WON ||
        enrollment.opportunity.status === OpportunityStatus.LOST ||
        enrollment.opportunity.status === OpportunityStatus.DISQUALIFIED)
    ) {
      return SequenceEnrollmentStopReason.OPPORTUNITY_CLOSED;
    }

    if (enrollment.sequence.stopOnMeeting && enrollment.opportunityId) {
      const meeting = await prisma.meeting.findFirst({
        where: {
          organizationId: enrollment.organizationId,
          OR: [
            { opportunityId: enrollment.opportunityId },
            { contactId: enrollment.contactId },
          ],
        },
        select: { id: true },
      });
      if (meeting) return SequenceEnrollmentStopReason.MEETING_BOOKED;
    }

    if (enrollment.sequence.stopOnReply) {
      const replied = await prisma.emailEvent.findFirst({
        where: {
          organizationId: enrollment.organizationId,
          type: "REPLIED",
          conversation: {
            OR: [
              { contactId: enrollment.contactId },
              ...(enrollment.opportunityId
                ? [{ opportunityId: enrollment.opportunityId }]
                : []),
            ],
          },
        },
        select: { id: true },
      });
      if (replied) return SequenceEnrollmentStopReason.REPLIED;
    }

    if (enrollment.sequence.stopOnUnsubscribe && enrollment.contact.email) {
      const suppressed = await emailSafetyService.isSuppressed(
        enrollment.organizationId,
        enrollment.contact.email
      );
      if (suppressed?.reason === "UNSUBSCRIBE") {
        return SequenceEnrollmentStopReason.UNSUBSCRIBED;
      }
    }

    return null;
  }

  private async checkOrgDailyEmailLimit(organizationId: string) {
    const settings = await prisma.organizationSettings.findUnique({
      where: { organizationId },
    });
    const limit = settings?.dailyEmailLimit ?? 50;
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const sentToday = await prisma.message.count({
      where: {
        organizationId,
        direction: "OUTBOUND",
        status: { in: ["SENT", "DELIVERED", "OPENED", "CLICKED", "REPLIED"] },
        sentAt: { gte: start },
      },
    });
    return sentToday < limit;
  }

  private async complete(
    enrollmentId: string,
    organizationId: string,
    claimToken: string
  ) {
    await prisma.sequenceEnrollment.updateMany({
      where: { id: enrollmentId, organizationId, claimToken },
      data: {
        status: SequenceEnrollmentStatus.COMPLETED,
        completedAt: new Date(),
        stopReason: SequenceEnrollmentStopReason.COMPLETED_NATURALLY,
        nextRunAt: null,
        lastExecutedAt: new Date(),
        claimToken: null,
        claimedAt: null,
      },
    });
  }

  private async stopEnrollment(
    enrollmentId: string,
    organizationId: string,
    claimToken: string,
    reason: SequenceEnrollmentStopReason
  ) {
    await prisma.sequenceEnrollment.updateMany({
      where: { id: enrollmentId, organizationId, claimToken },
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

  private async failOrRetry(
    enrollmentId: string,
    organizationId: string,
    error: string,
    claimToken?: string | null
  ) {
    const enrollment = await prisma.sequenceEnrollment.findFirst({
      where: { id: enrollmentId, organizationId },
    });
    if (!enrollment) return;

    const retryCount = enrollment.retryCount + 1;
    const canRetry = retryCount < enrollment.maxRetries;
    const backoffMs = 60_000 * 2 ** Math.min(retryCount - 1, 5);

    await prisma.sequenceEnrollment.updateMany({
      where: {
        id: enrollmentId,
        organizationId,
        ...(claimToken ? { claimToken } : {}),
      },
      data: {
        status: canRetry
          ? SequenceEnrollmentStatus.ACTIVE
          : SequenceEnrollmentStatus.FAILED,
        retryCount,
        lastError: error.slice(0, 2000),
        nextRunAt: canRetry ? new Date(Date.now() + backoffMs) : null,
        claimToken: null,
        claimedAt: null,
        ...(canRetry
          ? {}
          : { stopReason: SequenceEnrollmentStopReason.MAX_RETRIES }),
      },
    });
  }
}

export const sequenceExecutorService = new SequenceExecutorService();
