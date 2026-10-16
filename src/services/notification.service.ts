import { appHome } from "@/lib/app-paths";
import prisma from "@/lib/db/prisma";
import {
  AiReplyStatus,
  MembershipStatus,
  NotificationType,
  type Prisma,
} from "@prisma/client";
import { env } from "@/lib/config/env";
import { sendEmailForUser } from "@/lib/email/smtp";

export type NotificationOwner = {
  userId: string;
  email: string;
  name: string;
  timezone: string;
};

type NotifyBase = {
  organizationId: string;
  conversationId?: string | null;
  opportunityId?: string | null;
  contactName?: string | null;
  companyName?: string | null;
  /** Optional explicit owner override (skips resolution) */
  userId?: string | null;
};

const ADMIN_ROLE_KEYS = ["OWNER", "ADMIN", "company_admin"];
const DIGEST_DEDUPE_HOURS = 20;
const DIGEST_MAX_ROWS = 50;

function appUrl(path: string): string {
  return `${env.APP_URL.replace(/\/$/, "")}${path}`;
}

function conversationHref(conversationId?: string | null): string {
  return conversationId
    ? appHome(`/conversations?conversationId=${encodeURIComponent(conversationId)}`)
    : appHome("/conversations");
}

function who(contactName?: string | null, companyName?: string | null): string {
  const c = contactName?.trim();
  const co = companyName?.trim();
  if (c && co) return `${c} (${co})`;
  return c || co || "A prospect";
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Owner notifications (in-app + email).
 *
 * Email goes through `sendEmailForUser` (owner's primary connected inbox, else platform SMTP).
 * It must NEVER be sent from an outbound mailbox-pool account — pool mailboxes are reserved for
 * cold outreach / AI replies to prospects and carry reputation + daily caps.
 */
export class NotificationService {
  /** Opportunity owner, else org admin (primary admin first, then OWNER/ADMIN roles). */
  async resolveOwner(
    organizationId: string,
    opportunityId?: string | null,
    preferredUserId?: string | null
  ): Promise<NotificationOwner | null> {
    const candidateIds: string[] = [];
    if (preferredUserId) candidateIds.push(preferredUserId);

    if (opportunityId) {
      const opp = await prisma.opportunity.findFirst({
        where: { id: opportunityId, organizationId },
        select: { ownerId: true },
      });
      if (opp?.ownerId) candidateIds.push(opp.ownerId);
    }

    for (const userId of candidateIds) {
      const owner = await this.loadActiveMember(organizationId, userId);
      if (owner) return owner;
    }

    const admin = await prisma.organizationUser.findFirst({
      where: {
        organizationId,
        status: MembershipStatus.ACTIVE,
        user: { isActive: true, deletedAt: null },
        OR: [
          { isPrimaryAdmin: true },
          { role: { key: { in: ADMIN_ROLE_KEYS } } },
        ],
      },
      orderBy: [{ isPrimaryAdmin: "desc" }, { createdAt: "asc" }],
      select: { userId: true },
    });
    if (!admin) return null;
    return this.loadActiveMember(organizationId, admin.userId);
  }

  private async loadActiveMember(
    organizationId: string,
    userId: string
  ): Promise<NotificationOwner | null> {
    const [member, org, settings] = await Promise.all([
      prisma.organizationUser.findFirst({
        where: {
          organizationId,
          userId,
          status: MembershipStatus.ACTIVE,
          user: { isActive: true, deletedAt: null },
        },
        select: {
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      }),
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: { timezone: true },
      }),
      prisma.organizationSettings.findUnique({
        where: { organizationId },
        select: { timezone: true },
      }),
    ]);
    if (!member?.user) return null;
    const u = member.user;
    return {
      userId: u.id,
      email: u.email,
      name: `${u.firstName} ${u.lastName}`.trim() || u.email,
      timezone: settings?.timezone || org?.timezone || "UTC",
    };
  }

  /** In-app row + best-effort owner email. Never throws. */
  async notify(input: {
    organizationId: string;
    userId: string;
    toEmail?: string | null;
    type: NotificationType;
    title: string;
    body: string;
    href?: string | null;
    metadata?: Record<string, unknown> | null;
    html?: string;
    sendEmail?: boolean;
  }) {
    let row;
    try {
      row = await prisma.notification.create({
        data: {
          organizationId: input.organizationId,
          userId: input.userId,
          type: input.type,
          title: input.title.slice(0, 200),
          body: input.body,
          href: input.href ?? null,
          metadata: (input.metadata ?? undefined) as
            | Prisma.InputJsonValue
            | undefined,
        },
      });
    } catch (err) {
      console.warn(
        "[notification] create failed",
        err instanceof Error ? err.message : err
      );
      return null;
    }

    if (input.sendEmail === false) return row;

    try {
      const to =
        input.toEmail ??
        (
          await prisma.user.findUnique({
            where: { id: input.userId },
            select: { email: true },
          })
        )?.email;
      if (!to) return row;

      const link = input.href ? appUrl(input.href) : null;
      const text = link ? `${input.body}\n\nOpen: ${link}` : input.body;
      await this.sendOwnerEmail(input.organizationId, input.userId, {
        to,
        subject: input.title,
        text,
        html: input.html,
      });
      await prisma.notification.update({
        where: { id: row.id },
        data: { emailSentAt: new Date() },
      });
    } catch (err) {
      console.warn(
        "[notification] email failed",
        err instanceof Error ? err.message : err
      );
    }
    return row;
  }

  /**
   * Send via the owner's primary connected inbox (or platform SMTP).
   * If the owner's default mailbox is an outbound pool mailbox, skip it and use platform SMTP.
   */
  private async sendOwnerEmail(
    organizationId: string,
    userId: string,
    params: { to: string; subject: string; text: string; html?: string }
  ) {
    const defaultAccount = await prisma.emailAccount.findFirst({
      where: { organizationId, userId, status: "ACTIVE" },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      select: { id: true, outboundMailbox: { select: { id: true } } },
    });
    const defaultIsPool = Boolean(defaultAccount?.outboundMailbox);

    if (defaultIsPool) {
      // Platform SMTP fallback only (no org/user → never touches mailbox pool)
      return sendEmailForUser(undefined, undefined, params);
    }
    return sendEmailForUser(organizationId, userId, params);
  }

  async notifyHeld(
    input: NotifyBase & { holdReason: string; classSlug?: string | null }
  ) {
    const owner = await this.resolveOwner(
      input.organizationId,
      input.opportunityId,
      input.userId
    );
    if (!owner) return null;
    const subject = who(input.contactName, input.companyName);
    const title = `AI reply held for review — ${subject}`;
    const body = [
      `${subject} replied and the AI reply agent held its response for you.`,
      `Reason: ${input.holdReason}`,
      input.classSlug ? `Classified as: ${input.classSlug}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    return this.notify({
      organizationId: input.organizationId,
      userId: owner.userId,
      toEmail: owner.email,
      type: NotificationType.AI_HELD,
      title,
      body,
      href: conversationHref(input.conversationId),
      metadata: {
        conversationId: input.conversationId ?? null,
        opportunityId: input.opportunityId ?? null,
        holdReason: input.holdReason,
      },
    });
  }

  async notifyInterested(
    input: NotifyBase & { summary?: string | null; confidence?: number | null }
  ) {
    const owner = await this.resolveOwner(
      input.organizationId,
      input.opportunityId,
      input.userId
    );
    if (!owner) return null;
    const subject = who(input.contactName, input.companyName);
    const title = `Interested reply — ${subject}`;
    const body = [
      `${subject} sent an interested reply.`,
      input.summary ? `Summary: ${input.summary}` : "",
      input.confidence != null
        ? `Confidence: ${Math.round(input.confidence * 100)}%`
        : "",
    ]
      .filter(Boolean)
      .join("\n");
    return this.notify({
      organizationId: input.organizationId,
      userId: owner.userId,
      toEmail: owner.email,
      type: NotificationType.INTERESTED_REPLY,
      title,
      body,
      href: conversationHref(input.conversationId),
      metadata: {
        conversationId: input.conversationId ?? null,
        opportunityId: input.opportunityId ?? null,
      },
    });
  }

  async notifyReferral(
    input: NotifyBase & {
      referralName?: string | null;
      referralEmail?: string | null;
      referralContactId?: string | null;
    }
  ) {
    const owner = await this.resolveOwner(
      input.organizationId,
      input.opportunityId,
      input.userId
    );
    if (!owner) return null;
    const subject = who(input.contactName, input.companyName);
    const referred =
      input.referralName?.trim() || input.referralEmail?.trim() || "a colleague";
    const title = `Referral received — ${subject}`;
    const body = [
      `${subject} referred us to ${referred}.`,
      input.referralEmail ? `Email: ${input.referralEmail}` : "",
      "A contact was created for pitch review. No email has been sent to the referral.",
    ]
      .filter(Boolean)
      .join("\n");
    return this.notify({
      organizationId: input.organizationId,
      userId: owner.userId,
      toEmail: owner.email,
      type: NotificationType.REFERRAL_CREATED,
      title,
      body,
      href: input.referralContactId
        ? appHome(`/contacts/${encodeURIComponent(input.referralContactId)}`)
        : conversationHref(input.conversationId),
      metadata: {
        conversationId: input.conversationId ?? null,
        referralContactId: input.referralContactId ?? null,
        referralEmail: input.referralEmail ?? null,
      },
    });
  }

  /**
   * Email each owner a digest of open (HELD) AI reply drafts.
   * Caller schedules this (9:00 Asia/Karachi). Deduped per owner within ~20h.
   */
  async sendDailyHeldDigest(organizationId: string) {
    const drafts = await prisma.aiReplyDraft.findMany({
      // HELD = needs a human; DRAFT = draft-only mode awaiting review. Both are "open".
      where: {
        organizationId,
        status: { in: [AiReplyStatus.HELD, AiReplyStatus.DRAFT] },
      },
      orderBy: { createdAt: "asc" },
      take: 500,
      select: {
        id: true,
        class: true,
        holdReason: true,
        createdAt: true,
        conversation: {
          select: {
            id: true,
            subject: true,
            opportunityId: true,
            contact: { select: { fullName: true, email: true } },
            company: { select: { name: true } },
            opportunity: { select: { ownerId: true } },
          },
        },
      },
    });
    if (drafts.length === 0) return { sent: 0, owners: 0, drafts: 0 };

    type Row = (typeof drafts)[number];
    const byOwner = new Map<string, { owner: NotificationOwner; rows: Row[] }>();
    const ownerCache = new Map<string, NotificationOwner | null>();

    for (const d of drafts) {
      const cacheKey = d.conversation.opportunity?.ownerId ?? "__admin__";
      let owner = ownerCache.get(cacheKey);
      if (owner === undefined) {
        owner = await this.resolveOwner(
          organizationId,
          d.conversation.opportunityId
        );
        ownerCache.set(cacheKey, owner);
      }
      if (!owner) continue;
      const bucket = byOwner.get(owner.userId) ?? { owner, rows: [] };
      bucket.rows.push(d);
      byOwner.set(owner.userId, bucket);
    }

    const since = new Date(Date.now() - DIGEST_DEDUPE_HOURS * 3_600_000);
    let sent = 0;

    for (const { owner, rows } of byOwner.values()) {
      const already = await prisma.notification.findFirst({
        where: {
          organizationId,
          userId: owner.userId,
          type: NotificationType.DAILY_HELD_DIGEST,
          createdAt: { gte: since },
        },
        select: { id: true },
      });
      if (already) continue;

      const shown = rows.slice(0, DIGEST_MAX_ROWS);
      const lines = shown.map((r, i) => {
        const name = who(
          r.conversation.contact?.fullName ?? r.conversation.contact?.email,
          r.conversation.company?.name
        );
        return `${i + 1}. ${name} — ${String(r.class).toLowerCase()} — ${
          r.holdReason || "needs review"
        }`;
      });
      if (rows.length > shown.length) {
        lines.push(`…and ${rows.length - shown.length} more`);
      }

      const title = `${rows.length} AI repl${rows.length === 1 ? "y" : "ies"} waiting for review`;
      const body = [
        `Good morning ${owner.name.split(" ")[0] || ""}`.trim() + ",",
        "",
        `${rows.length} held AI repl${rows.length === 1 ? "y is" : "ies are"} waiting for you:`,
        "",
        ...lines,
      ].join("\n");

      const htmlRows = shown
        .map((r) => {
          const name = who(
            r.conversation.contact?.fullName ?? r.conversation.contact?.email,
            r.conversation.company?.name
          );
          const href = appUrl(conversationHref(r.conversation.id));
          return `<li><a href="${escapeHtml(href)}">${escapeHtml(name)}</a> — ${escapeHtml(
            String(r.class).toLowerCase()
          )} — ${escapeHtml(r.holdReason || "needs review")}</li>`;
        })
        .join("");
      const html = `<p>${escapeHtml(body.split("\n")[0])}</p><p>${rows.length} held AI repl${
        rows.length === 1 ? "y is" : "ies are"
      } waiting for you:</p><ol>${htmlRows}</ol>`;

      const row = await this.notify({
        organizationId,
        userId: owner.userId,
        toEmail: owner.email,
        type: NotificationType.DAILY_HELD_DIGEST,
        title,
        body,
        html,
        href: appHome("/conversations"),
        metadata: {
          draftIds: shown.map((r) => r.id),
          total: rows.length,
          ownerTimezone: owner.timezone,
        },
      });
      if (row) sent += 1;
    }

    return { sent, owners: byOwner.size, drafts: drafts.length };
  }

  async listForUser(
    organizationId: string,
    userId: string,
    opts: { unreadOnly?: boolean; take?: number } = {}
  ) {
    return prisma.notification.findMany({
      where: {
        organizationId,
        userId,
        ...(opts.unreadOnly ? { readAt: null } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(100, Math.max(1, opts.take ?? 30)),
    });
  }

  async markRead(organizationId: string, userId: string, id?: string) {
    return prisma.notification.updateMany({
      where: {
        organizationId,
        userId,
        readAt: null,
        ...(id ? { id } : {}),
      },
      data: { readAt: new Date() },
    });
  }
}

export const notificationService = new NotificationService();
