import prisma from "@/lib/db/prisma";
import {
  ActivityType,
  AutomationStatus,
  ConversationChannel,
  LeadStatus,
} from "@prisma/client";
import { NotFoundError } from "@/lib/api/response";
import { aiComplete, parseAIJson } from "@/lib/ai/provider";
import { buildOutreachPrompt, buildJobPostEmailPrompt } from "@/lib/ai/prompts";
import { activityService } from "@/services/activity.service";
import { sendEmailForUser } from "@/lib/email/smtp";
import { linkedInAccountService } from "@/services/linkedin-account.service";
import { sendConnectionOrMessage } from "@/lib/linkedin/messaging";

interface OutreachResult {
  subject: string | null;
  message: string;
}

export class AIOutreachService {
  async generateOutreach(
    organizationId: string,
    leadId: string,
    channel: "linkedin" | "email",
    userId?: string,
    campaignId?: string
  ) {
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, organizationId, deletedAt: null },
      include: {
        researches: { orderBy: { createdAt: "desc" }, take: 1 },
        campaign: true,
      },
    });
    if (!lead) throw new NotFoundError("Lead not found");

    const research = lead.researches[0];
    const campaign = campaignId
      ? await prisma.campaign.findFirst({
          where: { id: campaignId, organizationId },
        })
      : lead.campaign;

    const jobMeta = (lead.automationMeta as { jobPost?: Record<string, unknown> } | null)?.jobPost;

    await prisma.lead.update({
      where: { id: leadId },
      data: { automationStatus: AutomationStatus.GENERATING_OUTREACH },
    });

    const userPrompt =
      channel === "email" && jobMeta
        ? buildJobPostEmailPrompt(
            lead,
            jobMeta as Parameters<typeof buildJobPostEmailPrompt>[1],
            campaign?.aiInstructions
          )
        : buildOutreachPrompt(
            lead,
            research ?? {},
            channel,
            campaign?.aiInstructions
          );

    const result = await aiComplete({
      feature: `outreach_${channel}`,
      userId,
      jsonMode: true,
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: "You are an expert B2B sales copywriter. Respond with valid JSON only.",
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
    });

    const data = parseAIJson<OutreachResult>(result.content);
    const convChannel =
      channel === "linkedin" ? ConversationChannel.LINKEDIN : ConversationChannel.EMAIL;

    const conversation = await prisma.conversation.create({
      data: {
        organizationId,
        leadId,
        channel: convChannel,
        subject: data.subject,
        content: data.message,
        isInbound: false,
        metadata: { generated: true, status: "draft" },
      },
    });

    await prisma.lead.update({
      where: { id: leadId },
      data: { automationStatus: AutomationStatus.OUTREACH_READY },
    });

    return { conversation, message: data.message, subject: data.subject };
  }

  async sendOutreach(
    organizationId: string,
    leadId: string,
    conversationId: string,
    userId?: string
  ) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, leadId, organizationId },
      include: { lead: true },
    });
    if (!conversation) throw new NotFoundError("Conversation not found");

    const lead = conversation.lead;

    if (conversation.channel === ConversationChannel.LINKEDIN) {
      if (!lead.linkedInUrl) {
        throw new Error("Lead has no LinkedIn URL");
      }

      const meta = lead.automationMeta as { profileUrn?: string } | null;
      const profileUrn =
        meta?.profileUrn ??
        lead.linkedInUrl.split("/in/")[1]?.replace(/\/$/, "");

      if (userId) {
        const client = await linkedInAccountService.getClient(userId);
        const canSend = await linkedInAccountService.canMessage(userId, 50);
        if (!canSend) throw new Error("Daily LinkedIn message limit reached");

        await sendConnectionOrMessage(
          client,
          profileUrn ?? lead.linkedInUrl,
          conversation.content ?? ""
        );
        await linkedInAccountService.incrementMessage(userId);
      } else {
        throw new Error("User ID required for LinkedIn messaging");
      }
    } else if (conversation.channel === ConversationChannel.EMAIL && lead.email) {
      await sendEmailForUser(organizationId, userId, {
        to: lead.email,
        subject: conversation.subject ?? `Hello ${lead.firstName}`,
        text: conversation.content ?? "",
      });
    }

    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        metadata: {
          ...(conversation.metadata as object),
          status: "sent",
          sentAt: new Date(),
        },
      },
    });

    const activityType =
      conversation.channel === ConversationChannel.LINKEDIN
        ? ActivityType.LINKEDIN_SENT
        : ActivityType.EMAIL_SENT;

    await activityService.log({
      leadId,
      userId,
      type: activityType,
      title: `${conversation.channel} outreach sent`,
      description: conversation.content?.slice(0, 200),
    });

    await prisma.lead.update({
      where: { id: leadId },
      data: {
        status: LeadStatus.CONTACTED,
        automationStatus: AutomationStatus.AWAITING_REPLY,
      },
    });

    return conversation;
  }
}

export const aiOutreachService = new AIOutreachService();
