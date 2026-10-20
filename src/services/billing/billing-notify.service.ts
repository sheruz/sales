/**
 * B3.2: Tenant billing emails + Super Admin seller alerts.
 * Tenant emails use Super Admin platform email branding (not plain text).
 */

import prisma from "@/lib/db/prisma";
import { env } from "@/lib/config/env";
import { logger } from "@/lib/logger";
import { sendEmailWithConfig } from "@/lib/email/send-mail";
import { NotificationType, UserRole } from "@prisma/client";
import { paymentConfigService } from "@/services/billing/payment-config.service";
import { platformEmailBrandingService } from "@/services/platform-email-branding.service";
import { renderPlatformTransactionalEmail } from "@/lib/email/render-platform-transactional";
import { appOps, appHome } from "@/lib/app-paths";

function platformSmtp(fromName?: string) {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD) return null;
  return {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    user: env.SMTP_USER,
    password: env.SMTP_PASSWORD,
    fromName: fromName || env.SMTP_FROM_NAME || "Delvix",
    fromEmail: env.SMTP_FROM_EMAIL ?? env.SMTP_USER,
  };
}

async function sendBrandedPlatformMail(input: {
  to: string[];
  subject: string;
  body: string;
  orgName?: string | null;
  ctaUrl?: string;
  ctaLabel?: string;
}) {
  const unique = [
    ...new Set(
      input.to.map((e) => e.trim().toLowerCase()).filter(Boolean)
    ),
  ];
  if (unique.length === 0) return;

  const branding = await platformEmailBrandingService.get();
  const rendered = renderPlatformTransactionalEmail({
    branding,
    subject: input.subject,
    body: input.body,
    orgName: input.orgName,
    ctaUrl: input.ctaUrl,
    ctaLabel: input.ctaLabel,
  });
  const cfg = platformSmtp(rendered.fromName);
  if (!cfg) return;

  for (const addr of unique) {
    try {
      await sendEmailWithConfig(cfg, {
        to: addr,
        subject: rendered.subject,
        text: rendered.text,
        html: rendered.html,
      });
    } catch (err) {
      logger.warn("billing notify email failed", {
        to: addr,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

export class BillingNotifyService {
  /** Send branded platform mail to explicit addresses (invoices, one-offs). */
  async sendBrandedTo(input: {
    to: string | string[];
    subject: string;
    body: string;
    orgName?: string | null;
    ctaUrl?: string;
    ctaLabel?: string;
  }) {
    const list = Array.isArray(input.to) ? input.to : [input.to];
    await sendBrandedPlatformMail({
      to: list,
      subject: input.subject,
      body: input.body,
      orgName: input.orgName,
      ctaUrl: input.ctaUrl,
      ctaLabel: input.ctaLabel,
    });
  }

  /** Invoice/receipt/payment-failed/renewal/low-credits/welcome → billingEmail + org admins */
  async emailTenantBilling(
    organizationId: string,
    subject: string,
    body: string,
    opts?: { ctaUrl?: string; ctaLabel?: string }
  ) {
    if (!organizationId) return;
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
      include: { user: { select: { email: true } } },
    });
    const emails = [
      org?.billingEmail,
      ...admins.map((a) => a.user.email),
    ].filter((e): e is string => Boolean(e?.trim()));

    await sendBrandedPlatformMail({
      to: emails,
      subject,
      body,
      orgName: org?.name,
      ctaUrl:
        opts?.ctaUrl ||
        `${env.APP_URL.replace(/\/$/, "")}${appHome("/settings")}?tab=billing`,
      ctaLabel: opts?.ctaLabel || "Open billing",
    });
  }

  /**
   * Seller alerts: in-app for SUPER_ADMIN users + branded email to sellerAdminEmails.
   */
  async notifySellers(input: {
    type:
      | "new_subscription"
      | "payment_failed"
      | "cancellation"
      | "refund"
      | "chargeback";
    organizationId?: string | null;
    subject: string;
    body: string;
    href?: string;
  }) {
    const settings = await paymentConfigService.getSettings();
    const raw = settings.sellerAdminEmails;
    const configured = Array.isArray(raw)
      ? raw.filter((e): e is string => typeof e === "string" && e.includes("@"))
      : [];

    const ownerOrgId = env.PLATFORM_OWNER_ORG_ID;
    const superAdmins = await prisma.user.findMany({
      where: {
        role: UserRole.SUPER_ADMIN,
        isActive: true,
        deletedAt: null,
      },
      select: { id: true, email: true },
      take: 50,
    });

    const emailTargets = [
      ...configured,
      ...superAdmins.map((u) => u.email),
    ];
    const href =
      input.href ||
      (input.organizationId
        ? `${env.APP_URL.replace(/\/$/, "")}${appOps(`/companies/${input.organizationId}`)}`
        : `${env.APP_URL.replace(/\/$/, "")}${appOps("/revenue")}`);

    await sendBrandedPlatformMail({
      to: emailTargets,
      subject: `[Billing] ${input.subject}`,
      body: input.body,
      ctaUrl: href,
      ctaLabel: "Open platform",
    });

    if (ownerOrgId) {
      for (const admin of superAdmins) {
        try {
          await prisma.notification.create({
            data: {
              organizationId: ownerOrgId,
              userId: admin.id,
              type: NotificationType.BILLING_SELLER_ALERT,
              title: input.subject,
              body: input.body,
              href:
                input.href ||
                (input.organizationId
                  ? appOps(`/companies/${input.organizationId}`)
                  : appOps("/revenue")),
              metadata: {
                alertType: input.type,
                organizationId: input.organizationId ?? null,
              },
            },
          });
        } catch (err) {
          logger.warn("seller in-app notify failed", {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }
  }
}

export const billingNotifyService = new BillingNotifyService();
