/**
 * B1 tenant lifecycle access — independent of BILLING_ENFORCEMENT_ENABLED.
 * Platform owner org is never locked.
 */

import prisma from "@/lib/db/prisma";
import { env } from "@/lib/config/env";
import { SubscriptionStatus } from "@prisma/client";
import { MODULE_KEYS, type ModuleKey, getModuleDef } from "@/lib/billing/modules";
import { BILLING_REASONS } from "@/lib/billing/reasons";

export const ACCESS_REASONS = {
  NO_ACTIVE_SUBSCRIPTION: "NO_ACTIVE_SUBSCRIPTION",
  MODULE_LOCKED: "MODULE_LOCKED",
  READ_ONLY: "READ_ONLY",
  ORG_ARCHIVED: "ORG_ARCHIVED",
  LIFECYCLE_DISABLED: "LIFECYCLE_DISABLED",
} as const;

export type AccessReason =
  (typeof ACCESS_REASONS)[keyof typeof ACCESS_REASONS];

export type AccessMode =
  | "full"
  | "locked"
  | "read_only"
  | "suspended_read_only";

export type TenantAccess = {
  organizationId: string;
  isPlatformOwner: boolean;
  lifecycleEnforced: boolean;
  orgStatus: string;
  subscriptionStatus: SubscriptionStatus | null;
  accessMode: AccessMode;
  planName: string | null;
  planVersionId: string | null;
  canMutate: boolean;
  canRunOutboundJobs: boolean;
  canRunInboxSync: boolean;
  /** Module key → enabled from pinned version + override */
  modules: Record<string, boolean>;
};

function isOwner(organizationId: string): boolean {
  const id = env.PLATFORM_OWNER_ORG_ID;
  return Boolean(id && organizationId === id);
}

const INACTIVE_STRIPE_STATUSES = new Set<SubscriptionStatus>([
  SubscriptionStatus.UNPAID,
  SubscriptionStatus.INCOMPLETE,
  SubscriptionStatus.INCOMPLETE_EXPIRED,
]);

export class TenantAccessService {
  lifecycleEnforced(): boolean {
    return env.TENANT_LIFECYCLE_ENFORCED === true;
  }

  isPlatformOwner(organizationId: string): boolean {
    return isOwner(organizationId);
  }

