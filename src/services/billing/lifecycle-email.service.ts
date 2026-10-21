/**
 * B5a: Lifecycle email engine — templates, idempotent queue, retry (3× backoff).
 * Always uses platform transport (never tenant mailboxes).
 */

import prisma from "@/lib/db/prisma";
import { env } from "@/lib/config/env";
import { logger } from "@/lib/logger";
import { EmailSendStatus, Prisma, SubscriptionStatus } from "@prisma/client";
import { appHome } from "@/lib/app-paths";
import {
  LIFECYCLE_TEMPLATE_DEFAULTS,
  interpolateTemplate,
  sampleVarsForTemplate,
  type LifecycleTemplateDef,
} from "@/lib/email/lifecycle-templates";
import { platformEmailBrandingService } from "@/services/platform-email-branding.service";
import { renderPlatformTransactionalEmail } from "@/lib/email/render-platform-transactional";
import { platformEmailTransportService } from "@/services/billing/platform-email-transport.service";

const MAX_ATTEMPTS = 3;
/** Backoff after attempt n failed: index 0 unused, then 5m, 30m */
const BACKOFF_MS = [0, 5 * 60_000, 30 * 60_000];

function billingCta() {
  return `${env.APP_URL.replace(/\/$/, "")}${appHome("/settings")}?tab=billing`;
}

function exportCta() {
  return `${env.APP_URL.replace(/\/$/, "")}${appHome("/settings")}?tab=billing&export=1`;
}

