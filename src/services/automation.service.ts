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

const LOCKABLE_STATUSES: AutomationStatus[] = [
  AutomationStatus.IDLE,
  AutomationStatus.FAILED,
  AutomationStatus.PAUSED,
  AutomationStatus.COMPLETED,
];

export class AutomationService {
  async lockLead(leadId: string, userId?: string) {
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, deletedAt: null },
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

  async unlockLead(leadId: string, userId?: string) {
    const lead = await prisma.lead.findFirst({ where: { id: leadId } });
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
    leadIds: string[],
    campaignId?: string,
    userId?: string,
    _channels: Array<"linkedin" | "email"> = ["linkedin", "email"]
  ) {
    const results = [];

    for (const leadId of leadIds) {
      try {
        await this.lockLead(leadId, userId);

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

        results.push({ leadId, status: "queued" });
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

  async runPipeline(leadId: string, userId?: string) {
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, deletedAt: null },
      include: { campaign: { include: { followUpSequence: true } } },
    });
    if (!lead) throw new NotFoundError("Lead not found");

    if (lead.unsubscribed) {
      throw new ValidationError("Lead has unsubscribed");
    }

    try {
      if (
        lead.automationStatus === AutomationStatus.IDLE ||
        lead.automationStatus === AutomationStatus.FAILED ||
        lead.automationStatus === AutomationStatus.PAUSED
      ) {
        await this.lockLead(leadId, userId);
      }

      // Step 1: Research & Score
      const hasResearch = await prisma.leadResearch.findFirst({
        where: { leadId },
      });
      if (!hasResearch) {
        await aiResearchService.researchLead(leadId, userId);
      }

      // Step 2: Generate LinkedIn outreach
      const linkedInDraft = await prisma.conversation.findFirst({
        where: { leadId, channel: "LINKEDIN", isInbound: false },
      });
      if (!linkedInDraft) {
        const { conversation } = await aiOutreachService.generateOutreach(
          leadId,
          "linkedin",
          userId,
          lead.campaignId ?? undefined
        );
        await aiOutreachService.sendOutreach(leadId, conversation.id, userId);
      }

      // Step 3: Generate & send email if available
      if (lead.email) {
        const emailDraft = await prisma.conversation.findFirst({
          where: { leadId, channel: "EMAIL", isInbound: false },
        });
        if (!emailDraft) {
          const { conversation } = await aiOutreachService.generateOutreach(
            leadId,
            "email",
            userId,
            lead.campaignId ?? undefined
          );
          try {
            await aiOutreachService.sendOutreach(leadId, conversation.id, userId);
          } catch {
            // Email may fail if SMTP not configured — keep as draft
          }
        }
      }

      // Step 4: Schedule follow-ups
      if (lead.campaign?.followUpSequence) {
        await this.scheduleFollowUps(leadId, lead.campaign.followUpSequence.steps);
      }

      await prisma.lead.update({
        where: { id: leadId },
        data: {
          automationStatus: AutomationStatus.AWAITING_REPLY,
          status: LeadStatus.CONTACTED,
          nextAutomationAt: null,
        },
      });

      await activityService.log({
        leadId,
        userId,
        type: ActivityType.CAMPAIGN_ASSIGNED,
        title: "AI automation pipeline completed",
        description: "Research, outreach, and follow-ups scheduled",
      });

      return { success: true, leadId };
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

  async scheduleFollowUps(leadId: string, steps: unknown) {
    if (!Array.isArray(steps)) return;

    const now = new Date();
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i] as { delayDays?: number };
      const delayDays = step.delayDays ?? (i + 1) * 3;
      const scheduledAt = new Date(now.getTime() + delayDays * 24 * 60 * 60 * 1000);

      await prisma.followUpJob.create({
        data: {
          leadId,
          stepIndex: i,
          scheduledAt,
          status: FollowUpJobStatus.PENDING,
          metadata: step,
        },
      });
    }

    await prisma.lead.update({
      where: { id: leadId },
      data: { automationStatus: AutomationStatus.FOLLOW_UP_SCHEDULED },
    });
  }

  async processPendingJobs() {
    const dueLeads = await prisma.lead.findMany({
      where: {
        deletedAt: null,
        automationStatus: AutomationStatus.LOCKED,
        nextAutomationAt: { lte: new Date() },
      },
      take: 10,
    });

    const pipelineResults = [];
    for (const lead of dueLeads) {
      try {
        await this.runPipeline(lead.id);
        pipelineResults.push({ leadId: lead.id, status: "completed" });
      } catch (err) {
        pipelineResults.push({
          leadId: lead.id,
          status: "failed",
          error: err instanceof Error ? err.message : "failed",
        });
      }
    }

    const followUpResults = await this.processFollowUpJobs();

    return { pipelines: pipelineResults, followUps: followUpResults };
  }

  async processFollowUpJobs() {
    const jobs = await prisma.followUpJob.findMany({
      where: {
        status: FollowUpJobStatus.PENDING,
        scheduledAt: { lte: new Date() },
      },
      include: { lead: true },
      take: 20,
    });

    const results = [];

    for (const job of jobs) {
      try {
        await prisma.followUpJob.update({
          where: { id: job.id },
          data: { status: FollowUpJobStatus.PROCESSING },
        });

        const meta = job.metadata as { channel?: string } | null;
        const channel = meta?.channel === "email" ? "email" : "linkedin";

        const { conversation } = await aiOutreachService.generateOutreach(
          job.leadId,
          channel as "linkedin" | "email"
        );

        if (channel === "email" && job.lead.email) {
          try {
            await aiOutreachService.sendOutreach(job.leadId, conversation.id);
          } catch {
            // Keep as draft
          }
        }

        await prisma.followUpJob.update({
          where: { id: job.id },
          data: { status: FollowUpJobStatus.COMPLETED, completedAt: new Date() },
        });

        await activityService.log({
          leadId: job.leadId,
          type: ActivityType.FOLLOW_UP_SENT,
          title: `Follow-up ${job.stepIndex + 1} sent`,
          description: `Channel: ${channel}`,
        });

        results.push({ jobId: job.id, status: "completed" });
      } catch (err) {
        await prisma.followUpJob.update({
          where: { id: job.id },
          data: {
            status: FollowUpJobStatus.FAILED,
            attempts: { increment: 1 },
            lastError: err instanceof Error ? err.message : "failed",
          },
        });
        results.push({
          jobId: job.id,
          status: "failed",
          error: err instanceof Error ? err.message : "failed",
        });
      }
    }

    return results;
  }
}

export const automationService = new AutomationService();
