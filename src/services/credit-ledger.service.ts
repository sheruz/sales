import { appHome } from "@/lib/app-paths";
import { randomUUID } from "crypto";
import {
  CreditKeyMode,
  CreditLedgerType,
  NotificationType,
  type Prisma,
} from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { env } from "@/lib/config/env";
import { ForbiddenError, ValidationError } from "@/lib/api/response";
import type { CreditActionType } from "@/lib/billing/credit-actions";

type Tx = Prisma.TransactionClient;

type OrgLockRow = {
  id: string;
  credit_balance_cached: number;
  billing_enforcement_enabled: boolean;
  credits_warned_at_20: Date | null;
  credits_warned_at_5: Date | null;
  credits_warned_at_0: Date | null;
  plan_code: string | null;
  plan_name: string | null;
};

async function lockOrg(tx: Tx, organizationId: string): Promise<OrgLockRow> {
  const rows = await tx.$queryRaw<OrgLockRow[]>`
    SELECT o.id,
           o.credit_balance_cached,
           o.billing_enforcement_enabled,
           o.credits_warned_at_20,
           o.credits_warned_at_5,
           o.credits_warned_at_0,
           p.code AS plan_code,
           p.name AS plan_name
    FROM organizations o
    LEFT JOIN subscriptions s ON s.organization_id = o.id
    LEFT JOIN plans p ON p.id = s.plan_id
    WHERE o.id = ${organizationId}
    FOR UPDATE OF o
  `;
  if (!rows[0]) throw new ValidationError("Organization not found");
  return rows[0];
}

function isPlatformOwnerOrgId(organizationId: string): boolean {
  const id = env.PLATFORM_OWNER_ORG_ID;
  return Boolean(id && organizationId === id);
}

/**
 * S2.5: only PLATFORM_OWNER_ORG_ID is exempt from credit consume / enforcement.
 * OWNER plan is internal visibility only — not an exemption signal.
 */
function enforcementActive(row: OrgLockRow, organizationId: string): boolean {
  if (isPlatformOwnerOrgId(organizationId)) return false;
  if (env.BILLING_ENFORCEMENT_ENABLED !== true) return false;
  return row.billing_enforcement_enabled === true;
}

