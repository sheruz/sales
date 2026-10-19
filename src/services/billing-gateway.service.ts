/**
 * S2.5 unified billing gateway.
 * authorize → work → commit/refund. All plan + credit checks before third-party calls.
 */
import { randomUUID } from "crypto";
import {
  BillingAuthStatus,
  CreditKeyMode,
  SubscriptionStatus,
  type Prisma,
  type UsageMetric,
} from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { env } from "@/lib/config/env";
import { ForbiddenError, ValidationError } from "@/lib/api/response";
import {
  getActionDef,
  INBOUND_EXEMPT_PURPOSES,
  type ActionDef,
  type BillingAction,
} from "@/lib/billing/actions";
import { BILLING_REASONS, type BillingReason } from "@/lib/billing/reasons";
import { FEATURE_KEYS } from "@/lib/billing/features";
import { creditLedgerService } from "@/services/credit-ledger.service";
import { entitlementService } from "@/services/entitlement.service";
import {
  isBillingEnforcementEnvExplicit,
  isGlobalBillingEnforcementOn,
} from "@/lib/billing/enforcement-flags";

type Tx = Prisma.TransactionClient;

function periodStartUtc(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function dayStartUtc(d = new Date()): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  );
}

function nextDayUtc(d = new Date()): Date {
  const day = dayStartUtc(d);
  return new Date(day.getTime() + 24 * 60 * 60 * 1000);
}

export type AuthorizeInput = {
  organizationId: string;
  action: BillingAction | string;
  qty?: number;
  referenceType?: string;
  referenceId?: string;
  idempotencyKey?: string;
  actorUserId?: string;
  purpose?: string;
  keyMode?: CreditKeyMode;
  /** Force exempt (inbound paths) */
  exempt?: boolean;
};

export type AuthorizeResult =
  | {
      allowed: true;
      reservationId: string;
      credits: number;
      skippedOwner: boolean;
      alreadyExists: boolean;
      reason?: undefined;
    }
  | {
      allowed: false;
      reservationId?: undefined;
      reason: BillingReason;
      message: string;
      limit?: number | null;
      used?: number;
    };

export type CreditRunResult<T> =
  | { ok: true; result: T; credits: number; skippedOwner: boolean; reservationId: string }
  | {
      ok: false;
      paused: true;
      reason: BillingReason | "out_of_credits";
      message: string;
    };

function isPlatformOwnerOrg(organizationId: string): boolean {
  const id = env.PLATFORM_OWNER_ORG_ID;
  return Boolean(id && organizationId === id);
}

function isMissingRelationError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    /does not exist/i.test(msg) ||
    /BillingAuthorization/i.test(msg) ||
    /org_entitlement_overrides/i.test(msg) ||
    /billing_authorizations/i.test(msg) ||
    /Unknown arg/i.test(msg)
  );
}

let schemaReadyCache: boolean | null = null;

async function isBillingSchemaReady(): Promise<boolean> {
  if (schemaReadyCache != null) return schemaReadyCache;
  try {
    await prisma.billingAuthorization.findFirst({ take: 1 });
    schemaReadyCache = true;
  } catch (err) {
    if (isMissingRelationError(err)) {
      schemaReadyCache = false;
      console.warn(
        "[billing] S2.5 tables missing — gateway in degraded mode until s25-apply"
      );
    } else {
      throw err;
    }
  }
  return schemaReadyCache;
}

async function lockOrgRow(tx: Tx, organizationId: string) {
  const rows = await tx.$queryRaw<
    Array<{
      id: string;
      credit_balance_cached: number;
      billing_enforcement_enabled: boolean;
    }>
  >`
    SELECT id, credit_balance_cached, billing_enforcement_enabled
    FROM organizations
    WHERE id = ${organizationId}
    FOR UPDATE
  `;
  if (!rows[0]) throw new ValidationError("Organization not found");
  return rows[0];
}

export class BillingGatewayService {
  isPlatformOwner(organizationId: string): boolean {
    return isPlatformOwnerOrg(organizationId);
  }

