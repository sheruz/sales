/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * S2 APPLY — schema + seed prices + Test Tenant (50 credits, enforcement ON).
 * Refuses unless APPLY=1.
 *
 *   node scripts/s2-apply-dry-run.js
 *   APPLY=1 node scripts/s2-apply.js
 *
 * Optional: S2_APPLY_PHASE=schema|data|all (default all)
 */
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { randomUUID } = require("crypto");
const { spawnSync } = require("child_process");
const path = require("path");
const {
  createPrisma,
  isApply,
  OWNER_ORG_NAME,
  TEST_TENANT_NAME,
  TEST_TENANT_STARTING_CREDITS,
  TEST_TENANT_EMAIL,
  DEFAULT_CREDIT_PRICES,
  maskEmail,
  tableExists,
} = require("./s2-lib");

const APPLY = isApply();
const PHASE = (process.env.S2_APPLY_PHASE || "all").toLowerCase();
const rootDir = path.join(__dirname, "..");

async function seedPrices(prisma) {
  let upserted = 0;
  for (const p of DEFAULT_CREDIT_PRICES) {
    for (const keyMode of ["BYOK", "MANAGED"]) {
      const credits = keyMode === "BYOK" ? p.byok : p.managed;
      await prisma.creditPrice.upsert({
        where: {
          actionType_keyMode: { actionType: p.actionType, keyMode },
        },
        create: {
          id: randomUUID(),
          actionType: p.actionType,
          keyMode,
          credits,
          active: true,
        },
        update: { credits, active: true },
      });
      upserted++;
    }
  }
  return upserted;
}

async function ensureStarterPlanCredits(prisma) {
  let updated = 0;
  // S1 may have created STARTER as DRAFT — enable monthly credits
  let starter = await prisma.plan.findFirst({
    where: {
      OR: [
        { code: "STARTER" },
        { name: { equals: "Starter", mode: "insensitive" } },
      ],
    },
  });
  if (!starter) {
    starter = await prisma.plan.create({
      data: {
        id: randomUUID(),
        name: "Starter",
        code: "STARTER",
        description: "S2 starter plan (50 monthly credits)",
        price: 49,
        currency: "USD",
        billingInterval: "MONTHLY",
        active: true,
        isDefault: false,
        sortOrder: 10,
        visibility: "PUBLIC",
        monthlyCredits: 50,
        creditRolloverEnabled: false,
      },
    });
    updated++;
  } else if (starter.monthlyCredits == null) {
    starter = await prisma.plan.update({
      where: { id: starter.id },
      data: {
        monthlyCredits: 50,
        creditRolloverEnabled: false,
        active: true,
        visibility: "PUBLIC",
      },
    });
    updated++;
  }

  const agency = await prisma.plan.findFirst({
    where: {
      OR: [
        { code: "AGENCY" },
        { name: { equals: "Agency", mode: "insensitive" } },
      ],
    },
  });
  if (agency && agency.monthlyCredits == null) {
    await prisma.plan.update({
      where: { id: agency.id },
      data: { monthlyCredits: 500, creditRolloverEnabled: false },
    });
    updated++;
  }

  return { updated, starterPlanId: starter.id };
}