function periodStartUtc(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export class CreditLedgerService {
  async getPrice(
    actionType: string,
    keyMode: CreditKeyMode = CreditKeyMode.BYOK
  ): Promise<number> {
    const row = await prisma.creditPrice.findUnique({
      where: { actionType_keyMode: { actionType, keyMode } },
    });
    if (!row || !row.active) return 0;
    return row.credits;
  }

  async getBalance(organizationId: string): Promise<number> {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { creditBalanceCached: true },
    });
    return org?.creditBalanceCached ?? 0;
  }

  /** @deprecated Prefer billingGateway.isPlatformOwner — kept for API compat */
  async isOwnerOrg(organizationId: string): Promise<boolean> {
    return isPlatformOwnerOrgId(organizationId);
  }

  async isEnforcementOn(organizationId: string): Promise<boolean> {
    if (isPlatformOwnerOrgId(organizationId)) return false;
    if (env.BILLING_ENFORCEMENT_ENABLED !== true) return false;
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { billingEnforcementEnabled: true },
    });
    return org?.billingEnforcementEnabled === true;
  }

  /**
   * RESERVE: deduct -n immediately under org row lock.
   * OWNER: no ledger consume (stats-only elsewhere).
   * Enforced orgs: never go negative (throws ForbiddenError).
   */
  async reserve(input: {
    organizationId: string;
    actionType: CreditActionType | string;
    credits?: number;
    keyMode?: CreditKeyMode;
    idempotencyKey: string;
    referenceType?: string;
    referenceId?: string;
    actorUserId?: string;
    reason?: string;
  }): Promise<{
    reserved: boolean;
    credits: number;
    balanceAfter: number;
    skippedOwner: boolean;
    alreadyExists: boolean;
  }> {
    const price =
      input.credits ??
      (await this.getPrice(input.actionType, input.keyMode ?? CreditKeyMode.BYOK));

    if (price <= 0) {
      return {
        reserved: true,
        credits: 0,
        balanceAfter: await this.getBalance(input.organizationId),
        skippedOwner: false,
        alreadyExists: false,
      };
    }

    return prisma.$transaction(async (tx) => {
      const existing = await tx.creditLedgerEntry.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing) {
        return {
          reserved: true,
          credits: Math.abs(existing.amount),
          balanceAfter: existing.balanceAfter,
          skippedOwner: false,
          alreadyExists: true,
        };
      }

      const org = await lockOrg(tx, input.organizationId);
      if (isPlatformOwnerOrgId(input.organizationId)) {
        return {
          reserved: true,
          credits: 0,
          balanceAfter: org.credit_balance_cached,
          skippedOwner: true,
          alreadyExists: false,
        };
      }

      const enforce = enforcementActive(org, input.organizationId);
      if (
        enforce &&
        (org.credit_balance_cached < price || org.credit_balance_cached < 0)
      ) {
        throw new ForbiddenError(
          org.credit_balance_cached < 0
            ? "Credit balance is negative. Contact support for an adjustment before credit actions can run."
            : "Out of credits. Top up or upgrade — see Settings → Plan & Usage."
        );
      }

      // Non-enforced: still deduct for accurate ledger; may go negative (shadow).
      const balanceAfter = org.credit_balance_cached - price;

      await tx.organization.update({
        where: { id: input.organizationId },
        data: { creditBalanceCached: balanceAfter },
      });

      const ttlMin = env.CREDIT_RESERVE_TTL_MINUTES ?? 15;
      const expiresAt = new Date(Date.now() + ttlMin * 60 * 1000);

      await tx.creditLedgerEntry.create({
        data: {
          id: randomUUID(),
          organizationId: input.organizationId,
          type: CreditLedgerType.RESERVE,
          amount: -price,
          balanceAfter,
          actionType: input.actionType,
          referenceType: input.referenceType,
          referenceId: input.referenceId,
          idempotencyKey: input.idempotencyKey,
          reserveIdempotencyKey: input.idempotencyKey,
          actorUserId: input.actorUserId,
          reason: input.reason,
          metadata: {
            expiresAt: expiresAt.toISOString(),
            keyMode: input.keyMode ?? "BYOK",
          },
        },
      });

      await this.maybeClearWarningFlags(tx, input.organizationId, balanceAfter);

      return {
        reserved: true,
        credits: price,
        balanceAfter,
        skippedOwner: false,
        alreadyExists: false,
      };
    });
  }

  /** COMMIT: amount 0. Rejects if already refunded (expiry race). */
  async commit(input: {
    organizationId: string;
    reserveIdempotencyKey: string;
    actorUserId?: string;
  }): Promise<{ ok: boolean; alreadyCommitted: boolean }> {
    const commitKey = `${input.reserveIdempotencyKey}:commit`;
    const refundKey = `${input.reserveIdempotencyKey}:refund`;

    return prisma.$transaction(async (tx) => {
      const existingCommit = await tx.creditLedgerEntry.findUnique({
        where: { idempotencyKey: commitKey },
      });
      if (existingCommit) {
        return { ok: true, alreadyCommitted: true };
      }

      const refunded = await tx.creditLedgerEntry.findUnique({
        where: { idempotencyKey: refundKey },
      });
      if (refunded) {
        throw new ValidationError(
          "Reservation already refunded — re-reserve required"
        );
      }

      const reserve = await tx.creditLedgerEntry.findUnique({
        where: { idempotencyKey: input.reserveIdempotencyKey },
      });
      if (!reserve || reserve.type !== CreditLedgerType.RESERVE) {
        throw new ValidationError("Reservation not found");
      }
      if (reserve.organizationId !== input.organizationId) {
        throw new ValidationError("Reservation org mismatch");
      }

      // Lock org so commit cannot race with sweep refund on same reserve.
      const org = await lockOrg(tx, input.organizationId);

      // Re-check outcome inside lock
      const refunded2 = await tx.creditLedgerEntry.findUnique({
        where: { idempotencyKey: refundKey },
      });
      if (refunded2) {
        throw new ValidationError(
          "Reservation already refunded — re-reserve required"
        );
      }

      await tx.creditLedgerEntry.create({
        data: {
          id: randomUUID(),
          organizationId: input.organizationId,
          type: CreditLedgerType.COMMIT,
          amount: 0,
          balanceAfter: org.credit_balance_cached,
          actionType: reserve.actionType,
          referenceType: reserve.referenceType,
          referenceId: reserve.referenceId,
          idempotencyKey: commitKey,
          reserveIdempotencyKey: input.reserveIdempotencyKey,
          actorUserId: input.actorUserId,
          reason: "commit",
          metadata: { reservedAmount: reserve.amount },
        },
      });

      return { ok: true, alreadyCommitted: false };
    });
  }

  /** REFUND: +n for open reserve. Idempotent. Rejects if already committed. */
  async refund(input: {
    organizationId: string;
    reserveIdempotencyKey: string;
    actorUserId?: string;
    reason?: string;
  }): Promise<{ ok: boolean; alreadyRefunded: boolean; credits: number }> {
    const commitKey = `${input.reserveIdempotencyKey}:commit`;
    const refundKey = `${input.reserveIdempotencyKey}:refund`;

    return prisma.$transaction(async (tx) => {
      const existingRefund = await tx.creditLedgerEntry.findUnique({
        where: { idempotencyKey: refundKey },
      });
      if (existingRefund) {
        return {
          ok: true,
          alreadyRefunded: true,
          credits: existingRefund.amount,
        };
      }

      const committed = await tx.creditLedgerEntry.findUnique({
        where: { idempotencyKey: commitKey },
      });
      if (committed) {
        throw new ValidationError(
          "Reservation already committed — cannot refund"
        );
      }

      const reserve = await tx.creditLedgerEntry.findUnique({
        where: { idempotencyKey: input.reserveIdempotencyKey },
      });
      if (!reserve || reserve.type !== CreditLedgerType.RESERVE) {
        throw new ValidationError("Reservation not found");
      }
      if (reserve.organizationId !== input.organizationId) {
        throw new ValidationError("Reservation org mismatch");
      }

      const org = await lockOrg(tx, input.organizationId);

      // Re-check commit inside lock (expiry race rule)
      const committed2 = await tx.creditLedgerEntry.findUnique({
        where: { idempotencyKey: commitKey },
      });
      if (committed2) {
        throw new ValidationError(
          "Reservation already committed — cannot refund"
        );
      }

      const credits = Math.abs(reserve.amount);
      const balanceAfter = org.credit_balance_cached + credits;

      await tx.organization.update({
        where: { id: input.organizationId },
        data: { creditBalanceCached: balanceAfter },
      });

      await tx.creditLedgerEntry.create({
        data: {
          id: randomUUID(),
          organizationId: input.organizationId,
          type: CreditLedgerType.REFUND,
          amount: credits,
          balanceAfter,
          actionType: reserve.actionType,
          referenceType: reserve.referenceType,
          referenceId: reserve.referenceId,
          idempotencyKey: refundKey,
          reserveIdempotencyKey: input.reserveIdempotencyKey,
          actorUserId: input.actorUserId,
          reason: input.reason ?? "refund",
        },
      });

      await this.maybeClearWarningFlags(tx, input.organizationId, balanceAfter);

      return { ok: true, alreadyRefunded: false, credits };
    });
  }

  async grant(input: {
    organizationId: string;
    amount: number;
    type: "GRANT_PLAN" | "GRANT_MANUAL" | "PURCHASE" | "ADJUST";
    idempotencyKey: string;
    reason?: string;
    actorUserId?: string;
  }): Promise<{ balanceAfter: number; alreadyExists: boolean }> {
    if (input.amount === 0 && input.type !== "ADJUST") {
      return {
        balanceAfter: await this.getBalance(input.organizationId),
        alreadyExists: false,
      };
    }

    return prisma.$transaction(async (tx) => {
      const existing = await tx.creditLedgerEntry.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing) {
        return { balanceAfter: existing.balanceAfter, alreadyExists: true };
      }

      const org = await lockOrg(tx, input.organizationId);
      const balanceAfter = org.credit_balance_cached + input.amount;
      if (balanceAfter < 0 && enforcementActive(org, input.organizationId)) {
        throw new ForbiddenError("Adjust would make balance negative");
      }

      await tx.organization.update({
        where: { id: input.organizationId },
        data: { creditBalanceCached: balanceAfter },
      });

      await tx.creditLedgerEntry.create({
        data: {
          id: randomUUID(),
          organizationId: input.organizationId,
          type: input.type as CreditLedgerType,
          amount: input.amount,
          balanceAfter,
          idempotencyKey: input.idempotencyKey,
          actorUserId: input.actorUserId,
          reason: input.reason,
        },
      });

      await this.maybeClearWarningFlags(tx, input.organizationId, balanceAfter);

      return { balanceAfter, alreadyExists: false };
    });
  }

  /**
   * Monthly plan grant. Idempotency key = org + period start (UTC month).
   * Rollover: if plan.creditRolloverEnabled, unused credits stay (capped);
   * otherwise EXPIRE unused then GRANT_PLAN monthlyCredits.
   */
  async grantMonthlyForOrg(
    organizationId: string,
    at = new Date()
  ): Promise<{ granted: number; skipped: boolean; reason?: string }> {
    if (isPlatformOwnerOrgId(organizationId)) {
      return { granted: 0, skipped: true, reason: "platform_owner" };
    }

    const sub = await prisma.subscription.findUnique({
      where: { organizationId },
      include: {
        plan: {
          select: {
            monthlyCredits: true,
            creditRolloverEnabled: true,
            creditRolloverCap: true,
          },
        },
        planVersion: {
          select: {
            monthlyCredits: true,
            creditRolloverEnabled: true,
            creditRolloverCapMonths: true,
          },
        },
      },
    });
    const monthly =
      sub?.planVersion?.monthlyCredits ?? sub?.plan.monthlyCredits ?? null;
    if (monthly == null || monthly <= 0) {
      return { granted: 0, skipped: true, reason: "no_monthly_credits" };
    }

    const start = periodStartUtc(at);
    const idempotencyKey = `grant_plan:${organizationId}:${start.toISOString().slice(0, 10)}`;

    const existing = await prisma.creditLedgerEntry.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      return { granted: 0, skipped: true, reason: "already_granted" };
    }

    const balance = await this.getBalance(organizationId);
    const rollover =
      sub!.planVersion?.creditRolloverEnabled ??
      sub!.plan.creditRolloverEnabled === true;
    const rolloverCap =
      sub!.planVersion?.creditRolloverCapMonths != null
        ? monthly * sub!.planVersion.creditRolloverCapMonths
        : sub!.plan.creditRolloverCap;
    if (!rollover && balance > 0) {
      await this.grant({
        organizationId,
        amount: -balance,
        type: "ADJUST",
        idempotencyKey: `expire_unused:${organizationId}:${start.toISOString().slice(0, 10)}`,
        reason: "monthly_expire_unused",
      });
    } else if (rollover && rolloverCap != null) {
      const cap = rolloverCap;
      if (balance > cap) {
        await this.grant({
          organizationId,
          amount: -(balance - cap),
          type: "ADJUST",
          idempotencyKey: `rollover_cap:${organizationId}:${start.toISOString().slice(0, 10)}`,
          reason: "rollover_cap",
        });
      }
    }

    const result = await this.grant({
      organizationId,
      amount: monthly,
      type: "GRANT_PLAN",
      idempotencyKey,
      reason: `monthly_grant_${start.toISOString().slice(0, 10)}`,
    });

    return {
      granted: result.alreadyExists ? 0 : monthly,
      skipped: result.alreadyExists,
      reason: result.alreadyExists ? "already_granted" : undefined,
    };
  }

  /**
   * B1/B3: after Super Admin assign or upgrade — grant full monthly on first
   * package, or the positive difference when moving to a higher package.
   */
  async grantOnPlanChange(input: {
    organizationId: string;
    fromPlanVersionId: string | null;
    toPlanVersionId: string;
    actorUserId?: string;
  }): Promise<{ granted: number; reason: string }> {
    if (isPlatformOwnerOrgId(input.organizationId)) {
      return { granted: 0, reason: "platform_owner" };
    }

    const toVer = await prisma.planVersion.findUnique({
      where: { id: input.toPlanVersionId },
      select: { monthlyCredits: true, planId: true },
    });
    const newMonthly = toVer?.monthlyCredits ?? 0;
    if (newMonthly <= 0) {
      return { granted: 0, reason: "no_monthly_credits" };
    }

    let oldMonthly = 0;
    if (input.fromPlanVersionId) {
      const fromVer = await prisma.planVersion.findUnique({
        where: { id: input.fromPlanVersionId },
        select: { monthlyCredits: true },
      });
      oldMonthly = fromVer?.monthlyCredits ?? 0;
    }

    const period = periodStartUtc().toISOString().slice(0, 10);
    const balance = await this.getBalance(input.organizationId);

    // First activation (NONE → plan) or zero balance with no prior version credits
    if (!input.fromPlanVersionId || oldMonthly <= 0) {
      if (balance >= newMonthly) {
        return { granted: 0, reason: "already_funded" };
      }
      const need = newMonthly - Math.max(0, balance);
      const idempotencyKey = `plan_activate:${input.organizationId}:${input.toPlanVersionId}:${period}`;
      const result = await this.grant({
        organizationId: input.organizationId,
        amount: need,
        type: "GRANT_PLAN",
        idempotencyKey,
        reason: `plan_activate_${period}`,
        actorUserId: input.actorUserId,
      });
      return {
        granted: result.alreadyExists ? 0 : need,
        reason: result.alreadyExists ? "already_granted" : "activated",
      };
    }

    // Upgrade: grant difference only (spec §7)
    const diff = newMonthly - oldMonthly;
    if (diff <= 0) {
      return { granted: 0, reason: "downgrade_or_same_no_grant" };
    }
    const idempotencyKey = `plan_upgrade:${input.organizationId}:${input.fromPlanVersionId}:${input.toPlanVersionId}:${period}`;
    const result = await this.grant({
      organizationId: input.organizationId,
      amount: diff,
      type: "GRANT_PLAN",
      idempotencyKey,
      reason: `plan_upgrade_diff_${oldMonthly}_to_${newMonthly}`,
      actorUserId: input.actorUserId,
    });
    return {
      granted: result.alreadyExists ? 0 : diff,
      reason: result.alreadyExists ? "already_granted" : "upgrade_diff",
    };
  }

  async runMonthlyGrants(): Promise<{ orgs: number; granted: number }> {
    const orgs = await prisma.organization.findMany({
      where: { deletedAt: null },
      select: { id: true },
    });
    let granted = 0;
    for (const o of orgs) {
      const r = await this.grantMonthlyForOrg(o.id);
      if (!r.skipped && r.granted > 0) granted++;
    }
    return { orgs: orgs.length, granted };
  }

  /** Sweep expired open RESERVEs → REFUND under lock. */
  async sweepExpiredReserves(limit = 100): Promise<number> {
    const ttlMin = env.CREDIT_RESERVE_TTL_MINUTES ?? 15;
    const cutoff = new Date(Date.now() - ttlMin * 60 * 1000);

    const candidates = await prisma.creditLedgerEntry.findMany({
      where: {
        type: CreditLedgerType.RESERVE,
        createdAt: { lt: cutoff },
      },
      take: limit * 3,
      orderBy: { createdAt: "asc" },
    });

    let refunded = 0;
    for (const r of candidates) {
      if (refunded >= limit) break;
      const commitKey = `${r.idempotencyKey}:commit`;
      const refundKey = `${r.idempotencyKey}:refund`;
      const [c, f] = await Promise.all([
        prisma.creditLedgerEntry.findUnique({
          where: { idempotencyKey: commitKey },
        }),
        prisma.creditLedgerEntry.findUnique({
          where: { idempotencyKey: refundKey },
        }),
      ]);
      if (c || f) continue;
      try {
        await this.refund({
          organizationId: r.organizationId,
          reserveIdempotencyKey: r.idempotencyKey,
          reason: "reserve_ttl_expired",
        });
        refunded++;
      } catch {
        // raced with commit — leave it
      }
    }
    return refunded;
  }

  /**
   * Reconcile: sum(signed amounts) == cache.
   * COMMIT=0; RESERVE=-n; REFUND=+n → after commit net -n (consumed); after refund net 0.
   */
  async reconcile(organizationId?: string): Promise<{
    checked: number;
    mismatches: Array<{
      organizationId: string;
      cached: number;
      ledger: number;
    }>;
  }> {
    const orgs = await prisma.organization.findMany({
      where: organizationId ? { id: organizationId } : { deletedAt: null },
      select: { id: true, creditBalanceCached: true },
    });
    const mismatches: Array<{
      organizationId: string;
      cached: number;
      ledger: number;
    }> = [];

    for (const org of orgs) {
      const sum = await prisma.creditLedgerEntry.aggregate({
        where: { organizationId: org.id },
        _sum: { amount: true },
      });
      const ledger = sum._sum.amount ?? 0;
      if (ledger !== org.creditBalanceCached) {
        mismatches.push({
          organizationId: org.id,
          cached: org.creditBalanceCached,
          ledger,
        });
      }
    }
    return { checked: orgs.length, mismatches };
  }

  async listLedger(
    organizationId: string,
    opts?: { cursor?: string; take?: number }
  ) {
    const take = Math.min(opts?.take ?? 50, 100);
    return prisma.creditLedgerEntry.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: take + 1,
      ...(opts?.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    });
  }

  async consumedThisMonthByAction(organizationId: string) {
    const start = periodStartUtc();
    const reserves = await prisma.creditLedgerEntry.findMany({
      where: {
        organizationId,
        createdAt: { gte: start },
        type: CreditLedgerType.RESERVE,
      },
      select: { actionType: true, amount: true, idempotencyKey: true },
    });

    const map = new Map<string, number>();
    for (const r of reserves) {
      const refunded = await prisma.creditLedgerEntry.findUnique({
        where: { idempotencyKey: `${r.idempotencyKey}:refund` },
      });
      if (refunded) continue;
      const key = r.actionType ?? "unknown";
      map.set(key, (map.get(key) ?? 0) + Math.abs(r.amount));
    }
    return Array.from(map.entries()).map(([actionType, credits]) => ({
      actionType,
      credits,
    }));
  }

  private async maybeClearWarningFlags(
    tx: Tx,
    organizationId: string,
    balance: number
  ) {
    const sub = await tx.subscription.findUnique({
      where: { organizationId },
      include: { plan: { select: { monthlyCredits: true } } },
    });
    const monthly = sub?.plan.monthlyCredits ?? 50;
    const t20 = Math.ceil(monthly * 0.2);
    const t5 = Math.ceil(monthly * 0.05);

    const data: Prisma.OrganizationUpdateInput = {};
    if (balance > t20) data.creditsWarnedAt20 = null;
    if (balance > t5) data.creditsWarnedAt5 = null;
    if (balance > 0) data.creditsWarnedAt0 = null;

    if (Object.keys(data).length > 0) {
      await tx.organization.update({ where: { id: organizationId }, data });
    }
  }

  async checkAndEmitWarnings(organizationId: string): Promise<void> {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        creditBalanceCached: true,
        creditsWarnedAt20: true,
        creditsWarnedAt5: true,
        creditsWarnedAt0: true,
        billingEnforcementEnabled: true,
      },
    });
    if (!org || !org.billingEnforcementEnabled) return;
    if (await this.isOwnerOrg(organizationId)) return;

    const sub = await prisma.subscription.findUnique({
      where: { organizationId },
      include: { plan: { select: { monthlyCredits: true } } },
    });
    const monthly = sub?.plan.monthlyCredits ?? 50;
    const bal = org.creditBalanceCached;
    const t20 = Math.ceil(monthly * 0.2);
    const t5 = Math.ceil(monthly * 0.05);

    const updates: Prisma.OrganizationUpdateInput = {};
    if (bal <= 0 && !org.creditsWarnedAt0) {
      updates.creditsWarnedAt0 = new Date();
      await this.notifyCreditWarning(organizationId, "zero");
    } else if (bal > 0 && bal <= t5 && !org.creditsWarnedAt5) {
      updates.creditsWarnedAt5 = new Date();
      await this.notifyCreditWarning(organizationId, "5");
    } else if (bal > t5 && bal <= t20 && !org.creditsWarnedAt20) {
      updates.creditsWarnedAt20 = new Date();
      await this.notifyCreditWarning(organizationId, "20");
    }
    if (Object.keys(updates).length) {
      await prisma.organization.update({
        where: { id: organizationId },
        data: updates,
      });
    }
  }

  private async notifyCreditWarning(
    organizationId: string,
    level: "20" | "5" | "zero"
  ) {
    try {
      const { notificationService } = await import(
        "@/services/notification.service"
      );
      const owner = await notificationService.resolveOwner(organizationId);
      if (!owner) return;
      const title =
        level === "zero"
          ? "Out of credits — Autopilot paused"
          : `Credits low (${level}%)`;
      const body =
        level === "zero"
          ? "Credit-consuming jobs are paused until you add credits. Inbound replies are still processed and held for you."
          : `Your credit balance is at or below ${level}% of the monthly allotment. See Settings → Plan & Usage.`;
      await notificationService.notify({
        organizationId,
        userId: owner.userId,
        toEmail: owner.email,
        type: NotificationType.AI_HELD,
        title,
        body,
        href: appHome("/settings?tab=billing"),
        sendEmail: false,
      });
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { creditBalanceCached: true },
      });
      const { lifecycleEmailService } = await import(
        "@/services/billing/lifecycle-email.service"
      );
      await lifecycleEmailService.sendLowCredits(
        organizationId,
        level === "zero" ? "0" : level,
        org?.creditBalanceCached ?? 0
      );
    } catch (err) {
      console.warn(
        "[credits] warning notify failed",
        err instanceof Error ? err.message : err
      );
    }
  }
}

export const creditLedgerService = new CreditLedgerService();
