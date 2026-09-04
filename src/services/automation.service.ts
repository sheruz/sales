import prisma from "@/lib/db/prisma";
import {
  ActivityType,
  AutomationStatus,
  FollowUpJobStatus,
  LeadStatus,
} from "@prisma/client";
import { NotFoundError, ValidationError } from "@/lib/api/response";
import { activityService } from "@/services/activity.service";
import { aiResearchService } from "@/services/ai-research.service";
import { aiOutreachService } from "@/services/ai-outreach.service";
import {
  getOutreachChannelsForUser,
  isEmailConfiguredForOutreach,
  type OutreachChannel,
} from "@/lib/outreach/channels";
import { entitlementService } from "@/services/entitlement.service";
import { FEATURE_KEYS } from "@/lib/billing/features";

const LOCKABLE_STATUSES: AutomationStatus[] = [
  AutomationStatus.IDLE,
  AutomationStatus.FAILED,
  AutomationStatus.PAUSED,
  AutomationStatus.COMPLETED,
];

export class AutomationService {
  async lockLead(organizationId: string, leadId: string, userId?: string) {
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, organizationId, deletedAt: null },
    });
    if (!lead) throw new NotFoundError("Lead not found");

    if (!LOCKABLE_STATUSES.includes(lead.automationStatus)) {
      throw new ValidationError(
        `Lead is already in automation: ${lead.automationStatus}`
      );
    }

    return prisma.lead.update({
      where: { id: leadId },
      data: {
        automationStatus: AutomationStatus.LOCKED,
        lockedAt: new Date(),
        lockedById: userId ?? null,
        automationError: null,
      },
    });
  }

  async unlockLead(organizationId: string, leadId: string, userId?: string) {
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, organizationId },
    });
    if (!lead) throw new NotFoundError("Lead not found");

    await prisma.lead.update({
      where: { id: leadId },
      data: {
        automationStatus: AutomationStatus.IDLE,
        lockedAt: null,
        lockedById: null,
        automationError: null,
      },
    });

    await activityService.log({
      leadId,
      userId,
      type: ActivityType.LEAD_UPDATED,
      title: "Lead unlocked from automation",
    });

    return { success: true };
  }

  async startBatch(
    organizationId: string,
    leadIds: string[],
    campaignId?: string,
    userId?: string,
    channels?: OutreachChannel[]
  ) {
    await entitlementService.assertAndConsume(
      organizationId,
      FEATURE_KEYS.AUTOMATION
    );
    const resolvedChannels =
      channels ?? (userId ? await getOutreachChannelsForUser(userId) : ["email"]);
    const results = [];

    for (const leadId of leadIds) {
      try {
        await this.lockLead(organizationId, leadId, userId);

        if (campaignId) {
          await prisma.lead.update({
            where: { id: leadId },
            data: { campaignId },
          });
        }

        await prisma.lead.update({
          where: { id: leadId },
          data: { nextAutomationAt: new Date() },
        });

        await this.runPipeline(organizationId, leadId, userId, {
          channels: resolvedChannels,
        });

        results.push({ leadId, status: "completed" });
      } catch (err) {
        results.push({
          leadId,
          status: "failed",
          error: err instanceof Error ? err.message : "failed",
        });
      }
    }

    return results;
  }

  async runPipeline(
    organizationId: string,
    leadId: string,
    userId?: string,
    options?: {
      channels?: OutreachChannel[];
      skipResearch?: boolean;
    }
  ) {
    const channels = options?.channels ?? (await getOutreachChannelsForUser(userId));
    const emailOnly = channels.length === 1 && channels[0] === "email";
    const useLinkedIn = channels.includes("linkedin");
    const useEmail = channels.includes("email");

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, organizationId, deletedAt: null },
      include: { campaign: { include: { followUpSequence: true } } },
    });
    if (!lead) throw new NotFoundError("Lead not found");

    if (lead.unsubscribed) {
      throw new ValidationError("Lead has unsubscribed");
    }

    const alreadyProcessed = (
      [
        AutomationStatus.AWAITING_REPLY,
        AutomationStatus.OUTREACH_SENT,
        AutomationStatus.COMPLETED,
        AutomationStatus.FOLLOW_UP_SCHEDULED,
      ] as AutomationStatus[]
    ).includes(lead.automationStatus);

    if (alreadyProcessed) {
      return { skipped: true, leadId, reason: "Already automated" };
    }

    if (emailOnly && !lead.email) {
      throw new ValidationError("No email address — cannot send email outreach");
    }

    if (emailOnly && !(await isEmailConfiguredForOutreach(organizationId, userId))) {
      throw new ValidationError(
        "Email not configured. Connect SMTP in Settings → Integrations."
      );
    }

    try {
      if (
        lead.automationStatus === AutomationStatus.IDLE ||
        lead.automationStatus === AutomationStatus.FAILED ||
        lead.automationStatus === AutomationStatus.PAUSED ||
        lead.automationStatus === AutomationStatus.OUTREACH_READY
      ) {
        await this.lockLead(organizationId, leadId, userId);
      }

      const preResearched = Boolean(
        (lead.automationMeta as { preResearched?: boolean } | null)?.preResearched
      );

      const hasResearch = await prisma.leadResearch.findFirst({
        where: { leadId },
      });

      if (!hasResearch && !options?.skipResearch && !preResearched) {
        await aiResearchService.researchLead(leadId, userId);
      }

      let emailSent = false;

      if (useLinkedIn) {
        const linkedInDraft = await prisma.conversation.findFirst({
          where: { leadId, organizationId, channel: "LINKEDIN", isInbound: false },
        });
        if (!linkedInDraft && lead.linkedInUrl) {
          const { conversation } = await aiOutreachService.generateOutreach(
            organizationId,
            leadId,
            "linkedin",
            userId,
            lead.campaignId ?? undefined
          );
          await aiOutreachService.sendOutreach(
            organizationId,
            leadId,
            conversation.id,
            userId
          );
        }
      }

      if (useEmail && lead.email) {
        const emailDraft = await prisma.conversation.findFirst({
          where: { leadId, organizationId, channel: "EMAIL", isInbound: false },
        });
        if (!emailDraft) {
          const { conversation } = await aiOutreachService.generateOutreach(
            organizationId,
            leadId,
            "email",
            userId,
            lead.campaignId ?? undefined
          );
          await aiOutreachService.sendOutreach(
            organizationId,
            leadId,
            conversation.id,
            userId
          );
          emailSent = true;
        } else {
          const meta = emailDraft.metadata as { status?: string } | null;
          if (meta?.status !== "sent") {
            await aiOutreachService.sendOutreach(
              organizationId,
              leadId,
              emailDraft.id,
              userId
            );
            emailSent = true;
          } else {
            emailSent = true;
          }
        }
      }

      if (emailOnly && !emailSent) {
        throw new ValidationError("Email outreach was not sent");
      }

      if (lead.campaign?.followUpSequence) {
        await this.scheduleFollowUps(
          organizationId,
          leadId,
          lead.campaign.followUpSequence.steps,
          channels
        );
      }

      await prisma.lead.update({
        where: { id: leadId },
        data: {
          automationStatus: emailSent
            ? AutomationStatus.AWAITING_REPLY
            : AutomationStatus.OUTREACH_READY,
          status: emailSent ? LeadStatus.CONTACTED : LeadStatus.QUALIFIED,
          nextAutomationAt: null,
          automationError: null,
        },
      });

      await activityService.log({
        leadId,
        userId,
        type: ActivityType.CAMPAIGN_ASSIGNED,
        title: emailSent ? "Email outreach sent" : "AI automation pipeline completed",
        description: emailSent
          ? "Personalized email sent via SMTP"
          : "Research and drafts completed",
      });

      return { success: true, leadId, emailSent };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Automation failed";
      await prisma.lead.update({
        where: { id: leadId },
        data: {
          automationStatus: AutomationStatus.FAILED,
          automationError: message,
        },
      });
      throw err;
    }
  }

  async scheduleFollowUps(
    organizationId: string,
    leadId: string,
    steps: unknown,
    channels: OutreachChannel[] = ["email"]
  ) {
    if (!Array.isArray(steps)) return;

    const emailOnly = channels.length === 1 && channels[0] === "email";
    const now = new Date();
    let stepIndex = 0;

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i] as { delayDays?: number; channel?: string };
      const stepChannel = step.channel === "email" ? "email" : "linkedin";

      if (emailOnly && stepChannel !== "email") continue;

      const delayDays = step.delayDays ?? (stepIndex + 1) * 3;
      const scheduledAt = new Date(now.getTime() + delayDays * 24 * 60 * 60 * 1000);

      await prisma.followUpJob.create({
        data: {
          organizationId,
          leadId,
          stepIndex,
          scheduledAt,
          status: FollowUpJobStatus.PENDING,
          metadata: { ...step, channel: emailOnly ? "email" : stepChannel },
        },
      });
      stepIndex++;
    }

    if (stepIndex > 0) {
      await prisma.lead.update({
        where: { id: leadId },
        data: { automationStatus: AutomationStatus.FOLLOW_UP_SCHEDULED },
      });
    }
  }

  async processPendingJobs() {
    const orgs = await prisma.organization.findMany({
      where: { deletedAt: null, status: "ACTIVE" },
      select: { id: true },
    });

    const pipelineResults = [];
    const followUpResults = [];

    for (const org of orgs) {
      const dueLeads = await prisma.lead.findMany({
        where: {
          organizationId: org.id,
          deletedAt: null,
          automationStatus: AutomationStatus.LOCKED,
          nextAutomationAt: { lte: new Date() },
        },
        take: 10,
      });

      for (const lead of dueLeads) {
        try {
          await this.runPipeline(org.id, lead.id);
          pipelineResults.push({
            organizationId: org.id,
            leadId: lead.id,
            status: "completed",
          });
        } catch (err) {
          pipelineResults.push({
            organizationId: org.id,
            leadId: lead.id,
            status: "failed",
            error: err instanceof Error ? err.message : "failed",
          });
        }
      }

      const orgFollowUps = await this.processFollowUpJobs(org.id);
      followUpResults.push(...orgFollowUps);
    }

    return { pipelines: pipelineResults, followUps: followUpResults };
  }

  async processFollowUpJobs(organizationId: string) {
    const jobs = await prisma.followUpJob.findMany({
      where: {
        organizationId,
        status: FollowUpJobStatus.PENDING,
        scheduledAt: { lte: new Date() },
      },
      include: { lead: true },
      take: 20,
    });

    const results = [];

    for (const job of jobs) {
      const ownerId = job.lead.assignedToId ?? job.lead.createdById ?? undefined;
      const channels = ownerId
        ? await getOutreachChannelsForUser(ownerId)
        : (["email"] as OutreachChannel[]);
      const emailOnly = channels.length === 1 && channels[0] === "email";

      try {
        await prisma.followUpJob.update({
          where: { id: job.id },
          data: { status: FollowUpJobStatus.PROCESSING },
        });

        const meta = job.metadata as { channel?: string } | null;
        let channel = meta?.channel === "email" ? "email" : "linkedin";
        if (emailOnly) channel = "email";

        if (channel === "linkedin") {
          await prisma.followUpJob.update({
            where: { id: job.id },
            data: { status: FollowUpJobStatus.CANCELLED, completedAt: new Date() },
          });
          results.push({ jobId: job.id, status: "skipped", reason: "LinkedIn disabled" });
          continue;
        }

        if (!job.lead.email) {
          throw new Error("No email for follow-up");
        }

        const { conversation } = await aiOutreachService.generateOutreach(
          organizationId,
          job.leadId,
          "email"
        );
        await aiOutreachService.sendOutreach(organizationId, job.leadId, conversation.id);

        await prisma.followUpJob.update({
          where: { id: job.id },
          data: { status: FollowUpJobStatus.COMPLETED, completedAt: new Date() },
        });

        await activityService.log({
          leadId: job.leadId,
          type: ActivityType.FOLLOW_UP_SENT,
          title: `Follow-up ${job.stepIndex + 1} sent`,
          description: "Channel: email",
        });

        results.push({ jobId: job.id, status: "completed" });
      } catch (err) {
        const attempts = job.attempts + 1;
        const canRetry = attempts < job.maxAttempts;
        const backoffMs = 60_000 * 2 ** Math.min(attempts - 1, 5);
        await prisma.followUpJob.update({
          where: { id: job.id },
          data: {
            status: canRetry
              ? FollowUpJobStatus.PENDING
              : FollowUpJobStatus.FAILED,
            attempts: { increment: 1 },
            lastError: err instanceof Error ? err.message : "failed",
            scheduledAt: canRetry
              ? new Date(Date.now() + backoffMs)
              : undefined,
            completedAt: canRetry ? null : new Date(),
          },
        });
        results.push({
          jobId: job.id,
          status: canRetry ? "retrying" : "dead_letter",
          error: err instanceof Error ? err.message : "failed",
          nextAttemptAt: canRetry
            ? new Date(Date.now() + backoffMs).toISOString()
            : null,
        });
      }
    }

    return results;
  }
}

export const automationService = new AutomationService();
