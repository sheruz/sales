/**
 * B3: store-first webhook processing with retries + unmatched queue.
 */

import prisma from "@/lib/db/prisma";
import { env } from "@/lib/config/env";
import { SubscriptionStatus, PlanVersionStatus, PlanVisibility } from "@prisma/client";
import { paddleProvider } from "@/services/billing/paddle.provider";
import { stripeProvider } from "@/services/billing/stripe.provider";
import { paddleEnvironment } from "@/services/billing/paddle-client";
import { paymentConfigService } from "@/services/billing/payment-config.service";
import { entitlementService } from "@/services/entitlement.service";
import { creditLedgerService } from "@/services/credit-ledger.service";
import { organizationService } from "@/services/organization.service";
import { planPauseService } from "@/services/plan-pause.service";
import { FEATURE_KEYS } from "@/lib/billing/features";
import { billingGateway } from "@/services/billing-gateway.service";
import { sendEmailWithConfig } from "@/lib/email/send-mail";
import { logger } from "@/lib/logger";

export class WebhookProcessorService {
  private async storeAndProcess(
    provider: "paddle" | "stripe",
    verified: {
      eventId: string;
      eventType: string;
      payload: unknown;
      occurredAt: Date;
    },
    environment: string
  ) {
    try {
      await prisma.billingWebhookEvent.create({
        data: {
          provider,
          environment,
          eventId: verified.eventId,
          eventType: verified.eventType,
          payload: verified.payload as object,
          occurredAt: verified.occurredAt,
          status: "received",
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/unique|duplicate/i.test(msg)) {
        return { ok: true, duplicate: true };
      }
      throw err;
    }

    void paymentConfigService
      .touchWebhook(provider === "paddle" ? "PADDLE" : "STRIPE")
      .catch(() => {});

    void this.processEventById(verified.eventId).catch((e) =>
      logger.error("webhook process failed", {
        eventId: verified.eventId,
        error: e instanceof Error ? e.message : String(e),
      })
    );

    return { ok: true, duplicate: false };
  }

  /** Verify → store → return quickly. Processing is separate. */
  async receivePaddleWebhook(rawBody: string, signatureHeader: string | null) {
    const verified = await paddleProvider.verifyWebhook({
      rawBody,
      signatureHeader,
    });

    const payload = verified.payload as {
      data?: { custom_data?: Record<string, unknown> };
    };
    const envName = await paddleEnvironment();
    const envHint = payload?.data?.custom_data?.paddleEnv as string | undefined;
    if (envHint && envHint !== envName) {
      throw new Error("Paddle event from wrong environment");
    }

    return this.storeAndProcess("paddle", verified, envName);
  }

  async receiveStripeWebhook(rawBody: string, signatureHeader: string | null) {
    const verified = await stripeProvider.verifyWebhook({
      rawBody,
      signatureHeader,
    });
    const cfg = await paymentConfigService.getProviderCredentials("STRIPE");
    const environment = cfg?.environment || "sandbox";
    const payload = verified.payload as {
      data?: { object?: { metadata?: { stripeEnv?: string } } };
    };
    const envHint = payload?.data?.object?.metadata?.stripeEnv;
    if (envHint && envHint !== environment) {
      throw new Error("Stripe event from wrong environment");
    }
    return this.storeAndProcess("stripe", verified, environment);
  }

  async processEventById(eventId: string) {
    const row = await prisma.billingWebhookEvent.findUnique({
      where: { eventId },
    });
    if (!row) return;
    if (row.status === "processed") return;

    await prisma.billingWebhookEvent.update({
      where: { id: row.id },
      data: {
        status: "processing",
        attemptCount: { increment: 1 },
      },
    });

    try {
      // Ordered: ignore if we already processed a newer event for same sub
      const mapper =
        row.provider === "stripe" ? stripeProvider : paddleProvider;
      const mapped = await mapper.mapEvent(row.payload);

      if (mapped.type === "unmatched") {
        await prisma.billingWebhookEvent.update({
          where: { id: row.id },
          data: {
            status: "unmatched",
            error: mapped.reason,
            processedAt: new Date(),
          },
        });
        return;
      }

      const orgId =
        "organizationId" in mapped ? mapped.organizationId : null;
      if (orgId === env.PLATFORM_OWNER_ORG_ID) {
        await prisma.billingWebhookEvent.update({
          where: { id: row.id },
          data: {
            status: "processed",
            error: "ignored platform owner",
            processedAt: new Date(),
          },
        });
        return;
      }

      if (orgId) {
        const org = await prisma.organization.findUnique({
          where: { id: orgId },
        });
        if (!org) {
          await prisma.billingWebhookEvent.update({
            where: { id: row.id },
            data: {
              status: "unmatched",
              error: "organization not found",
              processedAt: new Date(),
            },
          });
          return;
        }
      }

      // Out-of-order guard
      if (
        "externalSubscriptionId" in mapped &&
        mapped.externalSubscriptionId &&
        row.occurredAt
      ) {
        const newer = await prisma.billingWebhookEvent.findFirst({
          where: {
            externalSubscriptionId: mapped.externalSubscriptionId,
            status: "processed",
            occurredAt: { gt: row.occurredAt },
          },
        });
        if (newer) {
          await prisma.billingWebhookEvent.update({
            where: { id: row.id },
            data: {
              status: "processed",
              error: "ignored older event",
              processedAt: new Date(),
              organizationId: orgId,
              externalSubscriptionId: mapped.externalSubscriptionId,
            },
          });
          return;
        }
      }

      await this.applyMapped(mapped, row.id, row.provider);

      await prisma.billingWebhookEvent.update({
        where: { id: row.id },
        data: {
          status: "processed",
          processedAt: new Date(),
          organizationId: orgId,
          externalSubscriptionId:
            "externalSubscriptionId" in mapped
              ? mapped.externalSubscriptionId
              : undefined,
          error: null,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await prisma.billingWebhookEvent.update({
        where: { id: row.id },
        data: {
          status: "error",
          error: message.slice(0, 1000),
          nextRetryAt: new Date(Date.now() + 5 * 60_000),
        },
      });
      throw err;
    }
  }

  private async applyMapped(
    mapped: Awaited<ReturnType<typeof paddleProvider.mapEvent>>,
    _eventRowId: string,
    webhookProvider: string
  ) {
    switch (mapped.type) {
      case "subscription_activated": {
        // Validate plan version is public/published and matches
        const version = await prisma.planVersion.findUnique({
          where: { id: mapped.planVersionId },
          include: { plan: true },
        });
        if (
          !version ||
          version.status !== PlanVersionStatus.PUBLISHED ||
          version.plan.visibility !== PlanVisibility.PUBLIC
        ) {
          throw new Error("planVersion not public/published");
        }

        const providerLabel =
          webhookProvider === "stripe" ? "STRIPE" : "PADDLE";
        const accessMode =
          providerLabel === "STRIPE" ? "stripe" : "paddle";
        const providerEnv =
          providerLabel === "STRIPE"
            ? (
                await paymentConfigService.getProviderCredentials("STRIPE")
              )?.environment || "sandbox"
            : await paddleEnvironment();

        await entitlementService.assignPlanVersion({
          organizationId: mapped.organizationId,
          planVersionId: mapped.planVersionId,
          status: SubscriptionStatus.ACTIVE,
          accessMode,
        });
        await prisma.subscription.update({
          where: { organizationId: mapped.organizationId },
          data: {
            provider: providerLabel,
            providerEnvironment: providerEnv,
            externalCustomerId: mapped.externalCustomerId || undefined,
            externalSubscriptionId: mapped.externalSubscriptionId || undefined,
            billingInterval: mapped.interval,
            currentPeriodStart: mapped.currentPeriodStart,
            currentPeriodEnd: mapped.currentPeriodEnd,
            status: SubscriptionStatus.ACTIVE,
            gracePeriodEndsAt: null,
            cancelAtPeriodEnd: false,
          },
        });
        await this.emailOrgAdmin(
          mapped.organizationId,
          "Welcome — your workspace is active",
          "Your payment was received and your Delvix workspace is now active."
        );
        break;
      }
      case "renewal_paid": {
        await prisma.subscription.update({
          where: { organizationId: mapped.organizationId },
          data: {
            status: SubscriptionStatus.ACTIVE,
            currentPeriodStart: mapped.currentPeriodStart,
            currentPeriodEnd: mapped.currentPeriodEnd,
            gracePeriodEndsAt: null,
            lastPaymentFailedNoticeDay: null,
          },
        });
        {
          const sub = await prisma.subscription.findUnique({
            where: { organizationId: mapped.organizationId },
            include: { planVersion: { select: { monthlyCredits: true } } },
          });
          const monthly = sub?.planVersion?.monthlyCredits ?? 0;
          if (monthly > 0) {
            await creditLedgerService.grant({
              organizationId: mapped.organizationId,
              amount: monthly,
              type: "GRANT_PLAN",
              idempotencyKey: `paddle_tx:${mapped.transactionId}`,
              reason: "paddle_renewal",
            });
          }
        }
        break;
      }
      case "topup_paid": {
        if (!mapped.topUpPackId || !mapped.credits) break;
        await creditLedgerService.grant({
          organizationId: mapped.organizationId,
          amount: mapped.credits,
          type: "PURCHASE",
          idempotencyKey: `paddle_tx:${mapped.transactionId}`,
          reason: "Paddle top-up",
        });
        await this.emailOrgAdmin(
          mapped.organizationId,
          "Credits added",
          `${mapped.credits} credits were added to your account.`
        );
        break;
      }
      case "payment_failed": {
        const settings = await paymentConfigService.getSettings();
        const graceDays = settings.graceDays || env.BILLING_GRACE_DAYS;
        const grace = new Date(
          mapped.occurredAt.getTime() + graceDays * 86_400_000
        );
        await prisma.subscription.update({
          where: { organizationId: mapped.organizationId },
          data: {
            status: SubscriptionStatus.PAST_DUE,
            gracePeriodEndsAt: grace,
            lastPaymentFailedNoticeDay: 0,
          },
        });
        await this.emailOrgAdmin(
          mapped.organizationId,
          "Payment failed",
          "Your payment failed. Please update your payment method to avoid suspension."
        );
        break;
      }
      case "subscription_updated": {
        const data: Record<string, unknown> = {};
        if (mapped.currentPeriodStart)
          data.currentPeriodStart = mapped.currentPeriodStart;
        if (mapped.currentPeriodEnd)
          data.currentPeriodEnd = mapped.currentPeriodEnd;
        if (mapped.cancelAtPeriodEnd != null)
          data.cancelAtPeriodEnd = mapped.cancelAtPeriodEnd;
        if (mapped.status === "active") data.status = SubscriptionStatus.ACTIVE;
        if (mapped.status === "past_due")
          data.status = SubscriptionStatus.PAST_DUE;
        if (mapped.status === "canceled")
          data.status = SubscriptionStatus.CANCELED;
        if (mapped.planVersionId) {
          // Validate published
          const v = await prisma.planVersion.findUnique({
            where: { id: mapped.planVersionId },
            include: { plan: true },
          });
          if (
            v &&
            v.status === PlanVersionStatus.PUBLISHED &&
            mapped.occurredAt
          ) {
            data.planVersionId = mapped.planVersionId;
            data.planId = v.planId;
          }
        }
        if (Object.keys(data).length) {
          await prisma.subscription.update({
            where: { organizationId: mapped.organizationId },
            data,
          });
        }
        // If upgrade with new plan version, grant credit difference once
        if (mapped.planVersionId) {
          const sub = await prisma.subscription.findUnique({
            where: { organizationId: mapped.organizationId },
          });
          if (sub) {
            await creditLedgerService.grantOnPlanChange({
              organizationId: mapped.organizationId,
              fromPlanVersionId: sub.planVersionId,
              toPlanVersionId: mapped.planVersionId,
            });
            // pause extras if limits dropped
            const limits: Record<string, number | null> = {};
            for (const key of [
              FEATURE_KEYS.USERS,
              FEATURE_KEYS.OUTBOUND_MAILBOXES,
              FEATURE_KEYS.CAMPAIGNS,
              FEATURE_KEYS.SEQUENCES,
              FEATURE_KEYS.ICPS,
              FEATURE_KEYS.CONNECTORS,
            ]) {
              const feat = await billingGateway.getEffectiveFeature(
                mapped.organizationId,
                key
              );
              limits[key] = feat?.limitValue ?? null;
            }
            await planPauseService.reconcileOrgLimits(
              mapped.organizationId,
              limits,
              mapped.planVersionId,
              null
            );
          }
        }
        break;
      }
      case "subscription_canceled": {
        await prisma.subscription.update({
          where: { organizationId: mapped.organizationId },
          data: {
            status: SubscriptionStatus.CANCELED,
            canceledAt: mapped.occurredAt,
            cancelAtPeriodEnd: false,
          },
        });
        await this.emailOrgAdmin(
          mapped.organizationId,
          "Subscription canceled",
          "Your subscription has been canceled."
        );
        break;
      }
      case "refund_or_chargeback": {
        await organizationService.writePlatformAudit({
          action: mapped.isChargeback
            ? "billing.chargeback"
            : "billing.refund",
          targetType: "subscription",
          organizationId: mapped.organizationId ?? undefined,
          after: mapped,
        });
        if (mapped.isChargeback && mapped.organizationId) {
          await prisma.subscription.update({
            where: { organizationId: mapped.organizationId },
            data: { status: SubscriptionStatus.SUSPENDED },
          });
        }
        break;
      }
      default:
        break;
    }
  }

  /** Super Admin: attach unmatched event to an org and reprocess. */
  async linkUnmatched(eventId: string, organizationId: string) {
    if (organizationId === env.PLATFORM_OWNER_ORG_ID) {
      throw new Error("Cannot link to platform owner org");
    }
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!org) throw new Error("Organization not found");

    const row = await prisma.billingWebhookEvent.findUnique({
      where: { eventId },
    });
    if (!row) throw new Error("Webhook event not found");

    const payload = row.payload as {
      data?: { custom_data?: Record<string, unknown> };
    };
    const data = payload?.data || {};
    const custom = {
      ...(data.custom_data || {}),
      organizationId,
    };
    const nextPayload = {
      ...(typeof row.payload === "object" && row.payload
        ? (row.payload as object)
        : {}),
      data: { ...data, custom_data: custom },
    };

    await prisma.billingWebhookEvent.update({
      where: { id: row.id },
      data: {
        organizationId,
        payload: nextPayload,
        status: "received",
        error: null,
        nextRetryAt: null,
      },
    });
    await this.processEventById(eventId);
    return { ok: true };
  }

  async retryDue(now = new Date()) {
    const due = await prisma.billingWebhookEvent.findMany({
      where: {
        status: "error",
        nextRetryAt: { lte: now },
        attemptCount: { lt: 8 },
      },
      take: 20,
    });
    let n = 0;
    for (const row of due) {
      try {
        await this.processEventById(row.eventId);
        n++;
      } catch {
        // already recorded
      }
    }
    return n;
  }

  private async emailOrgAdmin(
    organizationId: string,
    subject: string,
    body: string
  ) {
    const admin = await prisma.organizationUser.findFirst({
      where: {
        organizationId,
        isPrimaryAdmin: true,
        status: "ACTIVE",
      },
      include: { user: true },
    });
    const to = admin?.user.email;
    if (!to) return;
    if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD) return;
    try {
      await sendEmailWithConfig(
        {
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          secure: env.SMTP_SECURE,
          user: env.SMTP_USER,
          password: env.SMTP_PASSWORD,
          fromName: env.SMTP_FROM_NAME,
          fromEmail: env.SMTP_FROM_EMAIL ?? env.SMTP_USER,
        },
        { to, subject, text: body, html: `<p>${body}</p>` }
      );
    } catch (err) {
      logger.warn("billing webhook email failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

export const webhookProcessorService = new WebhookProcessorService();
