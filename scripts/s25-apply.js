/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * S2.5 APPLY — schema migrate pieces + enforce non-owner orgs + seed feature keys.
 * Refuses unless APPLY=1. Run dry-run first and wait for operator GO.
 *
 * Linux: backup → dry-run → GO → APPLY=1 node scripts/s25-apply.js → build → pm2 restart sales
 */
const fs = require("fs");
const path = require("path");
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

async function applySchemaSql(prisma) {
  const sqlPath = path.join(__dirname, "s25-schema.sql");
  const sql = fs.readFileSync(sqlPath, "utf8");
  // Split on semicolons carefully — our file uses DO $$ blocks with inner ;
  await prisma.$executeRawUnsafe(sql);
}

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
      (plan.code ? PLAN_FEATURE_DEFAULTS[plan.code] : null) ||
      (plan.code === "OWNER" || plan.name === "OWNER"
        ? PLAN_FEATURE_DEFAULTS.OWNER
        : {}) ||
      {};
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
  // GO APPLY default: proceed — enforce all non-owner orgs (incl. Malick at 0 credits).
  // Set EXCLUDE_ORG_NAMES=Malick to skip, or GRANT_ORG_CREDITS=Malick:50 to grant then enforce.
  const excludeNames = new Set(
    String(process.env.EXCLUDE_ORG_NAMES || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
  const grantSpecs = String(process.env.GRANT_ORG_CREDITS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((pair) => {
      const [name, n] = pair.split(":");
      return { name: name?.trim(), credits: Number(n) };
    })
    .filter((g) => g.name && Number.isFinite(g.credits) && g.credits > 0);

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

  for (const g of grantSpecs) {
    const org = await prisma.organization.findFirst({
      where: { name: g.name, deletedAt: null },
    });
    if (!org) continue;
    const bal = (org.creditBalanceCached ?? 0) + g.credits;
    await prisma.organization.update({
      where: { id: org.id },
      data: { creditBalanceCached: bal },
    });
    const { randomUUID } = require("crypto");
    await prisma.creditLedgerEntry.create({
      data: {
        id: randomUUID(),
        organizationId: org.id,
        type: "GRANT_MANUAL",
        amount: g.credits,
        balanceAfter: bal,
        idempotencyKey: `s25_grant:${org.id}:${g.credits}:${new Date().toISOString().slice(0, 10)}`,
        reason: "s25_apply_grant",
      },
    });
    console.log(`Granted ${g.credits} credits to ${g.name} (balance=${bal})`);
  }

  const toFlip = await prisma.organization.findMany({
    where: {
      deletedAt: null,
      billingEnforcementEnabled: false,
      ...(owner ? { id: { not: owner.id } } : {}),
    },
    select: { id: true, name: true, creditBalanceCached: true },
  });

  const flippedNames = [];
  const skippedNames = [];
  for (const org of toFlip) {
    if (excludeNames.has(org.name)) {
      skippedNames.push(org.name);
      continue;
    }
    await prisma.organization.update({
      where: { id: org.id },
      data: { billingEnforcementEnabled: true },
    });
    flippedNames.push({
      name: org.name,
      creditBalanceCached: org.creditBalanceCached,
    });
  }

  return {
    ownerId: owner?.id ?? null,
    flipped: flippedNames.length,
    flippedNames,
    skippedNames,
  };
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

  const prisma = createPrisma();
  try {
    console.log("Applying S2.5 additive SQL (s25-schema.sql)…");
    try {
      await applySchemaSql(prisma);
    } catch (e) {
      console.warn("s25-schema.sql partial error (may already exist):", e.message);
    }
    await ensureEnumValues(prisma);

    // Optional full push — off by default (hits unrelated index drift on prod).
    if (process.env.S25_DB_PUSH === "1") {
      console.log("S25_DB_PUSH=1 — running prisma db push…");
      try {
        execSync("npx prisma db push --skip-generate --accept-data-loss", {
          stdio: "inherit",
          env: process.env,
        });
      } catch (e) {
        console.warn("prisma db push failed:", e.message);
      }
    }

    const hasAuth = await tableExists(prisma, "billing_authorizations");
    const hasOv = await tableExists(prisma, "org_entitlement_overrides");
    if (!hasAuth || !hasOv) {
      throw new Error(
        "billing_authorizations / org_entitlement_overrides missing after s25-schema.sql"
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
