/**
 * B5c: derive single highest-priority tenant status banner.
 * Priority: suspended > past_due > canceled > trial_ending > limit_notice > low_credits > test_mode
 */

import prisma from "@/lib/db/prisma";
import { SubscriptionStatus, PlanLimitNoticeStatus } from "@prisma/client";
import { env } from "@/lib/config/env";

export type TenantBannerKind =
  | "suspended"
  | "past_due"
  | "canceled"
  | "trial_ending"
  | "limit_notice"
  | "low_credits"
  | "test_mode";

export type TenantBanner = {
  kind: TenantBannerKind;
  title: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  tone: "danger" | "warn" | "info";
  meta?: Record<string, string | number | null>;
};

const PRIORITY: TenantBannerKind[] = [
  "suspended",
  "past_due",
  "canceled",
  "trial_ending",
  "limit_notice",
  "low_credits",
  "test_mode",
];

export function pickHighestBanner(
  candidates: TenantBanner[]
): TenantBanner | null {
  for (const kind of PRIORITY) {
    const hit = candidates.find((c) => c.kind === kind);
    if (hit) return hit;
  }
  return null;
}

export async function resolveTenantBanners(
  organizationId: string
): Promise<TenantBanner | null> {
  if (
    env.PLATFORM_OWNER_ORG_ID &&
    organizationId === env.PLATFORM_OWNER_ORG_ID
  ) {
    return null;
  }

  const [org, sub, notice] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        creditBalanceCached: true,
        creditsWarnedAt20: true,
        creditsWarnedAt5: true,
        creditsWarnedAt0: true,
      },
    }),
    prisma.subscription.findUnique({
      where: { organizationId },
      include: {
        plan: { select: { monthlyCredits: true } },
        planVersion: { select: { monthlyCredits: true } },
      },
    }),
    prisma.planLimitNotice.findFirst({
      where: {
        organizationId,
        status: PlanLimitNoticeStatus.PENDING,
      },
      orderBy: { deadlineAt: "asc" },
    }),
  ]);

  const candidates: TenantBanner[] = [];
  const now = new Date();
  const status = sub?.status ?? null;

  if (status === SubscriptionStatus.SUSPENDED) {
    candidates.push({
      kind: "suspended",
      title: "Workspace suspended",
      body: "Outbound is paused. Inbox still syncs. Pay to restore full access.",
      ctaLabel: "Pay now",
      ctaHref: "/settings?tab=billing",
      tone: "danger",
    });
  }

  if (status === SubscriptionStatus.PAST_DUE) {
    candidates.push({
      kind: "past_due",
      title: "Payment past due",
      body: sub?.gracePeriodEndsAt
        ? `Update your card before ${sub.gracePeriodEndsAt.toISOString().slice(0, 10)} to avoid suspension.`
        : "Update your payment method to avoid suspension.",
      ctaLabel: "Update card",
      ctaHref: "/settings?tab=billing",
      tone: "danger",
      meta: {
        graceEndsAt: sub?.gracePeriodEndsAt?.toISOString() ?? null,
      },
    });
  }

  if (status === SubscriptionStatus.CANCELED) {
    candidates.push({
      kind: "canceled",
      title: "Subscription canceled",
      body: sub?.readOnlyUntil
        ? `Read-only access until ${sub.readOnlyUntil.toISOString().slice(0, 10)}. Export your data anytime.`
        : "Your subscription has ended. Export your data while you still can.",
      ctaLabel: "Export data",
      ctaHref: "/settings?tab=billing&export=1",
      tone: "warn",
    });
  }

  if (
    status === SubscriptionStatus.TRIALING &&
    sub?.trialEndsAt &&
    sub.trialEndsAt > now
  ) {
    const days =
      (sub.trialEndsAt.getTime() - now.getTime()) / 86_400_000;
    if (days <= 3.5) {
      candidates.push({
        kind: "trial_ending",
        title:
          days <= 1.5
            ? "Trial ends tomorrow"
            : `Trial ends in ${Math.ceil(days)} days`,
        body: `Your trial ends on ${sub.trialEndsAt.toISOString().slice(0, 10)}. Choose a plan to keep access.`,
        ctaLabel: "Choose plan",
        ctaHref: "/billing/choose-plan",
        tone: "warn",
        meta: { trialEndsAt: sub.trialEndsAt.toISOString() },
      });
    }
  }

  if (notice) {
    const msLeft = notice.deadlineAt.getTime() - now.getTime();
    const daysLeft = Math.max(0, Math.ceil(msLeft / 86_400_000));
    const timeLabel =
      msLeft <= 0
        ? "Deadline passed"
        : daysLeft <= 1
          ? "Less than 1 day left"
          : `${daysLeft} days left`;
    candidates.push({
      kind: "limit_notice",
      title: `Plan limit — ${timeLabel}`,
      body: `Keep ${notice.allowedCount} ${notice.featureKey.replace(/_/g, " ")}. Extras soft-pause at the deadline (not deleted). Primary admin is never paused.`,
      ctaLabel: "Choose what stays",
      ctaHref: "/billing/choose-what-stays",
      tone: "warn",
      meta: {
        featureKey: notice.featureKey,
        deadlineAt: notice.deadlineAt.toISOString(),
        allowedCount: notice.allowedCount,
      },
    });
  }

  if (org) {
    const monthly =
      sub?.planVersion?.monthlyCredits ?? sub?.plan?.monthlyCredits ?? 50;
    const bal = org.creditBalanceCached;
    if (org.creditsWarnedAt0 || bal <= 0) {
      candidates.push({
        kind: "low_credits",
        title: "Out of credits",
        body: "Credit-consuming jobs are paused until you buy more. Inbound still syncs.",
        ctaLabel: "Buy credits",
        ctaHref: "/settings?tab=billing",
        tone: "danger",
        meta: { balance: bal },
      });
    } else if (
      org.creditsWarnedAt5 ||
      (monthly > 0 && bal <= Math.ceil(monthly * 0.05))
    ) {
      candidates.push({
        kind: "low_credits",
        title: "Credits critically low",
        body: `About 5% of monthly credits left (${bal}). Top up soon.`,
        ctaLabel: "Buy credits",
        ctaHref: "/settings?tab=billing",
        tone: "warn",
        meta: { balance: bal },
      });
    } else if (
      org.creditsWarnedAt20 ||
      (monthly > 0 && bal <= Math.ceil(monthly * 0.2))
    ) {
      candidates.push({
        kind: "low_credits",
        title: "Credits running low",
        body: `At or below 20% of monthly allotment (${bal} left).`,
        ctaLabel: "Buy credits",
        ctaHref: "/settings?tab=billing",
        tone: "info",
        meta: { balance: bal },
      });
    }
  }

  if (
    sub?.providerEnvironment === "sandbox" &&
    status &&
    status !== SubscriptionStatus.NONE
  ) {
    candidates.push({
      kind: "test_mode",
      title: "Payments in test mode",
      body: "This subscription is on the sandbox/test provider environment. Charges are not live.",
      ctaLabel: "Open billing",
      ctaHref: "/settings?tab=billing",
      tone: "info",
    });
  }

  return pickHighestBanner(candidates);
}
