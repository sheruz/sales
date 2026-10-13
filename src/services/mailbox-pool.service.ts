import { randomUUID } from "crypto";
import prisma from "@/lib/db/prisma";
import {
  OutboundMailboxStatus,
  type Prisma,
} from "@prisma/client";
import { ValidationError, NotFoundError } from "@/lib/api/response";
import { checkSendingDomainDns } from "@/lib/outbound/dns-health";
import { outboundConfigService } from "@/services/outbound-config.service";
import { inboxService } from "@/services/inbox.service";

function startOfUtcDay() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function domainOf(email: string): string {
  return (email.split("@")[1] || "").toLowerCase();
}

export function effectiveDailyLimit(mailbox: {
  dailyCap: number;
  rampStart: number;
  rampIncrement: number;
  rampDay: number;
  rampStartedAt: Date | null;
}): number {
  if (!mailbox.rampStartedAt) {
    return Math.min(mailbox.dailyCap, mailbox.rampStart);
  }
  const day = Math.max(0, mailbox.rampDay);
  const lim = mailbox.rampStart + day * mailbox.rampIncrement;
  return Math.min(mailbox.dailyCap, lim);
}

export class MailboxPoolService {
  async list(organizationId: string) {
    const rows = await prisma.outboundMailbox.findMany({
      where: { organizationId },
      include: {
        emailAccount: {
          select: {
            id: true,
            email: true,
            displayName: true,
            provider: true,
            status: true,
            userId: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((r) => ({
      ...r,
      effectiveLimit: effectiveDailyLimit(r),
      bounceRate:
        r.sentTotal > 0 ? Number((r.bounceTotal / r.sentTotal).toFixed(4)) : 0,
    }));
  }

  /**
   * Explicitly add an existing EmailAccount to the outbound pool.
   * Warns (does not block) if domain matches org primary website domain.
   */
  async addToPool(
    organizationId: string,
    emailAccountId: string,
    opts?: { dailyCap?: number }
  ) {
    const account = await prisma.emailAccount.findFirst({
      where: { id: emailAccountId, organizationId },
    });
    if (!account) throw new NotFoundError("Email account not found");

    const existing = await prisma.outboundMailbox.findUnique({
      where: { emailAccountId },
    });
    if (existing) throw new ValidationError("Already in outbound pool");

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { website: true, name: true },
    });
    const primaryDomain = org?.website
      ? org.website
          .replace(/^https?:\/\//, "")
          .replace(/^www\./, "")
          .split("/")[0]
          .toLowerCase()
      : null;
    const mailboxDomain = domainOf(account.email);
    const primaryDomainWarning = Boolean(
      primaryDomain &&
        (mailboxDomain === primaryDomain ||
          mailboxDomain.endsWith(`.${primaryDomain}`))
    );

    const dns = await checkSendingDomainDns(account.email);

    const row = await prisma.outboundMailbox.create({
      data: {
        id: randomUUID(),
        organizationId,
        emailAccountId,
        status: dns.canSend
          ? OutboundMailboxStatus.ACTIVE
          : OutboundMailboxStatus.PAUSED,
        dailyCap: opts?.dailyCap ?? 30,
        rampStartedAt: new Date(),
        rampDay: 0,
        dnsCheck: dns as unknown as Prisma.InputJsonValue,
        lastError: dns.canSend
          ? null
          : "Paused: missing SPF or DKIM — fix DNS then re-check",
      },
    });

    return { mailbox: row, primaryDomainWarning, dns };
  }

  async removeFromPool(organizationId: string, mailboxId: string) {
    const row = await prisma.outboundMailbox.findFirst({
      where: { id: mailboxId, organizationId },
    });
    if (!row) throw new NotFoundError("Outbound mailbox not found");
    await prisma.outboundMailbox.delete({ where: { id: mailboxId } });
    return { ok: true };
  }

  async setStatus(
    organizationId: string,
    mailboxId: string,
    status: OutboundMailboxStatus
  ) {
    const row = await prisma.outboundMailbox.findFirst({
      where: { id: mailboxId, organizationId },
    });
    if (!row) throw new NotFoundError("Outbound mailbox not found");
    return prisma.outboundMailbox.update({
      where: { id: mailboxId },
      data: { status, lastError: status === OutboundMailboxStatus.ACTIVE ? null : row.lastError },
    });
  }

  async refreshDns(organizationId: string, mailboxId: string) {
    const row = await prisma.outboundMailbox.findFirst({
      where: { id: mailboxId, organizationId },
      include: { emailAccount: true },
    });
    if (!row) throw new NotFoundError("Outbound mailbox not found");
    const dns = await checkSendingDomainDns(row.emailAccount.email);
    const dnsPaused =
      row.status === OutboundMailboxStatus.PAUSED &&
      /spf|dkim|dns/i.test(row.lastError || "");
    let nextStatus = row.status;
    if (!dns.canSend) {
      nextStatus = OutboundMailboxStatus.PAUSED;
    } else if (dnsPaused || row.status === OutboundMailboxStatus.ERROR) {
      nextStatus = OutboundMailboxStatus.ACTIVE;
    }
    return prisma.outboundMailbox.update({
      where: { id: mailboxId },
      data: {
        dnsCheck: dns as unknown as Prisma.InputJsonValue,
        status: nextStatus,
        lastError: dns.canSend
          ? null
          : "Paused: missing SPF or DKIM on custom domain — fix DNS then re-check",
      },
    });
  }

  async sendTestToSelf(
    organizationId: string,
    mailboxId: string,
    userId: string
  ) {
    const row = await prisma.outboundMailbox.findFirst({
      where: { id: mailboxId, organizationId },
      include: { emailAccount: true },
    });
    if (!row) throw new NotFoundError("Outbound mailbox not found");

    const to = row.emailAccount.email;
    const result = await inboxService.sendOutreach({
      organizationId,
      userId: row.emailAccount.userId || userId,
      emailAccountId: row.emailAccountId,
      toEmail: to,
      subject: "Delvix outbound — test email",
      body: `This is a test send from your outbound pool mailbox (${to}).\n\nIf you received this, SMTP/OAuth sending works.`,
      idempotencyKey: `outbound-test:${mailboxId}:${Date.now()}`,
    });
    return { to, messageId: result.message.id };
  }

  async pickMailbox(organizationId: string) {
    const cfg = await outboundConfigService.getConfig(organizationId);
    const day = startOfUtcDay();
    const mailboxes = await prisma.outboundMailbox.findMany({
      where: {
        organizationId,
        status: OutboundMailboxStatus.ACTIVE,
      },
      include: { emailAccount: true },
      orderBy: { sentToday: "asc" },
    });

    for (const m of mailboxes) {
      const domain = domainOf(m.emailAccount.email);
      if (cfg.pausedDomains.includes(domain)) continue;

      // Reset daily counters
      let sentToday = m.sentToday;
      if (!m.sentTodayResetAt || m.sentTodayResetAt < day) {
        const rampDay = m.rampStartedAt
          ? Math.floor(
              (day.getTime() - m.rampStartedAt.getTime()) / 86_400_000
            )
          : 0;
        await prisma.outboundMailbox.update({
          where: { id: m.id },
          data: {
            sentToday: 0,
            sentTodayResetAt: day,
            rampDay: Math.max(0, rampDay),
          },
        });
        sentToday = 0;
        m.rampDay = Math.max(0, rampDay);
      }

      const dns = m.dnsCheck as { canSend?: boolean } | null;
      if (dns && dns.canSend === false) continue;

      const limit = effectiveDailyLimit(m);
      if (sentToday >= limit) continue;
      if (m.emailAccount.status !== "ACTIVE") continue;

      const { assertOutboundFromAllowed } = await import(
        "@/lib/email/free-mail"
      );
      const free = assertOutboundFromAllowed({
        fromEmail: m.emailAccount.email,
        allowFreeMailProvider: m.allowFreeMailProvider === true,
      });
      if (!free.ok) continue;

      return m;
    }
    return null;
  }

  async recordSend(mailboxId: string) {
    await prisma.outboundMailbox.update({
      where: { id: mailboxId },
      data: {
        sentToday: { increment: 1 },
        sentTotal: { increment: 1 },
      },
    });
  }

  async recordBounce(organizationId: string, emailAccountId: string) {
    const m = await prisma.outboundMailbox.findFirst({
      where: { organizationId, emailAccountId },
      include: { emailAccount: true },
    });
    if (!m) return null;

    const updated = await prisma.outboundMailbox.update({
      where: { id: m.id },
      data: { bounceTotal: { increment: 1 } },
      include: { emailAccount: true },
    });

    const rate =
      updated.sentTotal > 0 ? updated.bounceTotal / updated.sentTotal : 0;
    if (updated.sentTotal >= 10 && rate > 0.03) {
      await prisma.outboundMailbox.update({
        where: { id: m.id },
        data: {
          status: OutboundMailboxStatus.PAUSED,
          lastError: `Paused: bounce rate ${(rate * 100).toFixed(1)}% > 3%`,
        },
      });

      // If 2+ mailboxes on same domain paused → pause domain
      const domain = domainOf(updated.emailAccount.email);
      const sameDomain = await prisma.outboundMailbox.findMany({
        where: { organizationId },
        include: { emailAccount: true },
      });
      const pausedOnDomain = sameDomain.filter(
        (x) =>
          domainOf(x.emailAccount.email) === domain &&
          x.status === OutboundMailboxStatus.PAUSED
      );
      if (pausedOnDomain.length >= 2) {
        await outboundConfigService.pauseDomain(organizationId, domain);
      }
    }
    return updated;
  }

  /** Accounts available to add to pool (not already members). */
  async listAvailableAccounts(organizationId: string) {
    const inPool = await prisma.outboundMailbox.findMany({
      where: { organizationId },
      select: { emailAccountId: true },
    });
    const ids = new Set(inPool.map((x) => x.emailAccountId));
    const accounts = await prisma.emailAccount.findMany({
      where: { organizationId },
      select: {
        id: true,
        email: true,
        displayName: true,
        provider: true,
        status: true,
      },
      orderBy: { email: "asc" },
    });
    return accounts.filter((a) => !ids.has(a.id));
  }
}

export const mailboxPoolService = new MailboxPoolService();
