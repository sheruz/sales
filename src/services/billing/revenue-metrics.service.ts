/**
 * B4a: Canonical Super Admin revenue / MRR metrics (single source for all pages).
 */

import prisma from "@/lib/db/prisma";
import { InvoiceStatus, SubscriptionStatus } from "@prisma/client";
import { env } from "@/lib/config/env";
import {
  isMrrEligible,
  monthlyEquivalent,
  mrrContribution,
} from "@/lib/billing/platform-metrics";

export type BillingEnvironment = "production" | "sandbox";

function monthStart(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function addMonths(d: Date, n: number) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
}

export class RevenueMetricsService {
  private ownerId() {
    return env.PLATFORM_OWNER_ORG_ID || null;
  }

  private ownerFilter() {
    const ownerId = this.ownerId();
    return ownerId ? { organizationId: { not: ownerId } } : {};
  }

  async snapshot(environment: BillingEnvironment) {
    const owner = this.ownerFilter();
    const ownerId = this.ownerId();

    const subs = await prisma.subscription.findMany({
      where: {
        ...owner,
        ...(environment === "sandbox"
          ? {
              OR: [
                { providerEnvironment: "sandbox" },
                { providerEnvironment: null },
              ],
            }
          : { providerEnvironment: environment }),
      },
      include: {
        planVersion: {
          select: {
            priceMonthly: true,
            priceYearly: true,
            plan: { select: { name: true, code: true } },
          },
        },
        organization: { select: { id: true, name: true } },
      },
    });

    // Manual paid = has PAID invoice or payment recorded
    const orgIds = subs.map((s) => s.organizationId);
    const paidOrgs = new Set<string>();
    if (orgIds.length) {
      const paid = await prisma.invoice.findMany({
        where: {
          organizationId: { in: orgIds },
          status: InvoiceStatus.PAID,
        },
        select: { organizationId: true },
      });
      for (const p of paid) paidOrgs.add(p.organizationId);
    }

    const byStatus: Record<string, number> = {
      ACTIVE: 0,
      TRIALING: 0,
      PAST_DUE: 0,
      SUSPENDED: 0,
      CANCELED: 0,
      NONE: 0,
      EXPIRED: 0,
    };
    let mrr = 0;
    const mrrByPlan: Record<string, number> = {};
    const mrrByProvider: Record<string, number> = {};
    let activeEligible = 0;

    for (const s of subs) {
      byStatus[s.status] = (byStatus[s.status] || 0) + 1;
      const planCode = s.planVersion?.plan?.code ?? null;
      const input = {
        status: s.status,
        billingInterval: s.billingInterval,
        accessMode: s.accessMode,
        provider: s.provider,
        organizationId: s.organizationId,
        planCode,
        priceMonthly:
          s.planVersion?.priceMonthly != null
            ? Number(s.planVersion.priceMonthly)
            : null,
        priceYearly:
          s.planVersion?.priceYearly != null
            ? Number(s.planVersion.priceYearly)
            : null,
        manualPaid: paidOrgs.has(s.organizationId)
          ? true
          : s.accessMode === "manual" ||
              (s.provider || "").startsWith("MANUAL")
            ? false
            : undefined,
      };
      if (!isMrrEligible(input, ownerId)) continue;
      const contrib = mrrContribution(input, ownerId);
      mrr += contrib;
      activeEligible += 1;
      const planName = s.planVersion?.plan?.name || "Unknown";
      mrrByPlan[planName] = (mrrByPlan[planName] || 0) + contrib;
      const prov = s.provider || "UNKNOWN";
      mrrByProvider[prov] = (mrrByProvider[prov] || 0) + contrib;
    }

    const thisStart = monthStart();
    const lastStart = addMonths(thisStart, -1);
    const nextStart = addMonths(thisStart, 1);

    // Approximate last-month MRR from same eligible set (no historical snapshot yet)
    const mrrLastMonth = mrr;

    const orgNotOwner = ownerId
      ? { organizationId: { not: ownerId } }
      : {};

    const [
      revThis,
      revLast,
      topUpThis,
      refundsThis,
      outstanding,
      failedPay,
      webhookFailed,
      webhookUnmatched,
      webhookSkipped,
    ] = await Promise.all([
      prisma.billingTransaction.aggregate({
        where: {
          environment,
          kind: { in: ["subscription", "renewal", "topup", "manual"] },
          status: { in: ["completed", "paid", "succeeded"] },
          occurredAt: { gte: thisStart, lt: nextStart },
          ...orgNotOwner,
        },
        _sum: { amount: true },
      }),
      prisma.billingTransaction.aggregate({
        where: {
          environment,
          kind: { in: ["subscription", "renewal", "topup", "manual"] },
          status: { in: ["completed", "paid", "succeeded"] },
          occurredAt: { gte: lastStart, lt: thisStart },
          ...orgNotOwner,
        },
        _sum: { amount: true },
      }),
      prisma.billingTransaction.aggregate({
        where: {
          environment,
          kind: "topup",
          status: { in: ["completed", "paid", "succeeded"] },
          occurredAt: { gte: thisStart, lt: nextStart },
          ...orgNotOwner,
        },
        _sum: { amount: true },
      }),
      prisma.billingTransaction.aggregate({
        where: {
          environment,
          kind: { in: ["refund", "chargeback"] },
          occurredAt: { gte: thisStart, lt: nextStart },
          ...orgNotOwner,
        },
        _sum: { amount: true },
      }),
      prisma.invoice.count({
        where: {
          status: { in: ["OPEN", "OVERDUE"] },
          ...orgNotOwner,
        },
      }),
      prisma.subscription.count({
        where: {
          status: SubscriptionStatus.PAST_DUE,
          ...owner,
          ...(environment === "sandbox"
            ? {
                OR: [
                  { providerEnvironment: "sandbox" },
                  { providerEnvironment: null },
                ],
              }
            : { providerEnvironment: environment }),
        },
      }),
      prisma.billingWebhookEvent.count({
        where: { status: "error", environment },
      }),
      prisma.billingWebhookEvent.count({
        where: { status: "unmatched", environment },
      }),
      prisma.billingWebhookEvent.count({
        where: { status: "skipped", environment },
      }),
    ]);

    const chartStart = addMonths(thisStart, -11);
    const txns = await prisma.billingTransaction.findMany({
      where: {
        environment,
        kind: { in: ["subscription", "renewal", "topup", "manual"] },
        status: { in: ["completed", "paid", "succeeded"] },
        occurredAt: { gte: chartStart },
        ...orgNotOwner,
      },
      select: { amount: true, occurredAt: true },
    });
    const chart: Array<{ month: string; revenue: number }> = [];
    for (let i = 0; i < 12; i++) {
      const m = addMonths(chartStart, i);
      const key = `${m.getUTCFullYear()}-${String(m.getUTCMonth() + 1).padStart(2, "0")}`;
      const end = addMonths(m, 1);
      const revenue = txns
        .filter((t) => t.occurredAt >= m && t.occurredAt < end)
        .reduce((s, t) => s + Number(t.amount), 0);
      chart.push({ month: key, revenue });
    }

    const trialing = byStatus.TRIALING || 0;
    const active = byStatus.ACTIVE || 0;
    const trialToPaid =
      trialing + active > 0 ? active / (trialing + active) : 0;

    return {
      environment,
      label: environment === "production" ? "LIVE" : "Test",
      mrr,
      mrrChangeVsLastMonth: mrr - mrrLastMonth,
      arr: mrr * 12,
      activeSubscriptions: activeEligible,
      revenueThisMonth: Number(revThis._sum.amount || 0),
      revenueLastMonth: Number(revLast._sum.amount || 0),
      chart12m: chart,
      mrrByPlan,
      mrrByProvider,
      counts: byStatus,
      trialToPaidRate: trialToPaid,
      topUpRevenueThisMonth: Number(topUpThis._sum.amount || 0),
      refundsThisMonth: Number(refundsThis._sum.amount || 0),
      outstandingManualInvoices: outstanding,
      failedPaymentsNeedingAttention: failedPay,
      webhooks: {
        failed: webhookFailed,
        unmatched: webhookUnmatched,
        skipped: webhookSkipped,
        /** Real attention count — not skipped */
        needingAttention: webhookFailed + webhookUnmatched,
      },
    };
  }

  /** Helper for tests / callers */
  monthlyFromPlan = monthlyEquivalent;
}

export const revenueMetricsService = new RevenueMetricsService();
