import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin, requireSuperAdminWrite } from "@/lib/auth/api-auth";
import { apiSuccess, ValidationError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import prisma from "@/lib/db/prisma";
import { env } from "@/lib/config/env";
import { paddleProvider } from "@/services/billing/paddle.provider";
import { isPaddleConfigured, paddleEnvironment } from "@/services/billing/paddle-client";
import { billingTransactionService } from "@/services/billing/billing-transaction.service";
import { organizationService } from "@/services/organization.service";
import { paymentConfigService } from "@/services/billing/payment-config.service";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requireSuperAdmin();
    const { id: organizationId } = await ctx.params;
    if (organizationId === env.PLATFORM_OWNER_ORG_ID) {
      throw new ValidationError("Owner org has no billing detail");
    }

    const [org, sub, invoices, ledger, topUps, txns] = await Promise.all([
      prisma.organization.findUniqueOrThrow({
        where: { id: organizationId },
        select: {
          id: true,
          name: true,
          billingEmail: true,
          billingContactName: true,
          billingAddress: true,
          billingCountry: true,
          billingTaxId: true,
          billingProvider: true,
          paddleCustomerId: true,
          paddleCustomerEnv: true,
          stripeCustomerId: true,
          stripeCustomerEnv: true,
          creditBalanceCached: true,
        },
      }),
      prisma.subscription.findUnique({
        where: { organizationId },
        include: {
          planVersion: {
            include: { plan: { select: { name: true, code: true } } },
          },
        },
      }),
      prisma.invoice.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.creditLedgerEntry.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.billingTransaction.findMany({
        where: { organizationId, kind: "topup" },
        orderBy: { occurredAt: "desc" },
        take: 30,
      }),
      billingTransactionService.list({ organizationId, take: 50 }),
    ]);

    let paddleCustomerEmail: string | null = null;
    if (org.paddleCustomerId && (await isPaddleConfigured())) {
      try {
        const c = await paddleProvider.getCustomer(org.paddleCustomerId);
        paddleCustomerEmail = c.email || null;
      } catch {
        paddleCustomerEmail = null;
      }
    }

    const paddleEnv = await paddleEnvironment().catch(() => "sandbox");
    const paddleBase =
      paddleEnv === "production"
        ? "https://vendors.paddle.com"
        : "https://sandbox-vendors.paddle.com";

    return NextResponse.json(
      apiSuccess({
        organization: org,
        subscription: sub,
        invoices,
        creditLedger: ledger,
        topUps,
        transactions: txns.rows,
        paddleCustomerEmail,
        links: {
          paddleCustomer: org.paddleCustomerId
            ? `${paddleBase}/customers-v2/${org.paddleCustomerId}`
            : null,
          paddleSubscription: sub?.externalSubscriptionId
            ? `${paddleBase}/subscriptions-v2/${sub.externalSubscriptionId}`
            : null,
        },
      })
    );
  } catch (error) {
    return handleApiError(error);
  }
}

const actionSchema = z.object({
  action: z.enum([
    "resync_paddle",
    "change_provider",
    "mark_invoice_paid",
    "record_refund",
  ]),
  provider: z.string().optional(),
  invoiceId: z.string().uuid().optional(),
  amount: z.number().optional(),
  reason: z.string().min(1),
});

export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    const user = await requireSuperAdminWrite();
    const { id: organizationId } = await ctx.params;
    const body = actionSchema.parse(await request.json());

    if (body.action === "resync_paddle") {
      if (!(await isPaddleConfigured())) {
        throw new ValidationError("Paddle not configured");
      }
      const sub = await prisma.subscription.findUnique({
        where: { organizationId },
      });
      if (!sub?.externalSubscriptionId) {
        throw new ValidationError("No Paddle subscription on this org");
      }
      // Pull subscription from Paddle and patch local period/status
      const { paddleFetch } = await import(
        "@/services/billing/paddle-client"
      );
      const res = await paddleFetch<{
        data: {
          id: string;
          status: string;
          current_billing_period?: {
            starts_at?: string;
            ends_at?: string;
          };
        };
      }>(`/subscriptions/${sub.externalSubscriptionId}`);
      const statusMap: Record<string, string> = {
        active: "ACTIVE",
        past_due: "PAST_DUE",
        canceled: "CANCELED",
        paused: "SUSPENDED",
        trialing: "TRIALING",
      };
      const nextStatus = statusMap[res.data.status] || sub.status;
      await prisma.subscription.update({
        where: { organizationId },
        data: {
          status: nextStatus as never,
          currentPeriodStart: res.data.current_billing_period?.starts_at
            ? new Date(res.data.current_billing_period.starts_at)
            : undefined,
          currentPeriodEnd: res.data.current_billing_period?.ends_at
            ? new Date(res.data.current_billing_period.ends_at)
            : undefined,
        },
      });
      await organizationService.writePlatformAudit({
        actorUserId: user.id,
        action: "billing.resync_paddle",
        targetType: "subscription",
        organizationId,
        after: { paddleStatus: res.data.status, localStatus: nextStatus },
        reason: body.reason,
      });
      return NextResponse.json(apiSuccess({ ok: true, status: nextStatus }));
    }

    if (body.action === "change_provider") {
      if (!body.provider) throw new ValidationError("provider required");
      await paymentConfigService; // keep import used
      await prisma.organization.update({
        where: { id: organizationId },
        data: { billingProvider: body.provider },
      });
      await organizationService.writePlatformAudit({
        actorUserId: user.id,
        action: "billing.change_provider",
        targetType: "organization",
        organizationId,
        after: { billingProvider: body.provider },
        reason: body.reason,
      });
      return NextResponse.json(apiSuccess({ ok: true }));
    }

    if (body.action === "mark_invoice_paid") {
      if (!body.invoiceId) throw new ValidationError("invoiceId required");
      const { invoiceService } = await import(
        "@/services/billing/invoice.service"
      );
      const inv = await prisma.invoice.findUniqueOrThrow({
        where: { id: body.invoiceId },
      });
      await invoiceService.markPaid({
        invoiceId: body.invoiceId,
        amount: Number(inv.total),
        method: "manual",
        notes: body.reason,
        actorUserId: user.id,
        reason: body.reason,
        activateNow: true,
      });
      return NextResponse.json(apiSuccess({ ok: true }));
    }

    if (body.action === "record_refund") {
      await billingTransactionService.record({
        organizationId,
        provider: "MANUAL",
        environment: "production",
        kind: "refund",
        status: "completed",
        amount: body.amount ?? 0,
        occurredAt: new Date(),
        description: body.reason,
      });
      await organizationService.writePlatformAudit({
        actorUserId: user.id,
        action: "billing.record_refund",
        targetType: "organization",
        organizationId,
        after: { amount: body.amount },
        reason: body.reason,
      });
      return NextResponse.json(apiSuccess({ ok: true }));
    }

    throw new ValidationError("Unknown action");
  } catch (error) {
    return handleApiError(error);
  }
}