async function ensureTestTenant(prisma, starterPlanId) {
  let org = await prisma.organization.findFirst({
    where: { name: TEST_TENANT_NAME, deletedAt: null },
  });
  const created = !org;
  if (!org) {
    org = await prisma.organization.create({
      data: {
        id: randomUUID(),
        name: TEST_TENANT_NAME,
        slug: `test-tenant-${randomUUID().slice(0, 8)}`,
        creditBalanceCached: 0,
        billingEnforcementEnabled: true,
      },
    });
  } else {
    await prisma.organization.update({
      where: { id: org.id },
      data: { billingEnforcementEnabled: true },
    });
  }

  await prisma.subscription.upsert({
    where: { organizationId: org.id },
    create: {
      id: randomUUID(),
      organizationId: org.id,
      planId: starterPlanId,
      status: "ACTIVE",
      provider: "manual",
    },
    update: { planId: starterPlanId, status: "ACTIVE" },
  });

  const role = await prisma.role.findFirst({
    where: { key: "OWNER", scope: "ORGANIZATION" },
  });
  if (!role) {
    throw new Error("ORGANIZATION OWNER role missing — run S1 seed/roles first");
  }

  const passwordPlain = `Tt-${crypto.randomBytes(9).toString("base64url")}!`;
  const passwordHash = await bcrypt.hash(passwordPlain, 12);

  let user = await prisma.user.findUnique({
    where: { email: TEST_TENANT_EMAIL },
  });
  let passwordPrinted = false;
  if (!user) {
    user = await prisma.user.create({
      data: {
        id: randomUUID(),
        email: TEST_TENANT_EMAIL,
        firstName: "Test",
        lastName: "Tenant",
        passwordHash,
        role: "ADMIN",
        isActive: true,
      },
    });
    console.error(
      "\n========== TEST TENANT PASSWORD (copy now; not stored in JSON) =========="
    );
    console.error(`email=${TEST_TENANT_EMAIL}`);
    console.error(`password=${passwordPlain}`);
    console.error(
      "=========================================================================\n"
    );
    passwordPrinted = true;
  }

  const membership = await prisma.organizationUser.findFirst({
    where: { organizationId: org.id, userId: user.id },
  });
  if (!membership) {
    await prisma.organizationUser.create({
      data: {
        id: randomUUID(),
        organizationId: org.id,
        userId: user.id,
        roleId: role.id,
        status: "ACTIVE",
      },
    });
  }

  const grantKey = `s2_test_tenant_start:${org.id}`;
  const existingGrant = await prisma.creditLedgerEntry.findUnique({
    where: { idempotencyKey: grantKey },
  });
  let granted = 0;
  if (!existingGrant) {
    const bal = TEST_TENANT_STARTING_CREDITS;
    await prisma.organization.update({
      where: { id: org.id },
      data: {
        creditBalanceCached: bal,
        billingEnforcementEnabled: true,
      },
    });
    await prisma.creditLedgerEntry.create({
      data: {
        id: randomUUID(),
        organizationId: org.id,
        type: "GRANT_MANUAL",
        amount: bal,
        balanceAfter: bal,
        idempotencyKey: grantKey,
        reason: "s2_test_tenant_starting_grant",
      },
    });
    granted = bal;
  } else {
    await prisma.organization.update({
      where: { id: org.id },
      data: { billingEnforcementEnabled: true },
    });
  }

  const platformOwner = process.env.PLATFORM_OWNER_ORG_ID;
  if (platformOwner && platformOwner === org.id) {
    throw new Error(
      "FATAL: Test Tenant id equals PLATFORM_OWNER_ORG_ID — refuse (no platform keys)"
    );
  }

  return {
    orgId: org.id,
    created,
    email: maskEmail(TEST_TENANT_EMAIL),
    granted,
    passwordPrinted,
    billingEnforcementEnabled: true,
    platformKeys: false,
  };
}

async function ownerGuard(prisma) {
  const owner = await prisma.organization.findFirst({
    where: { name: OWNER_ORG_NAME, deletedAt: null },
  });
  if (!owner) return { ok: false, reason: "owner_missing" };
  if (owner.billingEnforcementEnabled) {
    await prisma.organization.update({
      where: { id: owner.id },
      data: { billingEnforcementEnabled: false },
    });
  }
  return {
    ok: true,
    orgId: owner.id,
    billingEnforcementEnabled: false,
    note: "OWNER enforcement forced off — never consume/block",
  };
}

async function dataPhase() {
  const prisma = createPrisma();
  const summary = {
    meta: {
      phase: "s2-apply",
      mode: "APPLY",
      applyPhase: "data",
      at: new Date().toISOString(),
    },
    steps: {},
  };
  try {
    if (!(await tableExists(prisma, "credit_ledger_entries"))) {
      throw new Error("credit_ledger_entries missing — run schema phase first");
    }
    summary.steps.seedPrices = { upserted: await seedPrices(prisma) };
    summary.steps.plans = await ensureStarterPlanCredits(prisma);
    summary.steps.ownerGuard = await ownerGuard(prisma);
    summary.steps.testTenant = await ensureTestTenant(
      prisma,
      summary.steps.plans.starterPlanId
    );
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  if (!APPLY) {
    console.error(
      JSON.stringify(
        {
          error: "Refusing to APPLY without APPLY=1",
          hint: "Review: node scripts/s2-apply-dry-run.js",
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  if (PHASE === "data") {
    await dataPhase();
    return;
  }

  if (PHASE === "all" || PHASE === "schema") {
    console.log("=== S2 APPLY: schema migrate ===");
    const mig = spawnSync(process.execPath, ["scripts/s2-schema-migrate.js"], {
      cwd: rootDir,
      env: { ...process.env, APPLY: "1" },
      stdio: "inherit",
    });
    if (mig.status !== 0) process.exit(mig.status ?? 1);

    console.log("=== S2 APPLY: prisma generate ===");
    const gen = spawnSync(
      process.execPath,
      ["scripts/prisma-cli.js", "generate"],
      {
        cwd: rootDir,
        env: process.env,
        stdio: "inherit",
      }
    );
    if (gen.status !== 0) process.exit(gen.status ?? 1);
  }

  if (PHASE === "schema") {
    console.log(
      JSON.stringify(
        { meta: { phase: "s2-apply", applyPhase: "schema", ok: true } },
        null,
        2
      )
    );
    return;
  }

  console.log("=== S2 APPLY: data phase (fresh Prisma client) ===");
  const data = spawnSync(process.execPath, ["scripts/s2-apply.js"], {
    cwd: rootDir,
    env: { ...process.env, APPLY: "1", S2_APPLY_PHASE: "data" },
    stdio: "inherit",
  });
  process.exit(data.status ?? 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
