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

const TRANSPARENT_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

export class EmailTrackingService {
  transparentGif(): Buffer {
    return TRANSPARENT_GIF;
  }

  async recordOpen(token: string): Promise<void> {
    const payload = verifyTrackToken(token);
    if (!payload || payload.kind !== "o") return;
    await this.writeOpen(payload);
  }

  async recordClick(token: string): Promise<string | null> {
    const payload = verifyTrackToken(token);
    if (!payload || payload.kind !== "c") return null;
    await this.writeClick(payload);
    return payload.dest;
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
      },
    });
  }

  private async writeOpen(payload: OpenTrackPayload) {
    const row = await this.resolveOutbox(
      payload.organizationId,
      payload.outboxId
    );
    if (!row) return;

    const providerEventId = `open:${row.id}`;
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
          },
        },
      });
    }

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

  private async writeClick(payload: ClickTrackPayload) {
    const row = await this.resolveOutbox(
      payload.organizationId,
      payload.outboxId
    );
    if (!row) return;

    await prisma.emailEvent.create({
      data: {
        organizationId: row.organizationId,
        messageId: row.messageId,
        emailAccountId: row.emailAccountId,
        type: EmailEventType.CLICKED,
        recipientEmail: row.toEmail,
        metadata: {
          outboxId: row.id,
          linkType: payload.linkType as TrackLinkType,
          dest: payload.dest,
          source: "redirect",
        },
      },
    });

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
}

export const emailTrackingService = new EmailTrackingService();