  async getAccess(organizationId: string): Promise<TenantAccess> {
    const owner = isOwner(organizationId);
    const enforced = this.lifecycleEnforced();

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { status: true, deletedAt: true },
    });

    const sub = await prisma.subscription.findUnique({
      where: { organizationId },
      include: {
        plan: { select: { name: true } },
        planVersion: {
          include: { features: true },
        },
      },
    });

    const modules: Record<string, boolean> = {};
    for (const k of Object.values(MODULE_KEYS)) {
      modules[k] = owner || !enforced;
    }

    if (sub?.planVersion?.features) {
      for (const f of sub.planVersion.features) {
        if (Object.values(MODULE_KEYS).includes(f.featureKey as ModuleKey)) {
          modules[f.featureKey] = f.enabled;
        }
      }
    } else if (sub && !sub.planVersionId) {
      // Legacy PlanFeature fallback (transition only)
      const legacy = await prisma.planFeature.findMany({
        where: { planId: sub.planId },
      });
      for (const f of legacy) {
        if (Object.values(MODULE_KEYS).includes(f.featureKey as ModuleKey)) {
          modules[f.featureKey] = f.enabled;
        }
      }
    }

    // Overrides always win
    try {
      const overrides = await prisma.orgEntitlementOverride.findMany({
        where: { organizationId },
      });
      for (const o of overrides) {
        if (
          Object.values(MODULE_KEYS).includes(o.key as ModuleKey) &&
          o.enabled != null
        ) {
          modules[o.key] = o.enabled;
        }
      }
    } catch {
      // table may not exist pre-apply
    }

    if (owner) {
      return {
        organizationId,
        isPlatformOwner: true,
        lifecycleEnforced: enforced,
        orgStatus: org?.status ?? "ACTIVE",
        subscriptionStatus: sub?.status ?? null,
        accessMode: "full",
        planName: sub?.plan?.name ?? "OWNER",
        planVersionId: sub?.planVersionId ?? null,
        canMutate: true,
        canRunOutboundJobs: true,
        canRunInboxSync: true,
        modules: Object.fromEntries(
          Object.values(MODULE_KEYS).map((k) => [k, true])
        ),
      };
    }

    if (!enforced) {
      return {
        organizationId,
        isPlatformOwner: false,
        lifecycleEnforced: false,
        orgStatus: org?.status ?? "ACTIVE",
        subscriptionStatus: sub?.status ?? null,
        accessMode: "full",
        planName: sub?.plan?.name ?? null,
        planVersionId: sub?.planVersionId ?? null,
        canMutate: true,
        canRunOutboundJobs: true,
        canRunInboxSync: true,
        modules,
      };
    }

    if (
      !org ||
      org.deletedAt ||
      org.status === "ARCHIVED" ||
      org.status === "CANCELLED"
    ) {
      return {
        organizationId,
        isPlatformOwner: false,
        lifecycleEnforced: enforced,
        orgStatus: org?.status ?? "ARCHIVED",
        subscriptionStatus: sub?.status ?? null,
        accessMode: "locked",
        planName: null,
        planVersionId: null,
        canMutate: false,
        canRunOutboundJobs: false,
        canRunInboxSync: false,
        modules: Object.fromEntries(
          Object.values(MODULE_KEYS).map((k) => [k, false])
        ),
      };
    }

    const status = sub?.status ?? SubscriptionStatus.NONE;
    const now = new Date();

    // CANCELED after period end → read-only
    if (
      status === SubscriptionStatus.CANCELED &&
      sub?.currentPeriodEnd &&
      sub.currentPeriodEnd < now
    ) {
      return {
        organizationId,
        isPlatformOwner: false,
        lifecycleEnforced: enforced,
        orgStatus: org.status,
        subscriptionStatus: status,
        accessMode: "read_only",
        planName: sub.plan?.name ?? null,
        planVersionId: sub.planVersionId,
        canMutate: false,
        canRunOutboundJobs: false,
        canRunInboxSync: false,
        modules,
      };
    }

    if (
      status === SubscriptionStatus.NONE ||
      status === SubscriptionStatus.EXPIRED ||
      INACTIVE_STRIPE_STATUSES.has(status)
    ) {
      return {
        organizationId,
        isPlatformOwner: false,
        lifecycleEnforced: enforced,
        orgStatus: org.status,
        subscriptionStatus: status,
        accessMode: "locked",
        planName: sub?.plan?.name ?? null,
        planVersionId: sub?.planVersionId ?? null,
        canMutate: false,
        canRunOutboundJobs: false,
        canRunInboxSync: false,
        modules: Object.fromEntries(
          Object.values(MODULE_KEYS).map((k) => [k, false])
        ),
      };
    }

    if (status === SubscriptionStatus.SUSPENDED) {
      return {
        organizationId,
        isPlatformOwner: false,
        lifecycleEnforced: enforced,
        orgStatus: org.status,
        subscriptionStatus: status,
        accessMode: "suspended_read_only",
        planName: sub?.plan?.name ?? null,
        planVersionId: sub?.planVersionId ?? null,
        canMutate: false,
        canRunOutboundJobs: false,
        canRunInboxSync: true,
        modules,
      };
    }

    // TRIALING, ACTIVE, PAST_DUE, CANCELED (still in period)
    return {
      organizationId,
      isPlatformOwner: false,
      lifecycleEnforced: enforced,
      orgStatus: org.status,
      subscriptionStatus: status,
      accessMode: "full",
      planName: sub?.plan?.name ?? null,
      planVersionId: sub?.planVersionId ?? null,
      canMutate: true,
      canRunOutboundJobs: true,
      canRunInboxSync: true,
      modules,
    };
  }

  async assertPageAccess(
    organizationId: string,
    dashboardPath: string
  ): Promise<
    | { ok: true }
    | { ok: false; redirectTo: string; reason: AccessReason }
  > {
    const access = await this.getAccess(organizationId);
    if (access.isPlatformOwner || !access.lifecycleEnforced) {
      return { ok: true };
    }
    if (access.accessMode === "locked") {
      if (
        dashboardPath.startsWith("/billing") ||
        dashboardPath.startsWith("/settings") ||
        dashboardPath.startsWith("/onboarding")
      ) {
        return { ok: true };
      }
      return {
        ok: false,
        redirectTo: "/billing/choose-plan",
        reason: ACCESS_REASONS.NO_ACTIVE_SUBSCRIPTION,
      };
    }
    // Module check for full / read_only / suspended
    const { moduleForDashboardPath } = await import("@/lib/billing/modules");
    const mod = moduleForDashboardPath(dashboardPath);
    if (!mod) return { ok: true };
    if (!access.modules[mod]) {
      // Allow page to render upgrade card — layout passes locked flag
      return { ok: true };
    }
    return { ok: true };
  }

  async assertModuleApi(
    organizationId: string,
    moduleKey: ModuleKey,
    opts?: { mutation?: boolean }
  ): Promise<
    | { ok: true; access: TenantAccess }
    | { ok: false; status: number; reason: string; message: string }
  > {
    const access = await this.getAccess(organizationId);
    if (access.isPlatformOwner || !access.lifecycleEnforced) {
      return { ok: true, access };
    }

    if (access.accessMode === "locked") {
      return {
        ok: false,
        status: 403,
        reason: ACCESS_REASONS.NO_ACTIVE_SUBSCRIPTION,
        message:
          "No active subscription. Choose a plan to activate your workspace.",
      };
    }

    if (
      (access.accessMode === "read_only" ||
        access.accessMode === "suspended_read_only") &&
      opts?.mutation
    ) {
      return {
        ok: false,
        status: 403,
        reason: ACCESS_REASONS.READ_ONLY,
        message:
          access.accessMode === "suspended_read_only"
            ? "Account suspended. Update payment to continue."
            : "Subscription canceled. Workspace is read-only.",
      };
    }

    if (!access.modules[moduleKey]) {
      const def = getModuleDef(moduleKey);
      return {
        ok: false,
        status: 403,
        reason: ACCESS_REASONS.MODULE_LOCKED,
        message: `Module "${def?.label ?? moduleKey}" is not included in your plan. Available on ${def?.availableOn ?? "a higher plan"}.`,
      };
    }

    return { ok: true, access };
  }

  /** Job guard: should this org run the given job tag? */
  async canRunJob(
    organizationId: string,
    jobTag: string
  ): Promise<boolean> {
    const access = await this.getAccess(organizationId);
    if (access.isPlatformOwner || !access.lifecycleEnforced) return true;
    if (access.accessMode === "locked") return false;
    if (jobTag === "inbox_sync") return access.canRunInboxSync;
    if (
      ["outbound", "sequences", "sourcing", "crawl", "enrichment", "audit", "ai_auto_send", "ai_replies"].includes(
        jobTag
      )
    ) {
      return access.canRunOutboundJobs;
    }
    return access.canMutate;
  }

  /** Map lifecycle blocks into billing-gateway style reasons when useful */
  toBillingReason(reason: string): string {
    if (reason === ACCESS_REASONS.NO_ACTIVE_SUBSCRIPTION) {
      return BILLING_REASONS.SUBSCRIPTION_INACTIVE;
    }
    if (reason === ACCESS_REASONS.MODULE_LOCKED) {
      return BILLING_REASONS.PLAN_FEATURE_DISABLED;
    }
    return reason;
  }
}

export const tenantAccessService = new TenantAccessService();