function chooseStaysCta() {
  return `${env.APP_URL.replace(/\/$/, "")}${appHome("/billing/choose-what-stays")}`;
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

export class LifecycleEmailService {
  async ensureTemplatesSeeded(updatedById?: string | null) {
    for (const def of LIFECYCLE_TEMPLATE_DEFAULTS) {
      await prisma.emailTemplate.upsert({
        where: { key: def.key },
        create: {
          key: def.key,
          name: def.name,
          subject: def.subject,
          bodyHtml: def.bodyHtml,
          bodyText: def.bodyText,
          variables: def.variables,
          defaultSubject: def.subject,
          defaultBodyHtml: def.bodyHtml,
          defaultBodyText: def.bodyText,
          updatedById: updatedById ?? null,
        },
        update: {},
      });
    }
  }

  getDefault(key: string): LifecycleTemplateDef | undefined {
    return LIFECYCLE_TEMPLATE_DEFAULTS.find((t) => t.key === key);
  }

  async listTemplates() {
    await this.ensureTemplatesSeeded();
    return prisma.emailTemplate.findMany({ orderBy: { key: "asc" } });
  }

  async getTemplate(key: string) {
    await this.ensureTemplatesSeeded();
    return prisma.emailTemplate.findUnique({ where: { key } });
  }

  async resetTemplate(key: string, updatedById: string) {
    const def = this.getDefault(key);
    if (!def) throw new Error(`Unknown template key: ${key}`);
    return prisma.emailTemplate.update({
      where: { key },
      data: {
        subject: def.subject,
        bodyHtml: def.bodyHtml,
        bodyText: def.bodyText,
        variables: def.variables,
        defaultSubject: def.subject,
        defaultBodyHtml: def.bodyHtml,
        defaultBodyText: def.bodyText,
        updatedById,
      },
    });
  }

  renderPreview(input: {
    subject: string;
    bodyHtml: string;
    bodyText: string;
    vars?: Record<string, string>;
    orgName?: string;
  }) {
    const vars = input.vars || sampleVarsForTemplate("preview");
    return {
      subject: interpolateTemplate(input.subject, vars),
      html: interpolateTemplate(input.bodyHtml, vars),
      text: interpolateTemplate(input.bodyText, vars),
      vars,
    };
  }

  /** Resolve billing recipients: billingEmail + org admins */
  async resolveRecipients(organizationId: string): Promise<{
    emails: string[];
    orgName: string | null;
    adminName: string;
  }> {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { billingEmail: true, name: true },
    });
    const admins = await prisma.organizationUser.findMany({
      where: {
        organizationId,
        status: "ACTIVE",
        OR: [
          { isPrimaryAdmin: true },
          { role: { key: { in: ["OWNER", "ADMIN", "company_admin"] } } },
        ],
      },
      include: {
        user: { select: { email: true, firstName: true, lastName: true } },
      },
      orderBy: { isPrimaryAdmin: "desc" },
    });
    const emails = [
      ...new Set(
        [org?.billingEmail, ...admins.map((a) => a.user.email)]
          .filter((e): e is string => Boolean(e?.trim()))
          .map((e) => e.trim().toLowerCase())
      ),
    ];
    const first = admins[0]?.user;
    const adminName =
      first?.firstName?.trim() ||
      first?.email?.split("@")[0] ||
      "there";
    return { emails, orgName: org?.name ?? null, adminName };
  }

  /**
   * Idempotent enqueue + immediate attempt.
   * Returns existing log if eventKey already sent/queued.
   */
  async enqueue(input: {
    organizationId: string;
    templateKey: string;
    eventKey: string;
    variables?: Record<string, string | number | null | undefined>;
    ctaUrl?: string;
    ctaLabel?: string;
    toEmail?: string;
  }) {
    if (
      env.PLATFORM_OWNER_ORG_ID &&
      input.organizationId === env.PLATFORM_OWNER_ORG_ID
    ) {
      return null;
    }

    await this.ensureTemplatesSeeded();
    const template = await prisma.emailTemplate.findUnique({
      where: { key: input.templateKey },
    });
    if (!template) {
      logger.warn("lifecycle email: unknown template", {
        key: input.templateKey,
      });
      return null;
    }

    const recipients = await this.resolveRecipients(input.organizationId);
    const to =
      input.toEmail?.trim().toLowerCase() || recipients.emails[0] || null;
    if (!to) {
      logger.warn("lifecycle email: no recipients", {
        organizationId: input.organizationId,
        eventKey: input.eventKey,
      });
      return null;
    }

    const branding = await platformEmailBrandingService.get();
    const supportEmail =
      branding.whatsappE164 ||
      env.SMTP_FROM_EMAIL ||
      "support@" + (env.APP_URL.replace(/^https?:\/\//, "").split("/")[0] || "localhost");

    const vars: Record<string, string> = {
      orgName: recipients.orgName || "",
      adminName: recipients.adminName,
      ctaUrl: input.ctaUrl || billingCta(),
      supportEmail: String(supportEmail),
    };
    for (const [k, v] of Object.entries(input.variables || {})) {
      if (v != null) vars[k] = String(v);
    }

    const subject = interpolateTemplate(template.subject, vars);
    const bodyHtml = interpolateTemplate(template.bodyHtml, vars);
    const bodyText = interpolateTemplate(template.bodyText, vars);

    const rendered = renderPlatformTransactionalEmail({
      branding,
      subject,
      body: bodyHtml,
      orgName: recipients.orgName,
      ctaUrl: vars.ctaUrl,
      ctaLabel: input.ctaLabel || "Open billing",
    });
    const finalHtml = rendered.html;
    const finalText = `${bodyText}\n\n${vars.ctaUrl}\n\nSupport: ${vars.supportEmail}`;

    let log;
    try {
      log = await prisma.emailSendLog.create({
        data: {
          organizationId: input.organizationId,
          toEmail: to,
          templateKey: input.templateKey,
          eventKey: input.eventKey,
          status: EmailSendStatus.QUEUED,
          attempts: 0,
          maxAttempts: MAX_ATTEMPTS,
          subject,
          metadata: {
            variables: vars,
            html: finalHtml,
            text: finalText,
            extraRecipients: recipients.emails.filter((e) => e !== to),
          } as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        return prisma.emailSendLog.findUnique({
          where: { eventKey: input.eventKey },
        });
      }
      throw err;
    }

    await this.processOne(log.id);
    return prisma.emailSendLog.findUnique({ where: { id: log.id } });
  }

  async processOne(logId: string) {
    const log = await prisma.emailSendLog.findUnique({ where: { id: logId } });
    if (!log) return null;
    if (
      log.status === EmailSendStatus.SENT ||
      log.status === EmailSendStatus.BOUNCED
    ) {
      return log;
    }
    if (log.attempts >= log.maxAttempts) {
      return prisma.emailSendLog.update({
        where: { id: logId },
        data: { status: EmailSendStatus.FAILED },
      });
    }

    const meta = (log.metadata || {}) as {
      html?: string;
      text?: string;
      extraRecipients?: string[];
    };
    const html = meta.html || `<p>${log.subject || ""}</p>`;
    const text = meta.text || log.subject || "";

    const attempt = log.attempts + 1;
    try {
      const result = await platformEmailTransportService.send({
        to: log.toEmail,
        subject: log.subject || "(no subject)",
        html,
        text,
      });
      // Fan-out extras best-effort (same eventKey already claimed)
      for (const extra of meta.extraRecipients || []) {
        try {
          await platformEmailTransportService.send({
            to: extra,
            subject: log.subject || "(no subject)",
            html,
            text,
          });
        } catch (e) {
          logger.warn("lifecycle email extra recipient failed", {
            to: extra,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }
      return prisma.emailSendLog.update({
        where: { id: logId },
        data: {
          status: EmailSendStatus.SENT,
          attempts: attempt,
          providerMessageId: result.messageId,
          error: null,
          sentAt: new Date(),
          nextRetryAt: null,
          metadata: {
            ...meta,
            provider: result.provider,
          } as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const failed = attempt >= log.maxAttempts;
      const backoff = BACKOFF_MS[attempt] ?? BACKOFF_MS[BACKOFF_MS.length - 1];
      return prisma.emailSendLog.update({
        where: { id: logId },
        data: {
          status: failed ? EmailSendStatus.FAILED : EmailSendStatus.QUEUED,
          attempts: attempt,
          error: message,
          nextRetryAt: failed ? null : new Date(Date.now() + backoff),
        },
      });
    }
  }

  async processRetries(now = new Date(), limit = 50) {
    const due = await prisma.emailSendLog.findMany({
      where: {
        status: EmailSendStatus.QUEUED,
        attempts: { lt: MAX_ATTEMPTS },
        OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
      },
      orderBy: { createdAt: "asc" },
      take: limit,
    });
    let processed = 0;
    let sent = 0;
    let failed = 0;
    for (const row of due) {
      const updated = await this.processOne(row.id);
      processed++;
      if (updated?.status === EmailSendStatus.SENT) sent++;
      if (updated?.status === EmailSendStatus.FAILED) failed++;
    }
    return { processed, sent, failed };
  }

  async listSends(input: {
    organizationId?: string;
    templateKey?: string;
    status?: EmailSendStatus;
    take?: number;
    skip?: number;
  }) {
    const where: Prisma.EmailSendLogWhereInput = {};
    if (input.organizationId) where.organizationId = input.organizationId;
    if (input.templateKey) where.templateKey = input.templateKey;
    if (input.status) where.status = input.status;
    const [rows, total] = await Promise.all([
      prisma.emailSendLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: input.take ?? 50,
        skip: input.skip ?? 0,
        select: {
          id: true,
          organizationId: true,
          toEmail: true,
          templateKey: true,
          eventKey: true,
          status: true,
          attempts: true,
          providerMessageId: true,
          error: true,
          subject: true,
          sentAt: true,
          createdAt: true,
        },
      }),
      prisma.emailSendLog.count({ where }),
    ]);
    return { rows, total };
  }

  // ── Cadence scanners (called from lifecycle cron) ─────────────────────────

  async runCadences(now = new Date()) {
    const ownerId = env.PLATFORM_OWNER_ORG_ID;
    let trialEnding3d = 0;
    let trialEnding1d = 0;
    let paymentFailed3 = 0;
    let paymentFailed6 = 0;
    let cancelScheduled = 0;
    let downgradeReminders = 0;
    let manualRenewals = 0;

    const subs = await prisma.subscription.findMany({
      where: ownerId ? { organizationId: { not: ownerId } } : undefined,
    });

    for (const sub of subs) {
      try {
        // Trial ending 3d / 1d
        if (
          sub.status === SubscriptionStatus.TRIALING &&
          sub.trialEndsAt
        ) {
          const ms = sub.trialEndsAt.getTime() - now.getTime();
          const days = ms / 86_400_000;
          const trialIso = sub.trialEndsAt.toISOString();
          if (days <= 3.5 && days > 1.5) {
            const r = await this.enqueue({
              organizationId: sub.organizationId,
              templateKey: "trial_ending_3d",
              eventKey: `trial_ending_3d:${sub.id}:${trialIso}`,
              variables: { trialEndsAt: fmtDate(sub.trialEndsAt) },
            });
            if (r && r.attempts <= 1) trialEnding3d++;
          } else if (days <= 1.5 && days > 0) {
            const r = await this.enqueue({
              organizationId: sub.organizationId,
              templateKey: "trial_ending_1d",
              eventKey: `trial_ending_1d:${sub.id}:${trialIso}`,
              variables: { trialEndsAt: fmtDate(sub.trialEndsAt) },
            });
            if (r && r.attempts <= 1) trialEnding1d++;
          }
        }

        // Payment failed day 3 / 6 (day 0 set on webhook)
        if (
          sub.status === SubscriptionStatus.PAST_DUE &&
          sub.gracePeriodEndsAt
        ) {
          const settings = await prisma.paymentSettings.findUnique({
            where: { id: "default" },
          });
          const graceDays = settings?.graceDays ?? env.BILLING_GRACE_DAYS ?? 7;
          const graceStart = new Date(
            sub.gracePeriodEndsAt.getTime() - graceDays * 86_400_000
          );
          const day = Math.floor(
            (now.getTime() - graceStart.getTime()) / 86_400_000
          );
          const last = sub.lastPaymentFailedNoticeDay ?? -1;
          if (day >= 3 && last < 3) {
            await this.enqueue({
              organizationId: sub.organizationId,
              templateKey: "payment_failed_3",
              eventKey: `payment_failed_3:${sub.id}:${fmtDate(graceStart)}`,
              variables: { graceEndsAt: fmtDate(sub.gracePeriodEndsAt) },
            });
            await prisma.subscription.update({
              where: { id: sub.id },
              data: { lastPaymentFailedNoticeDay: 3 },
            });
            paymentFailed3++;
          } else if (day >= 6 && last < 6) {
            await this.enqueue({
              organizationId: sub.organizationId,
              templateKey: "payment_failed_6",
              eventKey: `payment_failed_6:${sub.id}:${fmtDate(graceStart)}`,
              variables: { graceEndsAt: fmtDate(sub.gracePeriodEndsAt) },
            });
            await prisma.subscription.update({
              where: { id: sub.id },
              data: { lastPaymentFailedNoticeDay: 6 },
            });
            paymentFailed6++;
          }
        }

        // Cancellation scheduled (cancelAtPeriodEnd)
        if (
          sub.cancelAtPeriodEnd &&
          sub.currentPeriodEnd &&
          sub.currentPeriodEnd > now &&
          (sub.status === SubscriptionStatus.ACTIVE ||
            sub.status === SubscriptionStatus.PAST_DUE)
        ) {
          const r = await this.enqueue({
            organizationId: sub.organizationId,
            templateKey: "cancellation_scheduled",
            eventKey: `cancellation_scheduled:${sub.id}:${sub.currentPeriodEnd.toISOString()}`,
            variables: { periodEnd: fmtDate(sub.currentPeriodEnd) },
          });
          if (r && r.attempts <= 1) cancelScheduled++;
        }
      } catch (err) {
        logger.warn("lifecycle email cadence row failed", {
          subscriptionId: sub.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Downgrade / plan-limit reminders ~7d window (notice opened) + T-1 already covered by open
    const notices = await prisma.planLimitNotice.findMany({
      where: {
        status: "PENDING",
        emailStubSentAt: { not: null },
        deadlineAt: { gt: now },
      },
      take: 200,
    });
    for (const n of notices) {
      const daysLeft =
        (n.deadlineAt.getTime() - now.getTime()) / 86_400_000;
      // Reminder when ~1 day into the 7-day window still open (idempotent per notice)
      if (daysLeft <= 6.5) {
        const r = await this.enqueue({
          organizationId: n.organizationId,
          templateKey: "downgrade_reminder_7d",
          eventKey: `downgrade_reminder_7d:${n.id}`,
          variables: {
            featureKey: n.featureKey,
            deadlineAt: fmtDate(n.deadlineAt),
            allowedCount: String(n.allowedCount),
          },
          ctaUrl: chooseStaysCta(),
          ctaLabel: "Choose what stays",
        });
        if (r && r.attempts <= 1) downgradeReminders++;
      }
    }

    // Manual renewal reminders — OPEN invoices created for upcoming period
    const openInvoices = await prisma.invoice.findMany({
      where: {
        status: { in: ["OPEN", "OVERDUE"] },
        periodEnd: { not: null },
      },
      take: 100,
      orderBy: { createdAt: "desc" },
    });
    for (const inv of openInvoices) {
      if (!inv.periodEnd) continue;
      const r = await this.enqueue({
        organizationId: inv.organizationId,
        templateKey: "manual_renewal_reminder",
        eventKey: `manual_renewal_reminder:${inv.id}`,
        variables: {
          periodEnd: fmtDate(inv.periodEnd),
          invoiceNumber: inv.number || inv.id.slice(0, 8),
          amount: inv.total != null ? String(inv.total) : "",
        },
      });
      if (r && r.attempts <= 1) manualRenewals++;
    }

    const retries = await this.processRetries(now);

    return {
      trialEnding3d,
      trialEnding1d,
      paymentFailed3,
      paymentFailed6,
      cancelScheduled,
      downgradeReminders,
      manualRenewals,
      retries,
    };
  }

  /** Convenience helpers for event-driven sends */
  async sendTrialExpired(organizationId: string, subscriptionId: string) {
    return this.enqueue({
      organizationId,
      templateKey: "trial_expired",
      eventKey: `trial_expired:${subscriptionId}`,
    });
  }

  async sendSuspended(organizationId: string, subscriptionId: string) {
    return this.enqueue({
      organizationId,
      templateKey: "suspended",
      eventKey: `suspended:${subscriptionId}:${fmtDate(new Date())}`,
    });
  }

  async sendCanceledExport(
    organizationId: string,
    subscriptionId: string,
    readOnlyUntil?: Date | null
  ) {
    return this.enqueue({
      organizationId,
      templateKey: "canceled_export_reminder",
      eventKey: `canceled_export_reminder:${subscriptionId}`,
      variables: { readOnlyUntil: fmtDate(readOnlyUntil) },
      ctaUrl: exportCta(),
      ctaLabel: "Export data",
    });
  }

  async sendPaymentFailed0(
    organizationId: string,
    subscriptionId: string,
    graceEndsAt: Date
  ) {
    return this.enqueue({
      organizationId,
      templateKey: "payment_failed_0",
      eventKey: `payment_failed_0:${subscriptionId}:${fmtDate(graceEndsAt)}`,
      variables: { graceEndsAt: fmtDate(graceEndsAt) },
    });
  }

  async sendReactivated(
    organizationId: string,
    subscriptionId: string,
    idempotencySuffix?: string
  ) {
    return this.enqueue({
      organizationId,
      templateKey: "reactivated",
      eventKey: `reactivated:${subscriptionId}:${idempotencySuffix || "recover"}`,
    });
  }

  async sendPaymentReceived(
    organizationId: string,
    idempotencySuffix: string,
    vars?: { amount?: string; currency?: string }
  ) {
    return this.enqueue({
      organizationId,
      templateKey: "payment_received",
      eventKey: `payment_received:${idempotencySuffix}`,
      variables: vars,
    });
  }

  async sendPlanLimitNotice(input: {
    organizationId: string;
    noticeId: string;
    featureKey: string;
    allowedCount: number;
    deadlineAt: Date;
  }) {
    return this.enqueue({
      organizationId: input.organizationId,
      templateKey: "plan_limit_notice",
      eventKey: `plan_limit_notice:${input.noticeId}`,
      variables: {
        featureKey: input.featureKey,
        allowedCount: String(input.allowedCount),
        deadlineAt: fmtDate(input.deadlineAt),
      },
      ctaUrl: chooseStaysCta(),
      ctaLabel: "Choose what stays",
    });
  }

  async sendLowCredits(
    organizationId: string,
    level: "20" | "5" | "0",
    balance: number
  ) {
    const key =
      level === "20"
        ? "low_credits_20"
        : level === "5"
          ? "low_credits_5"
          : "low_credits_0";
    return this.enqueue({
      organizationId,
      templateKey: key,
      eventKey: `${key}:${organizationId}`,
      variables: { balance: String(balance) },
      ctaLabel: "Buy credits",
    });
  }
}

export const lifecycleEmailService = new LifecycleEmailService();
