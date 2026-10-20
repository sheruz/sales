/**
 * B3.2 Super Admin revenue metrics (LIVE vs sandbox/Test).
 */

import prisma from "@/lib/db/prisma";
import { SubscriptionStatus } from "@prisma/client";
import { env } from "@/lib/config/env";

function monthStart(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function addMonths(d: Date, n: number) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
}

export class RevenueMetricsService {
  private ownerFilter() {
    const ownerId = env.PLATFORM_OWNER_ORG_ID || null;
    return ownerId ? { organizationId: { not: ownerId } } : {};
  }

  async snapshot(environment: "production" | "sandbox") {
    const owner = this.ownerFilter();
    const subs = await prisma.subscription.findMany({
      where: {
        ...owner,
        providerEnvironment: environment,
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

    for (const s of subs) {
      byStatus[s.status] = (byStatus[s.status] || 0) + 1;
      if (
        s.status !== SubscriptionStatus.ACTIVE &&
        s.status !== SubscriptionStatus.TRIALING &&
        s.status !== SubscriptionStatus.PAST_DUE
      ) {
        continue;
      }
      const v = s.planVersion;
      if (!v) continue;
      const monthly =
        s.billingInterval === "YEARLY"
          ? Number(v.priceYearly) / 12
          : Number(v.priceMonthly);
      if (s.status === SubscriptionStatus.ACTIVE) {
        mrr += monthly;
        const planName = v.plan?.name || "Unknown";
        mrrByPlan[planName] = (mrrByPlan[planName] || 0) + monthly;
        const prov = s.provider || "UNKNOWN";
        mrrByProvider[prov] = (mrrByProvider[prov] || 0) + monthly;
      }
    }

    const thisStart = monthStart();
    const lastStart = addMonths(thisStart, -1);
    const nextStart = addMonths(thisStart, 1);

    const [revThis, revLast, topUpThis, refundsThis, outstanding, failedPay] =
      await Promise.all([
        prisma.billingTransaction.aggregate({
          where: {
            environment,
            kind: { in: ["subscription", "renewal", "topup", "manual"] },
            status: { in: ["completed", "paid", "succeeded"] },
            occurredAt: { gte: thisStart, lt: nextStart },
            ...(owner.organizationId
              ? { organizationId: owner.organizationId }
              : {}),
          },
          _sum: { amount: true },
        }),
        prisma.billingTransaction.aggregate({
          where: {
            environment,
            kind: { in: ["subscription", "renewal", "topup", "manual"] },
            status: { in: ["completed", "paid", "succeeded"] },
            occurredAt: { gte: lastStart, lt: thisStart },
            ...(owner.organizationId
              ? { organizationId: owner.organizationId }
              : {}),
          },
          _sum: { amount: true },
        }),
        prisma.billingTransaction.aggregate({
          where: {
            environment,
            kind: "topup",
            status: { in: ["completed", "paid", "succeeded"] },
            occurredAt: { gte: thisStart, lt: nextStart },
          },
          _sum: { amount: true },
        }),
        prisma.billingTransaction.aggregate({
          where: {
            environment,
            kind: { in: ["refund", "chargeback"] },
            occurredAt: { gte: thisStart, lt: nextStart },
          },
          _sum: { amount: true },
        }),
        prisma.invoice.count({
          where: {
            status: { in: ["OPEN", "OVERDUE"] },
            ...(env.PLATFORM_OWNER_ORG_ID
              ? { organizationId: { not: env.PLATFORM_OWNER_ORG_ID } }
              : {}),
          },
        }),
        prisma.subscription.count({
          where: {
            status: SubscriptionStatus.PAST_DUE,
            ...owner,
            providerEnvironment: environment,
          },
        }),
      ]);

    // 12-month revenue chart from transactions
    const chartStart = addMonths(thisStart, -11);
    const txns = await prisma.billingTransaction.findMany({
      where: {
        environment,
        kind: { in: ["subscription", "renewal", "topup", "manual"] },
        status: { in: ["completed", "paid", "succeeded"] },
        occurredAt: { gte: chartStart },
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

    // MRR movement approximations from status (full cohort history needs ledger — best-effort)
    const newMrr = mrr; // placeholder detail; UI labels as estimated
    return {
      environment,
      label: environment === "production" ? "LIVE" : "Test",
      mrr,
      arr: mrr * 12,
      revenueThisMonth: Number(revThis._sum.amount || 0),
      revenueLastMonth: Number(revLast._sum.amount || 0),
      chart12m: chart,
      mrrByPlan,
      mrrByProvider,
      movement: {
        newMrr,
        expansionMrr: 0,
        contractionMrr: 0,
        churnedMrr: 0,
        note: "Movement breakdown improves as BillingTransaction history grows",
      },
      counts: byStatus,
      trialToPaidRate: trialToPaid,
      topUpRevenueThisMonth: Number(topUpThis._sum.amount || 0),
      refundsThisMonth: Number(refundsThis._sum.amount || 0),
      outstandingManualInvoices: outstanding,
      failedPaymentsNeedingAttention: failedPay,
    };
  }
}

export const revenueMetricsService = new RevenueMetricsService();
