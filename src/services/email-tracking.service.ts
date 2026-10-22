import { EmailEventType } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { sendGa4Event } from "@/lib/analytics/ga4-mp";
import {
  gaClientId,
  type ClickTrackPayload,
  type OpenTrackPayload,
  type TrackLinkType,
  verifyTrackToken,
} from "@/lib/email/track-token";
import {
  classifyEmailTraffic,
  type BotFilterResult,
} from "@/lib/security/email-bot-filter";

const TRANSPARENT_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

export type TrackRequestMeta = {
  userAgent?: string | null;
  ip?: string | null;
};

export class EmailTrackingService {
  transparentGif(): Buffer {
    return TRANSPARENT_GIF;
  }

  async recordOpen(
    token: string,
    meta: TrackRequestMeta = {}
  ): Promise<{ recorded: boolean; bot: BotFilterResult }> {
    const payload = verifyTrackToken(token);
    if (!payload || payload.kind !== "o") {
      return {
        recorded: false,
        bot: { isBot: false, reason: null, category: "human" },
      };
    }
    return this.writeOpen(payload, meta);
  }

  async recordClick(
    token: string,
    meta: TrackRequestMeta = {}
  ): Promise<{ dest: string | null; recorded: boolean; bot: BotFilterResult }> {
    const payload = verifyTrackToken(token);
    if (!payload || payload.kind !== "c") {
      return {
        dest: null,
        recorded: false,
        bot: { isBot: false, reason: null, category: "human" },
      };
    }
    const result = await this.writeClick(payload, meta);
    return { dest: payload.dest, ...result };
  }

  private async resolveOutbox(organizationId: string, outboxId: string) {
    return prisma.emailOutbox.findFirst({
      where: { id: outboxId, organizationId },
      select: {
        id: true,
        organizationId: true,
        messageId: true,
        toEmail: true,
        emailAccountId: true,
        subject: true,
        sentAt: true,
        createdAt: true,
      },
    });
  }

  private async writeOpen(
    payload: OpenTrackPayload,
    meta: TrackRequestMeta
  ): Promise<{ recorded: boolean; bot: BotFilterResult }> {
    const row = await this.resolveOutbox(
      payload.organizationId,
      payload.outboxId
    );
    if (!row) {
      return {
        recorded: false,
        bot: { isBot: false, reason: null, category: "human" },
      };
    }

    const bot = classifyEmailTraffic({
      userAgent: meta.userAgent,
      ip: meta.ip,
      sentAt: row.sentAt ?? row.createdAt,
    });

    const providerEventId = bot.isBot
      ? `open_bot:${row.id}:${bot.reason ?? "bot"}`
      : `open:${row.id}`;

    const existing = await prisma.emailEvent.findFirst({
      where: {
        organizationId: row.organizationId,
        type: EmailEventType.OPENED,
        providerEventId,
      },
      select: { id: true },
    });
    if (!existing) {
      await prisma.emailEvent.create({
        data: {
          organizationId: row.organizationId,
          messageId: row.messageId,
          emailAccountId: row.emailAccountId,
          type: EmailEventType.OPENED,
          providerEventId,
          recipientEmail: row.toEmail,
          metadata: {
            outboxId: row.id,
            subject: row.subject,
            source: "pixel",
            traffic: bot.category,
            bot: bot.isBot,
            botReason: bot.reason,
            userAgent: meta.userAgent?.slice(0, 240) ?? null,
            ip: meta.ip ?? null,
          },
        },
      });
    }

    // Honest reporting: only human opens go to GA4 / open rates
    if (!bot.isBot) {
      void sendGa4Event({
        clientId: gaClientId(row.organizationId, row.toEmail),
        events: [
          {
            name: "email_open",
            params: {
              outbox_id: row.id.slice(0, 8),
              has_message: Boolean(row.messageId),
            },
          },
        ],
      });
    }

    return { recorded: !bot.isBot, bot };
  }

  private async writeClick(
    payload: ClickTrackPayload,
    meta: TrackRequestMeta
  ): Promise<{ recorded: boolean; bot: BotFilterResult }> {
    const row = await this.resolveOutbox(
      payload.organizationId,
      payload.outboxId
    );
    if (!row) {
      return {
        recorded: false,
        bot: { isBot: false, reason: null, category: "human" },
      };
    }

    const bot = classifyEmailTraffic({
      userAgent: meta.userAgent,
      ip: meta.ip,
      sentAt: row.sentAt ?? row.createdAt,
    });

    await prisma.emailEvent.create({
      data: {
        organizationId: row.organizationId,
        messageId: row.messageId,
        emailAccountId: row.emailAccountId,
        type: EmailEventType.CLICKED,
        recipientEmail: row.toEmail,
        providerEventId: bot.isBot
          ? `click_bot:${row.id}:${Date.now()}`
          : undefined,
        metadata: {
          outboxId: row.id,
          linkType: payload.linkType as TrackLinkType,
          dest: payload.dest,
          source: "redirect",
          traffic: bot.category,
          bot: bot.isBot,
          botReason: bot.reason,
          userAgent: meta.userAgent?.slice(0, 240) ?? null,
          ip: meta.ip ?? null,
        },
      },
    });

    if (!bot.isBot) {
      void sendGa4Event({
        clientId: gaClientId(row.organizationId, row.toEmail),
        events: [
          {
            name: "email_click",
            params: {
              link_type: payload.linkType,
              outbox_id: row.id.slice(0, 8),
            },
          },
        ],
      });
    }

    return { recorded: !bot.isBot, bot };
  }
}

export const emailTrackingService = new EmailTrackingService();