  /** Enforcement active for this org (global kill switch AND per-org AND not platform owner). */
  async isEnforcementActive(organizationId: string): Promise<boolean> {
    if (!isGlobalBillingEnforcementOn()) return false;
    if (isPlatformOwnerOrg(organizationId)) return false;
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { billingEnforcementEnabled: true },
    });
    return org?.billingEnforcementEnabled === true;
  }

  /**
   * effective = pinned PlanVersion features + OrgEntitlementOverride (override wins).
   * Legacy PlanFeature used only when planVersionId is null (transition).
   */
  async getEffectiveFeature(
    organizationId: string,
    featureKey: string
  ): Promise<{ enabled: boolean; limitValue: number | null; planName: string }> {
    const sub = await entitlementService.getSubscriptionOrNone(organizationId);
    if (!sub) {
      return { enabled: false, limitValue: 0, planName: "None" };
    }

    let enabled = false;
    let limitValue: number | null = null;
    let found = false;

    if (sub.planVersionId) {
      const vf = await prisma.planVersionFeature.findUnique({
        where: {
          planVersionId_featureKey: {
            planVersionId: sub.planVersionId,
            featureKey,
          },
        },
      });
      if (vf) {
        enabled = vf.enabled;
        limitValue = vf.limitValue;
        found = true;
      }
    } else {
      // LEGACY FALLBACK — remove after B1 verify (see docs/b1-legacy-planfeature.md)
      const planFeat = sub.plan.features.find((f) => f.featureKey === featureKey);
      if (planFeat) {
        enabled = planFeat.enabled;
        limitValue = planFeat.limitValue;
        found = true;
      }
    }

    if (await isBillingSchemaReady()) {
      try {
        const override = await prisma.orgEntitlementOverride.findUnique({
          where: {
            organizationId_key: { organizationId, key: featureKey },
          },
        });
        if (override) {
          if (override.enabled != null) enabled = override.enabled;
          if (override.limitValue !== undefined) {
            limitValue = override.limitValue;
          }
          found = true;
        }
      } catch (err) {
        if (!isMissingRelationError(err)) throw err;
      }
    }

    // Unknown key on versioned plan → disabled (no silent unlimited)
    if (!found && sub.planVersionId) {
      enabled = false;
      limitValue = 0;
    } else if (!found) {
      // Pre-B1 legacy: unseeded keys stay open
      enabled = true;
      limitValue = null;
    }

    return { enabled, limitValue, planName: sub.plan.name };
  }

  /**
   * Daily email cap: min(settings.dailyEmailLimit, plan emails_daily, override if set).
   * Tenant settings can only lower; plan/override define the ceiling.
   */
  async getEffectiveDailyEmailLimit(organizationId: string): Promise<number> {
    const { limitValue: planCap } = await this.getEffectiveFeature(
      organizationId,
      FEATURE_KEYS.EMAILS_DAILY
    );
    const settings = await prisma.organizationSettings.findUnique({
      where: { organizationId },
      select: { dailyEmailLimit: true },
    });
    const tenantWant = settings?.dailyEmailLimit ?? 50;
    const ceiling = planCap == null ? tenantWant : planCap;
    return Math.max(0, Math.min(tenantWant, ceiling));
  }

  async authorize(input: AuthorizeInput): Promise<AuthorizeResult> {
    const def = getActionDef(input.action);
    if (!def) {
      throw new ValidationError(`Unknown billing action: ${input.action}`);
    }

    const qty = Math.max(1, input.qty ?? 1);
    const purpose = input.purpose ?? "";
    const exempt =
      Boolean(input.exempt) ||
      def.alwaysExempt ||
      INBOUND_EXEMPT_PURPOSES.has(purpose) ||
      isPlatformOwnerOrg(input.organizationId);

    const idempotencyKey =
      input.idempotencyKey ??
      `${input.action}:${input.referenceType ?? "x"}:${input.referenceId ?? randomUUID()}:${randomUUID()}`;

    const schemaReady = await isBillingSchemaReady();
    if (schemaReady) {
      try {
        const existing = await prisma.billingAuthorization.findUnique({
          where: { idempotencyKey },
        });
        if (existing) {
          if (
            existing.status === BillingAuthStatus.AUTHORIZED ||
            existing.status === BillingAuthStatus.COMMITTED
          ) {
            return {
              allowed: true,
              reservationId: existing.id,
              credits: existing.credits,
              skippedOwner: isPlatformOwnerOrg(input.organizationId),
              alreadyExists: true,
            };
          }
        }
      } catch (err) {
        if (!isMissingRelationError(err)) throw err;
      }
    }

    const sub = await entitlementService.getSubscriptionOrNone(
      input.organizationId
    );
    const enforce = await this.isEnforcementActive(input.organizationId);
    const lifecycleOn = env.TENANT_LIFECYCLE_ENFORCED === true;
    const monthStart = periodStartUtc();
    const dayStart = dayStartUtc();

    // B1 lifecycle lock — independent of credit kill switch (not for inbound exempt / owner)
    if (!exempt && lifecycleOn && sub) {
      const st = sub.status;
      if (
        st === SubscriptionStatus.NONE ||
        st === SubscriptionStatus.EXPIRED
      ) {
        await this.recordUsageEvent(input, def.featureKey, qty, {
          status: "denied",
          reason: BILLING_REASONS.NO_ACTIVE_SUBSCRIPTION,
        });
        return {
          allowed: false,
          reason: BILLING_REASONS.NO_ACTIVE_SUBSCRIPTION,
          message:
            "No active subscription. Choose a plan to activate your workspace.",
        };
      }
      if (
        st === SubscriptionStatus.SUSPENDED ||
        (st === SubscriptionStatus.CANCELED &&
          sub.currentPeriodEnd &&
          sub.currentPeriodEnd < new Date())
      ) {
        await this.recordUsageEvent(input, def.featureKey, qty, {
          status: "denied",
          reason: BILLING_REASONS.READ_ONLY,
        });
        return {
          allowed: false,
          reason: BILLING_REASONS.READ_ONLY,
          message:
            st === SubscriptionStatus.SUSPENDED
              ? "Account suspended. Update payment to continue."
              : "Subscription canceled. Workspace is read-only.",
        };
      }
    }

    // Subscription status (credit enforcement path — skip for platform owner / inbound exempt)
    if (
      !exempt &&
      sub &&
      (sub.status === SubscriptionStatus.CANCELED ||
        sub.status === SubscriptionStatus.UNPAID ||
        sub.status === SubscriptionStatus.INCOMPLETE_EXPIRED ||
        sub.status === SubscriptionStatus.SUSPENDED ||
        sub.status === SubscriptionStatus.INCOMPLETE)
    ) {
      const message =
        "Subscription is inactive. Please update billing to continue.";
      if (enforce) {
        await this.recordUsageEvent(input, def.featureKey, qty, {
          status: "denied",
          reason: BILLING_REASONS.SUBSCRIPTION_INACTIVE,
        });
        return {
          allowed: false,
          reason: BILLING_REASONS.SUBSCRIPTION_INACTIVE,
          message,
        };
      }
    }

    if (!exempt && lifecycleOn && !sub) {
      return {
        allowed: false,
        reason: BILLING_REASONS.NO_ACTIVE_SUBSCRIPTION,
        message:
          "No active subscription. Choose a plan to activate your workspace.",
      };
    }

    const effective = await this.getEffectiveFeature(
      input.organizationId,
      def.featureKey
    );

    if (!exempt && !effective.enabled) {
      const message = `Feature "${def.featureKey}" is not included in the ${effective.planName} plan.`;
      if (enforce) {
        await this.recordUsageEvent(input, def.featureKey, qty, {
          status: "denied",
          reason: BILLING_REASONS.PLAN_FEATURE_DISABLED,
        });
        return {
          allowed: false,
          reason: BILLING_REASONS.PLAN_FEATURE_DISABLED,
          message,
        };
      }
    }

    // Pre-apply degraded path: credit reserve only (no BillingAuthorization table).
    if (!schemaReady) {
      return this.authorizeDegraded(input, def, qty, purpose, exempt, idempotencyKey);
    }

    return prisma.$transaction(async (tx) => {
      const org = await lockOrgRow(tx, input.organizationId);

      // Feature / daily limits with in-flight authorizations
      if (!exempt && def.period === "seat") {
        const used = await entitlementService.getSeatCount(
          input.organizationId,
          def.featureKey as Parameters<
            typeof entitlementService.getSeatCount
          >[1]
        );
        const limit = effective.limitValue;
        if (limit != null && used + qty > limit && enforce) {
          await this.recordUsageEvent(input, def.featureKey, qty, {
            status: "denied",
            reason: BILLING_REASONS.PLAN_LIMIT_REACHED,
          });
          return {
            allowed: false as const,
            reason: BILLING_REASONS.PLAN_LIMIT_REACHED,
            message: `Plan limit reached for ${def.featureKey} (${used}/${limit}).`,
            limit,
            used,
          };
        }
      }

      if (!exempt && def.period === "monthly" && def.metric && effective.limitValue != null) {
        const committed = await this.committedUsage(
          tx,
          input.organizationId,
          def.metric,
          monthStart
        );
        const inFlight = await this.inFlightUsage(
          tx,
          input.organizationId,
          def.featureKey,
          "monthly",
          monthStart
        );
        const used = committed + inFlight;
        if (used + qty > effective.limitValue && enforce) {
          const reason =
            def.dailyEmail || def.featureKey === FEATURE_KEYS.EMAILS
              ? BILLING_REASONS.MONTHLY_EMAIL_LIMIT
              : BILLING_REASONS.PLAN_LIMIT_REACHED;
          await this.recordUsageEvent(input, def.featureKey, qty, {
            status: "denied",
            reason,
          });
          return {
            allowed: false as const,
            reason,
            message: `Monthly limit reached for ${def.featureKey} (${used}/${effective.limitValue}).`,
            limit: effective.limitValue,
            used,
          };
        }
      }

      if (!exempt && def.dailyEmail) {
        const dailyCap = await this.getEffectiveDailyEmailLimit(
          input.organizationId
        );
        const committedDaily = await this.committedUsage(
          tx,
          input.organizationId,
          "EMAILS_DAILY",
          dayStart
        );
        const inFlightDaily = await this.inFlightUsage(
          tx,
          input.organizationId,
          FEATURE_KEYS.EMAILS,
          "daily",
          dayStart
        );
        const usedDaily = committedDaily + inFlightDaily;
        if (usedDaily + qty > dailyCap && enforce) {
          await this.recordUsageEvent(input, def.featureKey, qty, {
            status: "denied",
            reason: BILLING_REASONS.DAILY_EMAIL_LIMIT,
          });
          return {
            allowed: false as const,
            reason: BILLING_REASONS.DAILY_EMAIL_LIMIT,
            message: `Daily email limit reached (${usedDaily}/${dailyCap}).`,
            limit: dailyCap,
            used: usedDaily,
          };
        }
      }

      // Credits: check balance under lock; RESERVE after tx (avoids nested transactions).
      let credits = 0;
      const skippedOwner = isPlatformOwnerOrg(input.organizationId);
      if (def.creditActionType && !skippedOwner) {
        credits = await creditLedgerService.getPrice(
          def.creditActionType,
          input.keyMode ?? CreditKeyMode.BYOK
        );
      }
      if (credits > 0 && !skippedOwner && enforce) {
        if (org.credit_balance_cached < 0) {
          return {
            allowed: false as const,
            reason: BILLING_REASONS.OUT_OF_CREDITS,
            message:
              "Credit balance is negative. Contact support for an adjustment before credit actions can run.",
          };
        }
        if (org.credit_balance_cached < credits) {
          return {
            allowed: false as const,
            reason: BILLING_REASONS.OUT_OF_CREDITS,
            message:
              "Out of credits. Top up or upgrade — see Settings → Plan & Usage.",
          };
        }
      }

      const ttlMin = env.CREDIT_RESERVE_TTL_MINUTES ?? 15;
      const authId = randomUUID();
      const reserveKey =
        credits > 0 && !skippedOwner ? `gw:${idempotencyKey}` : null;
      await tx.billingAuthorization.create({
        data: {
          id: authId,
          organizationId: input.organizationId,
          actionType: def.action,
          featureKey: def.featureKey,
          metric: def.metric,
          quantity: qty,
          credits: skippedOwner ? 0 : credits,
          status: BillingAuthStatus.AUTHORIZED,
          reservationIdempotencyKey: reserveKey,
          idempotencyKey,
          referenceType: input.referenceType,
          referenceId: input.referenceId,
          periodStart: monthStart,
          dayStart: def.dailyEmail ? dayStart : null,
          actorUserId: input.actorUserId,
          purpose: purpose || null,
          expiresAt: new Date(Date.now() + ttlMin * 60 * 1000),
          metadata: {
            enforce,
            exempt,
            shadow: !enforce,
            pendingCreditReserve: Boolean(reserveKey),
          },
        },
      });

      return {
        allowed: true as const,
        reservationId: authId,
        credits: skippedOwner ? 0 : credits,
        skippedOwner,
        alreadyExists: false,
        _reserveKey: reserveKey,
        _creditActionType: def.creditActionType,
      };
    }).then(async (result) => {
      if (!result.allowed) {
        await this.recordUsageEvent(input, def.featureKey, qty, {
          status: "denied",
          reason: result.reason,
        });
        return result;
      }

      const reserveKey = (result as { _reserveKey?: string | null })
        ._reserveKey;
      const creditActionType = (result as { _creditActionType?: string | null })
        ._creditActionType;

      if (reserveKey && creditActionType && result.credits > 0) {
        try {
          await creditLedgerService.reserve({
            organizationId: input.organizationId,
            actionType: creditActionType,
            idempotencyKey: reserveKey,
            referenceType: input.referenceType,
            referenceId: input.referenceId,
            actorUserId: input.actorUserId,
            keyMode: input.keyMode,
            credits: result.credits,
          });
        } catch (err) {
          await prisma.billingAuthorization.update({
            where: { id: result.reservationId },
            data: { status: BillingAuthStatus.REFUNDED },
          });
          if (err instanceof ForbiddenError) {
            return {
              allowed: false as const,
              reason: BILLING_REASONS.OUT_OF_CREDITS,
              message: err.message,
            };
          }
          throw err;
        }
      }

      await this.recordUsageEvent(input, def.featureKey, qty, {
        status: "authorized",
        reservationId: result.reservationId,
        exempt,
      });

      return {
        allowed: true as const,
        reservationId: result.reservationId,
        credits: result.credits,
        skippedOwner: result.skippedOwner,
        alreadyExists: result.alreadyExists,
      };
    });
  }

  /** Pre-s25-apply: credits only, reservationId is ledger reserve key. */
  private async authorizeDegraded(
    input: AuthorizeInput,
    def: ActionDef,
    qty: number,
    purpose: string,
    exempt: boolean,
    idempotencyKey: string
  ): Promise<AuthorizeResult> {
    const skippedOwner = isPlatformOwnerOrg(input.organizationId);
    let credits = 0;
    if (def.creditActionType && !skippedOwner) {
      credits = await creditLedgerService.getPrice(
        def.creditActionType,
        input.keyMode ?? CreditKeyMode.BYOK
      );
    }
    const reserveKey = `gw:deg:${idempotencyKey}`;
    if (credits > 0 && !skippedOwner) {
      try {
        await creditLedgerService.reserve({
          organizationId: input.organizationId,
          actionType: def.creditActionType!,
          idempotencyKey: reserveKey,
          referenceType: input.referenceType,
          referenceId: input.referenceId,
          actorUserId: input.actorUserId,
          keyMode: input.keyMode,
          credits,
        });
      } catch (err) {
        if (err instanceof ForbiddenError) {
          return {
            allowed: false,
            reason: BILLING_REASONS.OUT_OF_CREDITS,
            message: err.message,
          };
        }
        throw err;
      }
    }
    await this.recordUsageEvent(input, def.featureKey, qty, {
      status: "authorized",
      reservationId: reserveKey,
      exempt,
      degraded: true,
      purpose,
    });
    return {
      allowed: true,
      reservationId: reserveKey,
      credits: skippedOwner ? 0 : credits,
      skippedOwner,
      alreadyExists: false,
    };
  }

  async commit(input: {
    organizationId: string;
    reservationId: string;
    actorUserId?: string;
  }): Promise<{ ok: boolean; alreadyCommitted: boolean }> {
    // Degraded mode reservationId === ledger reserve key
    if (input.reservationId.startsWith("gw:deg:")) {
      try {
        await creditLedgerService.commit({
          organizationId: input.organizationId,
          reserveIdempotencyKey: input.reservationId,
          actorUserId: input.actorUserId,
        });
      } catch (err) {
        if (
          err instanceof ValidationError &&
          /Reservation not found/i.test(err.message)
        ) {
          // zero-credit degraded auth — nothing to commit
          return { ok: true, alreadyCommitted: false };
        }
        throw err;
      }
      return { ok: true, alreadyCommitted: false };
    }

    if (!(await isBillingSchemaReady())) {
      return { ok: true, alreadyCommitted: false };
    }

    let auth;
    try {
      auth = await prisma.billingAuthorization.findFirst({
        where: {
          id: input.reservationId,
          organizationId: input.organizationId,
        },
      });
    } catch (err) {
      if (isMissingRelationError(err)) {
        return { ok: true, alreadyCommitted: false };
      }
      throw err;
    }
    if (!auth) throw new ValidationError("Reservation not found");
    if (auth.status === BillingAuthStatus.COMMITTED) {
      return { ok: true, alreadyCommitted: true };
    }
    if (auth.status === BillingAuthStatus.REFUNDED) {
      throw new ValidationError(
        "Reservation already refunded — re-reserve required"
      );
    }

    const def = getActionDef(auth.actionType);

    if (auth.reservationIdempotencyKey && auth.credits > 0) {
      await creditLedgerService.commit({
        organizationId: input.organizationId,
        reserveIdempotencyKey: auth.reservationIdempotencyKey,
        actorUserId: input.actorUserId,
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.billingAuthorization.update({
        where: { id: auth.id },
        data: { status: BillingAuthStatus.COMMITTED },
      });

      if (def?.metric) {
        await this.incrementUsageRecord(
          tx,
          input.organizationId,
          def.metric,
          auth.periodStart,
          auth.quantity
        );
      }
      if (def?.dailyEmail) {
        const day = auth.dayStart ?? dayStartUtc();
        await this.incrementUsageRecord(
          tx,
          input.organizationId,
          "EMAILS_DAILY",
          day,
          auth.quantity
        );
      }
    });

    await prisma.usageEvent.create({
      data: {
        id: randomUUID(),
        organizationId: input.organizationId,
        metric: auth.featureKey,
        quantity: auth.quantity,
        periodStart: auth.periodStart,
        referenceType: auth.referenceType,
        referenceId: auth.referenceId,
        idempotencyKey: `${auth.idempotencyKey}:commit`,
        metadata: {
          status: "committed",
          reservationId: auth.id,
          action: auth.actionType,
        },
      },
    }).catch(() => undefined);

    void creditLedgerService.checkAndEmitWarnings(input.organizationId);
    return { ok: true, alreadyCommitted: false };
  }

  async refund(input: {
    organizationId: string;
    reservationId: string;
    actorUserId?: string;
    reason?: string;
  }): Promise<{ ok: boolean; alreadyRefunded: boolean }> {
    if (input.reservationId.startsWith("gw:deg:")) {
      try {
        await creditLedgerService.refund({
          organizationId: input.organizationId,
          reserveIdempotencyKey: input.reservationId,
          actorUserId: input.actorUserId,
          reason: input.reason ?? "action_failed",
        });
      } catch {
        // zero-credit or already refunded
      }
      return { ok: true, alreadyRefunded: false };
    }

    if (!(await isBillingSchemaReady())) {
      return { ok: true, alreadyRefunded: false };
    }

    let auth;
    try {
      auth = await prisma.billingAuthorization.findFirst({
        where: {
          id: input.reservationId,
          organizationId: input.organizationId,
        },
      });
    } catch (err) {
      if (isMissingRelationError(err)) {
        return { ok: true, alreadyRefunded: false };
      }
      throw err;
    }
    if (!auth) throw new ValidationError("Reservation not found");
    if (auth.status === BillingAuthStatus.REFUNDED) {
      return { ok: true, alreadyRefunded: true };
    }
    if (auth.status === BillingAuthStatus.COMMITTED) {
      throw new ValidationError(
        "Reservation already committed — cannot refund"
      );
    }

    if (auth.reservationIdempotencyKey && auth.credits > 0) {
      try {
        await creditLedgerService.refund({
          organizationId: input.organizationId,
          reserveIdempotencyKey: auth.reservationIdempotencyKey,
          actorUserId: input.actorUserId,
          reason: input.reason ?? "action_failed",
        });
      } catch {
        // already refunded
      }
    }

    await prisma.billingAuthorization.update({
      where: { id: auth.id },
      data: { status: BillingAuthStatus.REFUNDED },
    });

    await prisma.usageEvent.create({
      data: {
        id: randomUUID(),
        organizationId: input.organizationId,
        metric: auth.featureKey,
        quantity: auth.quantity,
        periodStart: auth.periodStart,
        referenceType: auth.referenceType,
        referenceId: auth.referenceId,
        idempotencyKey: `${auth.idempotencyKey}:refund`,
        metadata: {
          status: "refunded",
          reservationId: auth.id,
          reason: input.reason ?? null,
        },
      },
    }).catch(() => undefined);

    return { ok: true, alreadyRefunded: false };
  }

  /** authorize → fn → commit; on failure refund. Soft-pause on deny. */
  async withAuthorized<T>(input: {
    organizationId: string;
    action: BillingAction | string;
    qty?: number;
    referenceType?: string;
    referenceId?: string;
    idempotencyKey?: string;
    actorUserId?: string;
    purpose?: string;
    keyMode?: CreditKeyMode;
    exempt?: boolean;
    fn: () => Promise<T>;
  }): Promise<CreditRunResult<T>> {
    const auth = await this.authorize(input);
    if (!auth.allowed) {
      return {
        ok: false,
        paused: true,
        reason:
          auth.reason === BILLING_REASONS.OUT_OF_CREDITS
            ? "out_of_credits"
            : auth.reason,
        message: auth.message,
      };
    }

    try {
      const result = await input.fn();
      await this.commit({
        organizationId: input.organizationId,
        reservationId: auth.reservationId,
        actorUserId: input.actorUserId,
      });
      return {
        ok: true,
        result,
        credits: auth.credits,
        skippedOwner: auth.skippedOwner,
        reservationId: auth.reservationId,
      };
    } catch (err) {
      try {
        await this.refund({
          organizationId: input.organizationId,
          reservationId: auth.reservationId,
          actorUserId: input.actorUserId,
          reason: "action_failed",
        });
      } catch {
        // ignore
      }
      throw err;
    }
  }

  /** How many more units of this action can run now (for autopilot pre-flight). */
  async remainingBudget(
    organizationId: string,
    action: BillingAction | string
  ): Promise<number> {
    if (isPlatformOwnerOrg(organizationId)) return 10_000;

    const def = getActionDef(action);
    if (!def) return 0;
    if (def.alwaysExempt) return 10_000;

    const enforce = await this.isEnforcementActive(organizationId);
    if (!enforce) return 10_000;

    const effective = await this.getEffectiveFeature(
      organizationId,
      def.featureKey
    );
    if (!effective.enabled) return 0;

    let byLimit = 10_000;
    const schemaReady = await isBillingSchemaReady();

    if (def.period === "monthly" && def.metric && effective.limitValue != null) {
      const monthStart = periodStartUtc();
      try {
        const committed = await this.committedUsage(
          prisma,
          organizationId,
          def.metric,
          monthStart
        );
        const inFlight = schemaReady
          ? await this.inFlightUsage(
              prisma,
              organizationId,
              def.featureKey,
              "monthly",
              monthStart
            )
          : 0;
        byLimit = Math.max(0, effective.limitValue - committed - inFlight);
      } catch (err) {
        if (!isMissingRelationError(err)) throw err;
        // New UsageMetric not in DB yet
      }
    }

    if (def.dailyEmail) {
      const dailyCap = await this.getEffectiveDailyEmailLimit(organizationId);
      const dayStart = dayStartUtc();
      try {
        const committedDaily = await this.committedUsage(
          prisma,
          organizationId,
          "EMAILS_DAILY",
          dayStart
        );
        const inFlightDaily = schemaReady
          ? await this.inFlightUsage(
              prisma,
              organizationId,
              FEATURE_KEYS.EMAILS,
              "daily",
              dayStart
            )
          : 0;
        byLimit = Math.min(
          byLimit,
          Math.max(0, dailyCap - committedDaily - inFlightDaily)
        );
      } catch (err) {
        if (!isMissingRelationError(err)) throw err;
      }
    }

    if (def.creditActionType) {
      const price = await creditLedgerService.getPrice(def.creditActionType);
      if (price > 0) {
        const bal = await creditLedgerService.getBalance(organizationId);
        if (bal < 0) return 0;
        byLimit = Math.min(byLimit, Math.floor(bal / price));
      }
    }

    return byLimit;
  }

  /** Next UTC midnight — for daily email reschedule. */
  nextEmailSendWindow(): Date {
    return nextDayUtc();
  }

  enforcementEnvWarning(): {
    explicit: boolean;
    enabled: boolean;
    message: string | null;
  } {
    const explicit = isBillingEnforcementEnvExplicit();
    const enabled = isGlobalBillingEnforcementOn();
    if (!explicit) {
      return {
        explicit: false,
        enabled,
        message:
          "BILLING_ENFORCEMENT_ENABLED is not set. Set it explicitly to true in production (emergency kill switch when false).",
      };
    }
    if (!enabled) {
      return {
        explicit: true,
        enabled: false,
        message:
          "Global billing enforcement is OFF (kill switch). Per-org limits/credits are not blocking.",
      };
    }
    return { explicit: true, enabled: true, message: null };
  }

  private async committedUsage(
    db: Tx | typeof prisma,
    organizationId: string,
    metric: UsageMetric | string,
    periodStart: Date
  ): Promise<number> {
    const row = await db.usageRecord.findUnique({
      where: {
        organizationId_metric_periodStart: {
          organizationId,
          metric: metric as UsageMetric,
          periodStart,
        },
      },
      select: { quantity: true },
    });
    return row?.quantity ?? 0;
  }

  private async inFlightUsage(
    db: Tx | typeof prisma,
    organizationId: string,
    featureKey: string,
    mode: "monthly" | "daily",
    periodOrDay: Date
  ): Promise<number> {
    const where =
      mode === "daily"
        ? {
            organizationId,
            status: BillingAuthStatus.AUTHORIZED,
            featureKey,
            dayStart: periodOrDay,
          }
        : {
            organizationId,
            status: BillingAuthStatus.AUTHORIZED,
            featureKey,
            periodStart: periodOrDay,
          };
    const agg = await db.billingAuthorization.aggregate({
      where,
      _sum: { quantity: true },
    });
    return agg._sum.quantity ?? 0;
  }

  private async incrementUsageRecord(
    tx: Tx,
    organizationId: string,
    metric: UsageMetric | string,
    periodStart: Date,
    qty: number
  ) {
    try {
      await tx.usageRecord.upsert({
        where: {
          organizationId_metric_periodStart: {
            organizationId,
            metric: metric as UsageMetric,
            periodStart,
          },
        },
        create: {
          organizationId,
          metric: metric as UsageMetric,
          periodStart,
          quantity: qty,
        },
        update: { quantity: { increment: qty } },
      });
    } catch (err) {
      // New enum value not migrated yet — skip meter until s25-apply
      if (!isMissingRelationError(err) && !/invalid input value for enum/i.test(
        err instanceof Error ? err.message : ""
      )) {
        throw err;
      }
    }
  }

  private async recordUsageEvent(
    input: AuthorizeInput,
    featureKey: string,
    qty: number,
    meta: Record<string, unknown>
  ) {
    if (env.BILLING_METERING_ENABLED === false) return;
    try {
      await prisma.usageEvent.create({
        data: {
          id: randomUUID(),
          organizationId: input.organizationId,
          metric: featureKey,
          quantity: qty,
          periodStart: periodStartUtc(),
          referenceType: input.referenceType,
          referenceId: input.referenceId,
          idempotencyKey: meta.status === "authorized"
            ? `${input.idempotencyKey ?? randomUUID()}:auth-event`
            : undefined,
          metadata: {
            action: input.action,
            purpose: input.purpose ?? null,
            ...meta,
          },
        },
      });
    } catch {
      // unique / best-effort
    }
  }
}

export const billingGateway = new BillingGatewayService();

export function isOutOfCreditsPause(
  r: CreditRunResult<unknown>
): r is Extract<CreditRunResult<unknown>, { ok: false }> {
  return r.ok === false && r.paused === true;
}
