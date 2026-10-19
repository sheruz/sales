/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Post-apply check for S2.5 (read-only).
 */
const {
  OWNER_ORG_NAME,
  TEST_TENANT_NAME,
  NEW_FEATURE_KEYS,
  readOnlyPrisma,
  tableExists,
  enumHasValue,
  NEW_USAGE_METRICS,
} = require("./s25-lib");

async function main() {
  const prisma = readOnlyPrisma();
  const platformOwnerId = process.env.PLATFORM_OWNER_ORG_ID || null;
  const out = { phase: "S2.5", mode: "VERIFY", ok: true, checks: [], warnings: [] };

  try {
    const hasAuth = await tableExists(prisma, "billing_authorizations");
    const hasOv = await tableExists(prisma, "org_entitlement_overrides");
    out.checks.push({ billing_authorizations: hasAuth });
    out.checks.push({ org_entitlement_overrides: hasOv });
    if (!hasAuth || !hasOv) out.ok = false;

    for (const m of NEW_USAGE_METRICS) {
      const has = await enumHasValue(prisma, "UsageMetric", m);
      out.checks.push({ [`UsageMetric.${m}`]: has });
      if (!has) out.ok = false;
    }

    const owner = await prisma.organization.findFirst({
      where: {
        deletedAt: null,
        OR: [
          ...(platformOwnerId ? [{ id: platformOwnerId }] : []),
          { name: OWNER_ORG_NAME },
        ],
      },
      select: { id: true, name: true, billingEnforcementEnabled: true },
    });
    out.checks.push({
      ownerExempt: owner
        ? owner.billingEnforcementEnabled === false
        : false,
      owner,
    });
    if (owner?.billingEnforcementEnabled) out.ok = false;

    const test = await prisma.organization.findFirst({
      where: { name: TEST_TENANT_NAME, deletedAt: null },
      select: {
        id: true,
        billingEnforcementEnabled: true,
        creditBalanceCached: true,
      },
    });
    out.checks.push({
      testTenantEnforced: test?.billingEnforcementEnabled === true,
      test,
    });

    const malick = await prisma.organization.findFirst({
      where: { name: "Malick", deletedAt: null },
      select: {
        billingEnforcementEnabled: true,
        creditBalanceCached: true,
      },
    });
    out.checks.push({ malick });

    const plans = await prisma.plan.findMany({
      include: { features: { where: { featureKey: { in: NEW_FEATURE_KEYS } } } },
    });
    out.featureSeed = plans.map((p) => ({
      name: p.name,
      seededKeys: p.features.map((f) => f.featureKey),
      missing: NEW_FEATURE_KEYS.filter(
        (k) => !p.features.some((f) => f.featureKey === k)
      ),
    }));
    if (out.featureSeed.some((p) => p.missing.length)) {
      out.warnings.push("Some plans missing new feature keys");
    }

    console.log(JSON.stringify(out, null, 2));
    process.exitCode = out.ok ? 0 : 1;
  } catch (err) {
    console.error(
      JSON.stringify({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      })
    );
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
