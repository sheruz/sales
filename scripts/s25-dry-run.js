/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * S2.5 dry-run (READ-ONLY). Lists orgs that would become enforced,
 * feature keys to seed, confirms Default Workspace stays exempt.
 * Does NOT apply. Wait for GO before: node scripts/s25-apply.js
 */
const {
  OWNER_ORG_NAME,
  TEST_TENANT_NAME,
  NEW_FEATURE_KEYS,
  PLAN_FEATURE_DEFAULTS,
  NEW_USAGE_METRICS,
  readOnlyPrisma,
  tableExists,
  columnExists,
  enumHasValue,
} = require("./s25-lib");

async function main() {
  const prisma = readOnlyPrisma();
  const platformOwnerId = process.env.PLATFORM_OWNER_ORG_ID || null;

  const out = {
    phase: "S2.5",
    mode: "DRY_RUN",
    at: new Date().toISOString(),
    platformOwnerOrgId: platformOwnerId,
    ownerOrgName: OWNER_ORG_NAME,
    testTenantName: TEST_TENANT_NAME,
    schema: {},
    orgsBecomingEnforced: [],
    orgsAlreadyEnforced: [],
    orgsStayingExempt: [],
    featureKeysToSeed: [],
    usageMetricsToAdd: [],
    ownerPlanAssignBlock: true,
    notes: [],
    fatal: [],
  };

  try {
    out.schema.hasBillingAuthorizations = await tableExists(
      prisma,
      "billing_authorizations"
    );
    out.schema.hasOrgEntitlementOverrides = await tableExists(
      prisma,
      "org_entitlement_overrides"
    );
    out.schema.billingEnforcementColumn = await columnExists(
      prisma,
      "organizations",
      "billing_enforcement_enabled"
    );

    for (const m of NEW_USAGE_METRICS) {
      const has = await enumHasValue(prisma, "UsageMetric", m);
      if (!has) out.usageMetricsToAdd.push(m);
    }

    const plans = await prisma.plan.findMany({
      include: { features: true },
      orderBy: { sortOrder: "asc" },
    });

    for (const plan of plans) {
      const defaults =
        PLAN_FEATURE_DEFAULTS[plan.name] ||
        (plan.code ? PLAN_FEATURE_DEFAULTS[plan.code] : null) ||
        (plan.code === "OWNER" || plan.name === "OWNER"
          ? PLAN_FEATURE_DEFAULTS.OWNER
          : null);
      const missing = [];
      for (const key of NEW_FEATURE_KEYS) {
        const exists = plan.features.some((f) => f.featureKey === key);
        if (!exists) {
          missing.push({
            key,
            limitValue: defaults ? defaults[key] : null,
            enabled: true,
          });
        }
      }
      if (missing.length) {
        out.featureKeysToSeed.push({
          planId: plan.id,
          planName: plan.name,
          planCode: plan.code,
          missing,
        });
      }
    }

    const orgs = await prisma.organization.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        billingEnforcementEnabled: true,
        creditBalanceCached: true,
        subscriptions: {
          select: { plan: { select: { code: true, name: true } } },
          take: 1,
        },
      },
      orderBy: { name: "asc" },
    });

    for (const org of orgs) {
      const isPlatformOwner =
        (platformOwnerId && org.id === platformOwnerId) ||
        org.name === OWNER_ORG_NAME;
      const sub = org.subscriptions?.[0];
      const row = {
        id: org.id,
        name: org.name,
        plan: sub?.plan?.code || sub?.plan?.name,
        billingEnforcementEnabled: org.billingEnforcementEnabled,
        creditBalanceCached: org.creditBalanceCached,
      };

      if (isPlatformOwner) {
        out.orgsStayingExempt.push({
          ...row,
          reason: "PLATFORM_OWNER_ORG_ID / Default Workspace",
          action: "ensure billingEnforcementEnabled=false",
        });
        continue;
      }

      if (org.billingEnforcementEnabled === true) {
        out.orgsAlreadyEnforced.push(row);
      } else {
        out.orgsBecomingEnforced.push({
          ...row,
          action: "set billingEnforcementEnabled=true",
        });
      }
    }

    // Expectation check
    if (
      out.orgsBecomingEnforced.length === 1 &&
      out.orgsBecomingEnforced[0].name === TEST_TENANT_NAME
    ) {
      out.notes.push(
        `OK: only "${TEST_TENANT_NAME}" would become enforced (matches expected today).`
      );
    } else if (out.orgsBecomingEnforced.length === 0) {
      out.notes.push(
        "No orgs becoming enforced — all non-owner orgs already enforced, or none exist."
      );
    } else {
      out.notes.push(
        `WARNING: ${out.orgsBecomingEnforced.length} org(s) would become enforced (expected Test Tenant only). Review list.`
      );
    }

    const ownerExempt = out.orgsStayingExempt.some(
      (o) => o.name === OWNER_ORG_NAME
    );
    if (ownerExempt) {
      out.notes.push(
        `OK: "${OWNER_ORG_NAME}" listed as staying exempt.`
      );
    } else {
      out.fatal.push(
        `Default Workspace / PLATFORM_OWNER not found — set PLATFORM_OWNER_ORG_ID`
      );
    }

    out.notes.push(
      "OWNER plan assignment to tenants is blocked in code (billing.service)."
    );
    out.notes.push(
      "No historical UsageRecord backfill — forward only after apply."
    );
    out.notes.push(
      "After review: APPLY=1 node scripts/s25-apply.js then build + pm2 restart sales"
    );
    out.notes.push(
      "Then set BILLING_ENFORCEMENT_ENABLED=true explicitly in production .env"
    );

    console.log(JSON.stringify(out, null, 2));
    if (out.fatal.length) process.exitCode = 1;
  } catch (err) {
    console.error(
      JSON.stringify(
        {
          phase: "S2.5",
          mode: "DRY_RUN",
          error: err instanceof Error ? err.message : String(err),
        },
        null,
        2
      )
    );
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
