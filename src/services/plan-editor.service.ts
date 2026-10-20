/**
 * B2 Super Admin packages editor: draft → preview → publish + apply modes.
 */

import prisma from "@/lib/db/prisma";
import {
  PlanVersionStatus,
  PlanVisibility,
  Prisma,
  SubscriptionStatus,
} from "@prisma/client";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/api/response";
import {
  FEATURE_KEY_LABELS,
  FEATURE_KEYS,
  isKnownFeatureKey,
} from "@/lib/billing/features";
import {
  LIMIT_FEATURE_KEYS,
  MODULE_CATALOG,
  MODULE_FEATURE_KEYS,
} from "@/lib/billing/modules";
import { organizationService } from "@/services/organization.service";
import { planPauseService } from "@/services/plan-pause.service";
import { syncProductAndPrices } from "@/services/billing/provider-registry";
import type { ApplyMode } from "@/services/payment-provider.stub";

export type FeatureDraft = {
  featureKey: string;
  enabled: boolean;
  limitValue: number | null;
};

export type DraftPayload = {
  name?: string;
  description?: string | null;
  visibility?: PlanVisibility;
  mostPopular?: boolean;
  sortOrder?: number;
  priceMonthly?: number;
  priceYearly?: number;
  currency?: string;
  monthlyCredits?: number | null;
  creditRolloverEnabled?: boolean;
  creditRolloverCapMonths?: number | null;
  features?: FeatureDraft[];
  /** Optimistic lock — must match draft.editorRevision */
  editorRevision: number;
  reason?: string;
};

function defaultFeaturesFromRegistry(): FeatureDraft[] {
  const keys = new Set<string>([
    ...LIMIT_FEATURE_KEYS,
    ...MODULE_FEATURE_KEYS,
  ]);
  return [...keys].map((featureKey) => ({
    featureKey,
    enabled: MODULE_FEATURE_KEYS.includes(featureKey as never)
      ? false
      : true,
    limitValue: null,
  }));
}

export class PlanEditorService {
  registryGrouped() {
    return {
      modules: MODULE_CATALOG.map((m) => ({
        key: m.key,
        label: m.label,
        availableOn: m.availableOn,
      })),
      limits: LIMIT_FEATURE_KEYS.map((k) => ({
        key: k,
        label: FEATURE_KEY_LABELS[k] ?? k,
      })),
      credits: [
        { key: "monthly_credits", label: "Monthly credits" },
        { key: "credit_rollover", label: "Credit rollover" },
      ],
    };
  }

