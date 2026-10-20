/**
 * B3 manual invoices + numbering + mark paid.
 */

import prisma from "@/lib/db/prisma";
import { env } from "@/lib/config/env";
import { InvoiceStatus, Prisma, SubscriptionStatus } from "@prisma/client";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/api/response";
import { organizationService } from "@/services/organization.service";
import { entitlementService } from "@/services/entitlement.service";
import { creditLedgerService } from "@/services/credit-ledger.service";
import { logger } from "@/lib/logger";
import { env as appEnv } from "@/lib/config/env";

async function nextInvoiceNumber(tx: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getUTCFullYear();
  const seq = await tx.invoiceSequence.upsert({
    where: { year },
    create: { year, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
  });
  const n = String(seq.lastNumber).padStart(4, "0");
  return `DLX-${year}-${n}`;
}

export class InvoiceService {
  async createSubscriptionInvoice(input: {
    organizationId: string;
    planVersionId: string;
    interval: "MONTHLY" | "YEARLY";
    provider: string;
    billingEmail?: string;
    actorUserId?: string;
  }) {
    if (env.PLATFORM_OWNER_ORG_ID === input.organizationId) {
      throw new ValidationError("Platform owner is never invoiced");
    }
    const version = await prisma.planVersion.findUniqueOrThrow({
      where: { id: input.planVersionId },
      include: { plan: true },
    });
    const amount =
      input.interval === "MONTHLY"
        ? Number(version.priceMonthly)
        : Number(version.priceYearly);
    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: input.organizationId },
    });

    const due = new Date(Date.now() + 7 * 86_400_000);
    const invoice = await prisma.$transaction(async (tx) => {
      const number = await nextInvoiceNumber(tx);
      return tx.invoice.create({
        data: {
          number,
          organizationId: input.organizationId,
          status: InvoiceStatus.OPEN,
          provider: input.provider,
          currency: version.currency || "USD",
          subtotal: amount,
          total: amount,
          dueDate: due,
          planVersionId: version.id,
          billingName: org.name,
          billingEmail: input.billingEmail || org.billingEmail,
          lineItems: [
            {
              description: `${version.plan.name} (${input.interval.toLowerCase()})`,
              amount,
              planVersionId: version.id,
              interval: input.interval,
            },
          ],
          createdByUserId: input.actorUserId ?? null,
        },
      });
    });

    await organizationService.writePlatformAudit({
      actorUserId: input.actorUserId,
      action: "invoice.created",
      targetType: "invoice",
      targetId: invoice.id,
      organizationId: input.organizationId,
      after: { number: invoice.number, total: amount },
    });

    void this.emailStub(
      input.billingEmail || org.billingEmail,
      `Invoice ${invoice.number} issued`,
      `Your invoice ${invoice.number} for ${amount} ${invoice.currency} is ready.`,
      org.name
    );

    return invoice;
  }

  async createTopUpInvoice(input: {
    organizationId: string;
    topUpPackId: string;
    provider: string;
    billingEmail?: string;
  }) {
    const pack = await prisma.topUpPack.findUniqueOrThrow({
      where: { id: input.topUpPackId },
    });
    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: input.organizationId },
    });
    const amount = Number(pack.price);
    return prisma.$transaction(async (tx) => {
      const number = await nextInvoiceNumber(tx);
      return tx.invoice.create({
        data: {
          number,
          organizationId: input.organizationId,
          status: InvoiceStatus.OPEN,
          provider: input.provider,
          currency: pack.currency,
          subtotal: amount,
          total: amount,
          dueDate: new Date(Date.now() + 7 * 86_400_000),
          billingName: org.name,
          billingEmail: input.billingEmail || org.billingEmail,
          lineItems: [
            {
              description: pack.name,
              amount,
              topUpPackId: pack.id,
              credits: pack.credits,
            },
          ],
        },
      });
    });
  }

  async createProrationInvoice(input: {
    organizationId: string;
    planVersionId: string;
    interval: "MONTHLY" | "YEARLY";
    provider: string;
    activateOnPayment: boolean;
  }) {
    return this.createSubscriptionInvoice({
      ...input,
      billingEmail: undefined,
    });
  }

  async setPaymentUrl(input: {
    invoiceId: string;
    paymentUrl: string;
    actorUserId: string;
    reason: string;
  }) {
    if (!input.reason?.trim()) throw new ValidationError("reason is required");
    const before = await prisma.invoice.findUnique({
      where: { id: input.invoiceId },
    });
    if (!before) throw new NotFoundError("Invoice not found");
    const invoice = await prisma.invoice.update({
      where: { id: input.invoiceId },
      data: { paymentUrl: input.paymentUrl },
    });
    await organizationService.writePlatformAudit({
      actorUserId: input.actorUserId,
      action: "invoice.payment_url_set",
      targetType: "invoice",
      targetId: invoice.id,
      organizationId: invoice.organizationId,
      before,
      after: invoice,
      reason: input.reason,
    });
    void this.emailStub(
      invoice.billingEmail,
      `Payment link for ${invoice.number}`,
      `A payment link was added for invoice ${invoice.number}.`,
      null
    );
    return invoice;
  }

  async markPaid(input: {
    invoiceId: string;
    amount: number;
    method: string;
    reference?: string;
    notes?: string;
    actorUserId: string;
    reason: string;
    activateNow?: boolean;
  }) {
    if (!input.reason?.trim()) throw new ValidationError("reason is required");

    const result = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { id: input.invoiceId },
      });
      if (!invoice) throw new NotFoundError("Invoice not found");
      if (invoice.status === InvoiceStatus.PAID) {
        throw new ConflictError("Invoice already paid", "ALREADY_PAID");
      }
      if (invoice.status === InvoiceStatus.VOID) {
        throw new ValidationError("Cannot pay a void invoice");
      }

      const payment = await tx.payment.create({
        data: {
          invoiceId: invoice.id,
          amount: input.amount,
          method: input.method,
          reference: input.reference,
          notes: input.notes,
          receivedAt: new Date(),
          recordedByUserId: input.actorUserId,
        },
      });

      const updated = await tx.invoice.update({
        where: { id: invoice.id },
        data: { status: InvoiceStatus.PAID, paidAt: new Date() },
      });

      return { invoice: updated, payment, items: invoice.lineItems };
    });

    // Activate subscription / grant credits outside tx
    const items = result.items as Array<Record<string, unknown>>;
    const planVersionId =
      (items[0]?.planVersionId as string | undefined) ||
      result.invoice.planVersionId;
    const topUpPackId = items[0]?.topUpPackId as string | undefined;
    const credits = Number(items[0]?.credits || 0);
    const interval = (items[0]?.interval as string) || "MONTHLY";

    if (planVersionId && input.activateNow !== false) {
      await entitlementService.assignPlanVersion({
        organizationId: result.invoice.organizationId,
        planVersionId,
        status: SubscriptionStatus.ACTIVE,
        accessMode: "manual",
        actorUserId: input.actorUserId,
      });
      await prisma.subscription.update({
        where: { organizationId: result.invoice.organizationId },
        data: {
          provider: result.invoice.provider,
          billingInterval: interval,
        },
      });
    }

    if (topUpPackId && credits > 0) {
      await creditLedgerService.grant({
        organizationId: result.invoice.organizationId,
        amount: credits,
        type: "PURCHASE",
        idempotencyKey: `invoice_paid:${result.invoice.id}`,
        reason: input.reason,
        actorUserId: input.actorUserId,
      });
    }

    await organizationService.writePlatformAudit({
      actorUserId: input.actorUserId,
      action: "invoice.marked_paid",
      targetType: "invoice",
      targetId: result.invoice.id,
      organizationId: result.invoice.organizationId,
      after: { paymentId: result.payment.id },
      reason: input.reason,
    });

    void this.emailStub(
      result.invoice.billingEmail,
      `Payment received — ${result.invoice.number}`,
      `We received payment for invoice ${result.invoice.number}. Thank you.`,
      null
    );

    return result;
  }

  async voidInvoice(input: {
    invoiceId: string;
    actorUserId: string;
    reason: string;
  }) {
    if (!input.reason?.trim()) throw new ValidationError("reason is required");
    const invoice = await prisma.invoice.findUnique({
      where: { id: input.invoiceId },
    });
    if (!invoice) throw new NotFoundError("Invoice not found");
    if (invoice.status === InvoiceStatus.PAID) {
      throw new ValidationError("Cannot void a paid invoice");
    }
    const updated = await prisma.invoice.update({
      where: { id: input.invoiceId },
      data: { status: InvoiceStatus.VOID },
    });
    await organizationService.writePlatformAudit({
      actorUserId: input.actorUserId,
      action: "invoice.voided",
      targetType: "invoice",
      targetId: invoice.id,
      organizationId: invoice.organizationId,
      reason: input.reason,
    });
    return updated;
  }

  async list(filters: {
    organizationId?: string;
    status?: InvoiceStatus;
    provider?: string;
    take?: number;
  }) {
    return prisma.invoice.findMany({
      where: {
        ...(filters.organizationId
          ? { organizationId: filters.organizationId }
          : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.provider ? { provider: filters.provider } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: filters.take ?? 100,
      include: {
        organization: { select: { id: true, name: true, slug: true } },
        payments: true,
      },
    });
  }

  /** Renewal invoices for manual providers — T-7 days */
  async createDueRenewalInvoices(now = new Date()) {
    const horizon = new Date(now.getTime() + 7 * 86_400_000);
    const subs = await prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        provider: { in: ["MANUAL_PAYONEER", "MANUAL_BANK"] },
        currentPeriodEnd: { lte: horizon, gte: now },
        planVersionId: { not: null },
      },
    });
    let created = 0;
    for (const sub of subs) {
      if (env.PLATFORM_OWNER_ORG_ID === sub.organizationId) continue;
      const existing = await prisma.invoice.findFirst({
        where: {
          organizationId: sub.organizationId,
          status: { in: [InvoiceStatus.OPEN, InvoiceStatus.OVERDUE] },
          planVersionId: sub.planVersionId!,
          periodEnd: sub.currentPeriodEnd,
        },
      });
      if (existing) continue;
      await this.createSubscriptionInvoice({
        organizationId: sub.organizationId,
        planVersionId: sub.planVersionId!,
        interval: (sub.billingInterval as "MONTHLY" | "YEARLY") || "MONTHLY",
        provider: sub.provider,
      });
      // stamp period on latest
      await prisma.invoice.updateMany({
        where: {
          organizationId: sub.organizationId,
          status: InvoiceStatus.OPEN,
          planVersionId: sub.planVersionId!,
        },
        data: {
          periodStart: sub.currentPeriodStart,
          periodEnd: sub.currentPeriodEnd,
        },
      });
      created++;
    }
    return created;
  }

  async markOverdue(now = new Date()) {
    const res = await prisma.invoice.updateMany({
      where: {
        status: InvoiceStatus.OPEN,
        dueDate: { lt: now },
      },
      data: { status: InvoiceStatus.OVERDUE },
    });
    return res.count;
  }

  private async emailStub(
    to: string | null | undefined,
    subject: string,
    body: string,
    orgName?: string | null
  ) {
    if (!to) return;
    try {
      const { billingNotifyService } = await import(
        "@/services/billing/billing-notify.service"
      );
      await billingNotifyService.sendBrandedTo({
        to,
        subject,
        body: `${body}\n\nTaxes may apply depending on your location.`,
        orgName,
        ctaLabel: "View billing",
      });
    } catch (err) {
      logger.warn("billing email stub failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /** Simple HTML “PDF” stored as html path content for download */
  async renderInvoiceHtml(invoiceId: string): Promise<string> {
    const invoice = await prisma.invoice.findUniqueOrThrow({
      where: { id: invoiceId },
      include: { organization: true },
    });
    const paySettings = await prisma.paymentSettings.findUnique({
      where: { id: "default" },
    });
    const biz =
      (paySettings?.business as Record<string, string> | null) ||
      ((
        await prisma.settings.findUnique({
          where: { key: "platform_billing" },
        })
      )?.value as Record<string, string> | null) ||
      {};
    const items = invoice.lineItems as Array<{ description: string; amount: number }>;
    const lines = items
      .map(
        (i) =>
          `<tr><td>${i.description}</td><td style="text-align:right">${invoice.currency} ${i.amount}</td></tr>`
      )
      .join("");
    return `<!doctype html><html><body style="font-family:system-ui;padding:32px">
      <h1>Invoice ${invoice.number}</h1>
      <p><strong>${biz.name || "Delvix"}</strong><br/>${biz.address || ""}<br/>${biz.email || ""}
      ${biz.taxId ? `<br/>Tax ID: ${biz.taxId}` : ""}</p>
      <p>Bill to: ${invoice.billingName || invoice.organization.name}<br/>
      ${invoice.billingEmail || ""}<br/>${invoice.billingAddress || ""}</p>
      <table style="width:100%;border-collapse:collapse">${lines}</table>
      <p style="text-align:right;font-size:18px"><strong>Total: ${invoice.currency} ${Number(invoice.total)}</strong></p>
      <p style="color:#666;font-size:12px">Taxes may apply depending on your location. Status: ${invoice.status}</p>
    </body></html>`;
  }
}

export const invoiceService = new InvoiceService();
