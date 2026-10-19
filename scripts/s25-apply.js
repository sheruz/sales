/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * S2.5 APPLY — schema migrate pieces + enforce non-owner orgs + seed feature keys.
 * Refuses unless APPLY=1. Run dry-run first and wait for operator GO.
 *
 * Linux: backup → dry-run → GO → APPLY=1 node scripts/s25-apply.js → build → pm2 restart sales
 */
const { execSync } = require("child_process");
const {
  OWNER_ORG_NAME,
  TEST_TENANT_NAME,
  NEW_FEATURE_KEYS,
  PLAN_FEATURE_DEFAULTS,
  NEW_USAGE_METRICS,
  createPrisma,
  isApply,
  tableExists,
  enumHasValue,
} = require("./s25-lib");

async function ensureEnumValues(prisma) {
  for (const m of NEW_USAGE_METRICS) {
    const has = await enumHasValue(prisma, "UsageMetric", m);
    if (!has) {
      await prisma.$executeRawUnsafe(
        `ALTER TYPE "UsageMetric" ADD VALUE IF NOT EXISTS '${m}'`
      );
      console.log(`Added UsageMetric.${m}`);
    }
  }
}

async function seedFeatures(prisma) {
  const plans = await prisma.plan.findMany({ include: { features: true } });
  let added = 0;
  for (const plan of plans) {
    const defaults =
      PLAN_FEATURE_DEFAULTS[plan.name] ||
      (plan.code === "OWNER" ? PLAN_FEATURE_DEFAULTS.OWNER : {});
    for (const key of NEW_FEATURE_KEYS) {
      const exists = plan.features.some((f) => f.featureKey === key);
      if (exists) continue;
      await prisma.planFeature.create({
        data: {
          planId: plan.id,
          featureKey: key,
          limitValue: defaults[key] ?? null,
          enabled: true,
        },
      });
      added++;
    }
  }
  return added;
}

async function flipEnforcement(prisma) {
  const platformOwnerId = process.env.PLATFORM_OWNER_ORG_ID || null;
  const owner = await prisma.organization.findFirst({
    where: {
      deletedAt: null,
      OR: [
        ...(platformOwnerId ? [{ id: platformOwnerId }] : []),
        { name: OWNER_ORG_NAME },
      ],
    },
  });

  if (owner) {
    await prisma.organization.update({
      where: { id: owner.id },
      data: { billingEnforcementEnabled: false },
    });
  }

  const result = await prisma.organization.updateMany({
    where: {
      deletedAt: null,
      billingEnforcementEnabled: false,
      ...(owner ? { id: { not: owner.id } } : {}),
    },
    data: { billingEnforcementEnabled: true },
  });

  return { ownerId: owner?.id ?? null, flipped: result.count };
}

async function main() {
  if (!isApply()) {
    console.error(
      JSON.stringify(
        {
          error: "Refusing apply. Re-run dry-run, then APPLY=1 node scripts/s25-apply.js after GO.",
          dryRun: "node scripts/s25-dry-run.js",
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  console.log("Running prisma db push / migrate for S2.5 schema…");
  try {
    execSync("npx prisma db push --skip-generate", {
      stdio: "inherit",
      env: process.env,
    });
  } catch (e) {
    console.warn("prisma db push failed — continuing with raw SQL if possible", e.message);
  }

  const prisma = createPrisma();
  try {
    await ensureEnumValues(prisma);
    // db push should create tables; verify
    const hasAuth = await tableExists(prisma, "billing_authorizations");
    const hasOv = await tableExists(prisma, "org_entitlement_overrides");
    if (!hasAuth || !hasOv) {
      throw new Error(
        "billing_authorizations / org_entitlement_overrides missing — run prisma migrate/db push"
      );
    }

    // Default column for new orgs is true in schema; flip existing
    const enforcement = await flipEnforcement(prisma);
    const featuresAdded = await seedFeatures(prisma);

    // Mark OWNER plan private if possible
    await prisma.plan.updateMany({
      where: { OR: [{ code: "OWNER" }, { name: "OWNER" }] },
      data: { visibility: "PRIVATE" },
    });

    console.log(
      JSON.stringify(
        {
          phase: "S2.5",
          mode: "APPLY",
          ok: true,
          enforcement,
          featuresAdded,
          testTenantName: TEST_TENANT_NAME,
          next: [
            "npm run build",
            "pm2 restart sales",
            "Set BILLING_ENFORCEMENT_ENABLED=true in production .env",
          ],
        },
        null,
        2
      )
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
