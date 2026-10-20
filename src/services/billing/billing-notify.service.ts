/**
 * B3.2: Tenant billing emails + Super Admin seller alerts.
 */

import prisma from "@/lib/db/prisma";
import { env } from "@/lib/config/env";
import { logger } from "@/lib/logger";
import { sendEmailWithConfig } from "@/lib/email/send-mail";
import { NotificationType, UserRole } from "@prisma/client";
import { paymentConfigService } from "@/services/billing/payment-config.service";
import { appOps } from "@/lib/app-paths";

function platformSmtp() {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD) return null;
  return {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    user: env.SMTP_USER,
    password: env.SMTP_PASSWORD,
    fromName: env.SMTP_FROM_NAME || "Delvix",
    fromEmail: env.SMTP_FROM_EMAIL ?? env.SMTP_USER,
  };
}

async function sendPlatformMail(to: string[], subject: string, body: string) {
  const cfg = platformSmtp();
  if (!cfg || to.length === 0) return;
  const unique = [...new Set(to.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  for (const addr of unique) {
    try {
      await sendEmailWithConfig(cfg, {
        to: addr,
        subject,
        text: body,
        html: `<div style="font-family:system-ui,sans-serif;line-height:1.5"><p>${body.replace(/\n/g, "<br/>")}</p><p style="color:#666;font-size:12px">— Delvix Platform</p></div>`,
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
  /** Invoice/receipt/payment-failed/renewal/low-credits/welcome → billingEmail + org admins */
  async emailTenantBilling(
    organizationId: string,
    subject: string,
    body: string
  ) {
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
    await sendPlatformMail(emails, subject, body);
  }

  /**
   * Seller alerts: in-app for SUPER_ADMIN users + email to PaymentSettings.sellerAdminEmails.
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
    await sendPlatformMail(
      emailTargets,
      `[Billing] ${input.subject}`,
      input.body
    );

    if (ownerOrgId) {
      const href =
        input.href ||
        (input.organizationId
          ? appOps(`/companies/${input.organizationId}`)
          : appOps("/revenue"));
      for (const admin of superAdmins) {
        try {
          await prisma.notification.create({
            data: {
              organizationId: ownerOrgId,
              userId: admin.id,
              type: NotificationType.BILLING_SELLER_ALERT,
              title: input.subject,
              body: input.body,
              href,
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
