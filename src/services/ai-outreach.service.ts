import prisma from "@/lib/db/prisma";
import {
  ActivityType,
  AutomationStatus,
  ConversationChannel,
  LeadStatus,
} from "@prisma/client";
import { NotFoundError } from "@/lib/api/response";
import { aiComplete, parseAIJson } from "@/lib/ai/provider";
import { buildOutreachPrompt } from "@/lib/ai/prompts";
import { activityService } from "@/services/activity.service";
import { isEmailConfigured, sendEmail } from "@/lib/email/smtp";

interface OutreachResult {
  subject: string | null;
  message: string;
}

export class AIOutreachService {
  async generateOutreach(
    leadId: string,
    channel: "linkedin" | "email",
    userId?: string,
    campaignId?: string
  ) {
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, deletedAt: null },
      include: {
        researches: { orderBy: { createdAt: "desc" }, take: 1 },
        campaign: true,
      },
    });
    if (!lead) throw new NotFoundError("Lead not found");

    const research = lead.researches[0];
    const campaign = campaignId
      ? await prisma.campaign.findUnique({ where: { id: campaignId } })
      : lead.campaign;

    await prisma.lead.update({
      where: { id: leadId },
      data: { automationStatus: AutomationStatus.GENERATING_OUTREACH },
    });

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
          content: buildOutreachPrompt(
            lead,
            research ?? {},
            channel,
            campaign?.aiInstructions
          ),
        },
      ],
    });

    const data = parseAIJson<OutreachResult>(result.content);
    const convChannel =
      channel === "linkedin" ? ConversationChannel.LINKEDIN : ConversationChannel.EMAIL;

    const conversation = await prisma.conversation.create({
      data: {
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
    leadId: string,
    conversationId: string,
    userId?: string
  ) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, leadId },
      include: { lead: true },
    });
    if (!conversation) throw new NotFoundError("Conversation not found");

    const lead = conversation.lead;

    if (conversation.channel === ConversationChannel.EMAIL && lead.email) {
      if (!isEmailConfigured()) {
        throw new Error("SMTP not configured — outreach saved as draft");
      }
      await sendEmail({
        to: lead.email,
        subject: conversation.subject ?? `Hello ${lead.firstName}`,
        text: conversation.content ?? "",
      });
    }

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { metadata: { ...(conversation.metadata as object), status: "sent", sentAt: new Date() } },
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