  async listPlans() {
    const plans = await prisma.plan.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        versions: {
          where: { status: PlanVersionStatus.PUBLISHED },
          orderBy: { version: "desc" },
          take: 1,
          include: { features: true },
        },
        _count: { select: { subscriptions: true } },
      },
    });

    const versionIds = plans
      .map((p) => p.currentVersionId)
      .filter((id): id is string => !!id);

    const subCounts = versionIds.length
      ? await prisma.subscription.groupBy({
          by: ["planVersionId"],
          where: { planVersionId: { in: versionIds } },
          _count: { _all: true },
        })
      : [];
    const countByVersion = new Map(
      subCounts.map((s) => [s.planVersionId!, s._count._all])
    );

    const drafts = await prisma.planVersion.findMany({
      where: { status: PlanVersionStatus.DRAFT },
      select: { planId: true, id: true, editorRevision: true, version: true },
    });
    const draftByPlan = new Map(drafts.map((d) => [d.planId, d]));

    return plans.map((p) => {
      const published = p.versions[0];
      return {
        id: p.id,
        name: p.name,
        code: p.code,
        description: p.description,
        active: p.active,
        status: p.archivedAt
          ? "archived"
          : p.active
            ? "published"
            : "draft",
        visibility: p.visibility,
        mostPopular: p.mostPopular,
        sortOrder: p.sortOrder,
        archivedAt: p.archivedAt,
        currentVersionId: p.currentVersionId,
        currentVersion: published
          ? {
              id: published.id,
              version: published.version,
              priceMonthly: Number(published.priceMonthly),
              priceYearly: Number(published.priceYearly),
              currency: published.currency,
              monthlyCredits: published.monthlyCredits,
              subscriberCount: countByVersion.get(published.id) ?? 0,
            }
          : null,
        subscriberCount: p._count.subscriptions,
        draft: draftByPlan.get(p.id) ?? null,
      };
    });
  }

  async getPlan(planId: string) {
    const plan = await prisma.plan.findUnique({
      where: { id: planId },
      include: {
        versions: {
          orderBy: { version: "desc" },
          include: { features: true },
        },
      },
    });
    if (!plan) throw new NotFoundError("Plan not found");
    return plan;
  }

  private assertVisibilityAllowed(
    code: string | null | undefined,
    visibility: PlanVisibility | undefined
  ) {
    if (!visibility) return;
    const c = (code || "").toUpperCase();
    const internalCodes = new Set(["OWNER", "COMPLIMENTARY"]);
    if (
      internalCodes.has(c) &&
      visibility === PlanVisibility.PUBLIC
    ) {
      throw new ValidationError(
        "Internal plans (OWNER / COMPLIMENTARY) can never be PUBLIC"
      );
    }
  }

  async createPlan(input: {
    name: string;
    code?: string | null;
    description?: string | null;
    visibility?: PlanVisibility;
    actorUserId: string;
    reason: string;
  }) {
    if (!input.reason?.trim()) throw new ValidationError("reason is required");
    this.assertVisibilityAllowed(input.code, input.visibility);
    const maxSort = await prisma.plan.aggregate({ _max: { sortOrder: true } });
    const code = input.code?.trim() || null;
    const forcedInternal =
      code && ["OWNER", "COMPLIMENTARY"].includes(code.toUpperCase())
        ? PlanVisibility.INTERNAL
        : input.visibility ?? PlanVisibility.PRIVATE;
    const plan = await prisma.plan.create({
      data: {
        name: input.name.trim(),
        code,
        description: input.description ?? null,
        price: 0,
        currency: "USD",
        active: false,
        visibility: forcedInternal,
        sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
      },
    });
    const draft = await this.ensureDraft(plan.id, input.actorUserId);
    await organizationService.writePlatformAudit({
      actorUserId: input.actorUserId,
      action: "plan.created",
      targetType: "plan",
      targetId: plan.id,
      after: { name: plan.name, code: plan.code },
      reason: input.reason,
    });
    return { plan, draft };
  }

  async ensureDraft(planId: string, actorUserId?: string) {
    const existing = await prisma.planVersion.findFirst({
      where: { planId, status: PlanVersionStatus.DRAFT },
      include: { features: true },
    });
    if (existing) return existing;

    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundError("Plan not found");

    const latest = await prisma.planVersion.findFirst({
      where: { planId, status: PlanVersionStatus.PUBLISHED },
      orderBy: { version: "desc" },
      include: { features: true },
    });

    const nextVersion = latest ? latest.version + 1 : 1;
    const baseFeatures =
      latest?.features.map((f) => ({
        featureKey: f.featureKey,
        enabled: f.enabled,
        limitValue: f.limitValue,
      })) ?? defaultFeaturesFromRegistry();

    return prisma.planVersion.create({
      data: {
        planId,
        version: nextVersion,
        status: PlanVersionStatus.DRAFT,
        editorRevision: 0,
        priceMonthly: latest?.priceMonthly ?? plan.price,
        priceYearly: latest?.priceYearly ?? Number(plan.price) * 10,
        currency: latest?.currency ?? plan.currency,
        monthlyCredits: latest?.monthlyCredits ?? plan.monthlyCredits,
        creditRolloverEnabled:
          latest?.creditRolloverEnabled ?? plan.creditRolloverEnabled,
        creditRolloverCapMonths: latest?.creditRolloverCapMonths ?? null,
        createdByUserId: actorUserId ?? null,
        features: {
          create: baseFeatures.map((f) => ({
            featureKey: f.featureKey,
            enabled: f.enabled,
            limitValue: f.limitValue,
          })),
        },
      },
      include: { features: true },
    });
  }

  async saveDraft(
    planId: string,
    payload: DraftPayload,
    actorUserId: string
  ) {
    if (!payload.reason?.trim()) {
      throw new ValidationError("reason is required");
    }
    const draft = await this.ensureDraft(planId, actorUserId);
    if (draft.editorRevision !== payload.editorRevision) {
      throw new ConflictError(
        "Draft was modified by another admin. Reload and try again.",
        "OPTIMISTIC_LOCK"
      );
    }

    const before = {
      editorRevision: draft.editorRevision,
      priceMonthly: Number(draft.priceMonthly),
      priceYearly: Number(draft.priceYearly),
      monthlyCredits: draft.monthlyCredits,
      features: draft.features,
    };

    if (payload.name != null || payload.description !== undefined || payload.visibility != null) {
      const planRow = await prisma.plan.findUniqueOrThrow({
        where: { id: planId },
        select: { code: true },
      });
      this.assertVisibilityAllowed(planRow.code, payload.visibility);
      const visibility =
        planRow.code &&
        ["OWNER", "COMPLIMENTARY"].includes(planRow.code.toUpperCase())
          ? PlanVisibility.INTERNAL
          : payload.visibility;
      await prisma.plan.update({
        where: { id: planId },
        data: {
          ...(payload.name != null ? { name: payload.name.trim() } : {}),
          ...(payload.description !== undefined
            ? { description: payload.description }
            : {}),
          ...(visibility != null ? { visibility } : {}),
          ...(payload.mostPopular != null
            ? { mostPopular: payload.mostPopular }
            : {}),
          ...(payload.sortOrder != null
            ? { sortOrder: payload.sortOrder }
            : {}),
        },
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (payload.features) {
        for (const f of payload.features) {
          if (!isKnownFeatureKey(f.featureKey)) {
            throw new ValidationError(`Unknown feature key: ${f.featureKey}`);
          }
          await tx.planVersionFeature.upsert({
            where: {
              planVersionId_featureKey: {
                planVersionId: draft.id,
                featureKey: f.featureKey,
              },
            },
            create: {
              planVersionId: draft.id,
              featureKey: f.featureKey,
              enabled: f.enabled,
              limitValue: f.limitValue,
            },
            update: {
              enabled: f.enabled,
              limitValue: f.limitValue,
            },
          });
        }
      }

      return tx.planVersion.update({
        where: { id: draft.id },
        data: {
          editorRevision: { increment: 1 },
          ...(payload.priceMonthly != null
            ? { priceMonthly: new Prisma.Decimal(payload.priceMonthly) }
            : {}),
          ...(payload.priceYearly != null
            ? { priceYearly: new Prisma.Decimal(payload.priceYearly) }
            : {}),
          ...(payload.currency != null ? { currency: payload.currency } : {}),
          ...(payload.monthlyCredits !== undefined
            ? { monthlyCredits: payload.monthlyCredits }
            : {}),
          ...(payload.creditRolloverEnabled != null
            ? { creditRolloverEnabled: payload.creditRolloverEnabled }
            : {}),
          ...(payload.creditRolloverCapMonths !== undefined
            ? { creditRolloverCapMonths: payload.creditRolloverCapMonths }
            : {}),
        },
        include: { features: true },
      });
    });

    await organizationService.writePlatformAudit({
      actorUserId,
      action: "plan.draft_saved",
      targetType: "plan_version",
      targetId: draft.id,
      before,
      after: {
        editorRevision: updated.editorRevision,
        priceMonthly: Number(updated.priceMonthly),
        priceYearly: Number(updated.priceYearly),
        monthlyCredits: updated.monthlyCredits,
      },
      reason: payload.reason,
    });

    return updated;
  }

  async previewPublish(planId: string) {
    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundError("Plan not found");
    const draft = await prisma.planVersion.findFirst({
      where: { planId, status: PlanVersionStatus.DRAFT },
      include: { features: true },
    });
    if (!draft) throw new ValidationError("No draft to publish");

    const current = plan.currentVersionId
      ? await prisma.planVersion.findUnique({
          where: { id: plan.currentVersionId },
          include: { features: true },
        })
      : null;

    const subscribers = await prisma.subscription.findMany({
      where: {
        planId,
        status: {
          in: [
            SubscriptionStatus.ACTIVE,
            SubscriptionStatus.TRIALING,
            SubscriptionStatus.PAST_DUE,
          ],
        },
      },
      include: {
        organization: { select: { id: true, name: true, slug: true } },
        planVersion: { include: { features: true } },
      },
    });

    const draftLimits = Object.fromEntries(
      draft.features.map((f) => [f.featureKey, f.limitValue])
    );

    const companies = [];
    for (const sub of subscribers) {
      const above: Awaited<
        ReturnType<typeof planPauseService.previewPauseImpact>
      >[] = [];
      for (const key of [
        FEATURE_KEYS.USERS,
        FEATURE_KEYS.OUTBOUND_MAILBOXES,
        FEATURE_KEYS.CAMPAIGNS,
        FEATURE_KEYS.SEQUENCES,
        FEATURE_KEYS.ICPS,
        FEATURE_KEYS.CONNECTORS,
      ]) {
        const newLimit =
          draftLimits[key] === undefined ? null : draftLimits[key];
        const impact = await planPauseService.previewPauseImpact(
          sub.organizationId,
          key,
          newLimit
        );
        if (impact.overBy > 0) above.push(impact);
      }
      companies.push({
        organizationId: sub.organizationId,
        name: sub.organization.name,
        slug: sub.organization.slug,
        pinnedVersionId: sub.planVersionId,
        aboveLimits: above,
      });
    }

    const aboveCount = companies.filter((c) => c.aboveLimits.length > 0).length;

    return {
      plan: { id: plan.id, name: plan.name, code: plan.code },
      draft: {
        id: draft.id,
        version: draft.version,
        editorRevision: draft.editorRevision,
        priceMonthly: Number(draft.priceMonthly),
        priceYearly: Number(draft.priceYearly),
        monthlyCredits: draft.monthlyCredits,
        features: draft.features,
      },
      currentVersion: current
        ? {
            id: current.id,
            version: current.version,
            priceMonthly: Number(current.priceMonthly),
            priceYearly: Number(current.priceYearly),
            monthlyCredits: current.monthlyCredits,
            features: current.features,
          }
        : null,
      affectedCompaniesCount: companies.length,
      aboveLimitsCount: aboveCount,
      companies,
      defaults: {
        increases: "now" as ApplyMode,
        decreases: "renewal" as ApplyMode,
        note: "Price changes never move existing subscribers automatically. Monthly credit changes apply from each company's next grant.",
      },
    };
  }

  async publish(input: {
    planId: string;
    applyMode: ApplyMode;
    editorRevision: number;
    confirmPlanName?: string;
    actorUserId: string;
    reason: string;
  }) {
    if (!input.reason?.trim()) throw new ValidationError("reason is required");
    const plan = await prisma.plan.findUnique({ where: { id: input.planId } });
    if (!plan) throw new NotFoundError("Plan not found");

    const draft = await prisma.planVersion.findFirst({
      where: { planId: input.planId, status: PlanVersionStatus.DRAFT },
      include: { features: true },
    });
    if (!draft) throw new ValidationError("No draft to publish");
    if (draft.editorRevision !== input.editorRevision) {
      throw new ConflictError(
        "Draft was modified by another admin. Reload and try again.",
        "OPTIMISTIC_LOCK"
      );
    }

    const preview = await this.previewPublish(input.planId);
    if (
      input.applyMode === "now" &&
      preview.affectedCompaniesCount > 0
    ) {
      if (
        !input.confirmPlanName ||
        input.confirmPlanName.trim() !== plan.name
      ) {
        throw new ValidationError(
          `Type the plan name "${plan.name}" to confirm Apply now`
        );
      }
    }

    const now = new Date();
    const published = await prisma.planVersion.update({
      where: { id: draft.id },
      data: {
        status: PlanVersionStatus.PUBLISHED,
        publishedAt: now,
        publishedByUserId: input.actorUserId,
        applyMode: input.applyMode,
      },
      include: { features: true },
    });

    // currentVersionId always points at newest published for new subscribers
    await prisma.plan.update({
      where: { id: plan.id },
      data: {
        currentVersionId: published.id,
        active: true,
        archivedAt: null,
        price: published.priceMonthly,
        currency: published.currency,
        monthlyCredits: published.monthlyCredits,
        creditRolloverEnabled: published.creditRolloverEnabled,
        creditRolloverCap:
          published.creditRolloverCapMonths != null &&
          published.monthlyCredits != null
            ? published.monthlyCredits * published.creditRolloverCapMonths
            : null,
      },
    });

    // B3: Paddle product/price sync (no-op if not configured / internal plan)
    try {
      await syncProductAndPrices({
        planId: plan.id,
        planVersionId: published.id,
        reason: input.reason,
      });
    } catch (err) {
      console.error("[plan-editor] provider sync failed", err);
    }

    let appliedNow = 0;
    let scheduledRenewal = 0;
    let grandfathered = 0;

    const subs = await prisma.subscription.findMany({
      where: {
        planId: plan.id,
        status: {
          in: [
            SubscriptionStatus.ACTIVE,
            SubscriptionStatus.TRIALING,
            SubscriptionStatus.PAST_DUE,
          ],
        },
      },
    });

    const draftLimits = Object.fromEntries(
      published.features.map((f) => [f.featureKey, f.limitValue])
    ) as Record<string, number | null>;

    if (input.applyMode === "new_subscribers_only") {
      grandfathered = subs.length;
    } else if (input.applyMode === "renewal") {
      for (const sub of subs) {
        const applyAt = sub.currentPeriodEnd ?? now;
        await prisma.subscription.update({
          where: { id: sub.id },
          data: {
            pendingPlanVersionId: published.id,
            pendingApplyAt: applyAt,
          },
        });
        scheduledRenewal++;
      }
    } else {
      // apply now — pin version; credits NOT granted retroactively
      for (const sub of subs) {
        await prisma.subscription.update({
          where: { id: sub.id },
          data: {
            planVersionId: published.id,
            pendingPlanVersionId: null,
            pendingApplyAt: null,
          },
        });
        await planPauseService.reconcileOrgLimits(
          sub.organizationId,
          draftLimits,
          published.id,
          input.actorUserId
        );
        appliedNow++;
      }
    }

    await organizationService.writePlatformAudit({
      actorUserId: input.actorUserId,
      action: "plan.published",
      targetType: "plan_version",
      targetId: published.id,
      before: { currentVersionId: plan.currentVersionId },
      after: {
        planVersionId: published.id,
        version: published.version,
        applyMode: input.applyMode,
        appliedNow,
        scheduledRenewal,
        grandfathered,
        priceNote: "existing subscribers keep prior price pin",
        creditsNote: "monthly credit changes from next grant only",
      },
      reason: input.reason,
    });

    return {
      planVersion: published,
      applyMode: input.applyMode,
      appliedNow,
      scheduledRenewal,
      grandfathered,
      previewSummary: {
        affectedCompaniesCount: preview.affectedCompaniesCount,
        aboveLimitsCount: preview.aboveLimitsCount,
      },
    };
  }

  async archivePlan(planId: string, actorUserId: string, reason: string) {
    if (!reason?.trim()) throw new ValidationError("reason is required");
    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundError("Plan not found");
    const updated = await prisma.plan.update({
      where: { id: planId },
      data: {
        archivedAt: new Date(),
        active: false,
        visibility: PlanVisibility.INTERNAL,
      },
    });
    await organizationService.writePlatformAudit({
      actorUserId,
      action: "plan.archived",
      targetType: "plan",
      targetId: planId,
      before: { active: plan.active, visibility: plan.visibility },
      after: { archivedAt: updated.archivedAt, active: false },
      reason,
    });
    return updated;
  }

  async versionDiff(planId: string, fromId: string, toId: string) {
    const [from, to] = await Promise.all([
      prisma.planVersion.findFirst({
        where: { id: fromId, planId, status: PlanVersionStatus.PUBLISHED },
        include: { features: true },
      }),
      prisma.planVersion.findFirst({
        where: { id: toId, planId },
        include: { features: true },
      }),
    ]);
    if (!from || !to) throw new NotFoundError("Version not found");

    const fromMap = new Map(from.features.map((f) => [f.featureKey, f]));
    const toMap = new Map(to.features.map((f) => [f.featureKey, f]));
    const keys = new Set([...fromMap.keys(), ...toMap.keys()]);
    const featureDiffs = [...keys].map((key) => {
      const a = fromMap.get(key);
      const b = toMap.get(key);
      return {
        featureKey: key,
        from: a
          ? { enabled: a.enabled, limitValue: a.limitValue }
          : null,
        to: b ? { enabled: b.enabled, limitValue: b.limitValue } : null,
        changed:
          !a ||
          !b ||
          a.enabled !== b.enabled ||
          a.limitValue !== b.limitValue,
      };
    });

    return {
      from: {
        id: from.id,
        version: from.version,
        priceMonthly: Number(from.priceMonthly),
        priceYearly: Number(from.priceYearly),
        monthlyCredits: from.monthlyCredits,
      },
      to: {
        id: to.id,
        version: to.version,
        status: to.status,
        priceMonthly: Number(to.priceMonthly),
        priceYearly: Number(to.priceYearly),
        monthlyCredits: to.monthlyCredits,
      },
      metaChanged: {
        priceMonthly: Number(from.priceMonthly) !== Number(to.priceMonthly),
        priceYearly: Number(from.priceYearly) !== Number(to.priceYearly),
        monthlyCredits: from.monthlyCredits !== to.monthlyCredits,
        rollover: from.creditRolloverEnabled !== to.creditRolloverEnabled,
      },
      featureDiffs: featureDiffs.filter((d) => d.changed),
    };
  }
}

export const planEditorService = new PlanEditorService();
