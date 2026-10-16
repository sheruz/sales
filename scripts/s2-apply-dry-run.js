/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * S2 APPLY preview (READ-ONLY) — what APPLY would do.
 *
 *   node scripts/s2-apply-dry-run.js
 */
const { execSync } = require("child_process");
const path = require("path");
const {
  readOnlyPrisma,
  OWNER_ORG_NAME,
  TEST_TENANT_NAME,
  TEST_TENANT_STARTING_CREDITS,
  TEST_TENANT_EMAIL,
  DEFAULT_CREDIT_PRICES,
  maskEmail,
  tableExists,
  columnExists,
} = require("./s2-lib");

async function main() {
  const dry = execSync(`node "${path.join(__dirname, "s2-dry-run.js")}"`, {
    encoding: "utf8",
    env: process.env,
  });
  const start = dry.indexOf("{");
  const dryJson = JSON.parse(dry.slice(start));

  const prisma = readOnlyPrisma();
  try {
    const hasLedger = await tableExists(prisma, "credit_ledger_entries");
    const hasPrices = await tableExists(prisma, "credit_prices");
    const hasBal = await columnExists(
      prisma,
      "organizations",
      "credit_balance_cached"
    );

    const owner = await prisma.organization.findFirst({
      where: { name: OWNER_ORG_NAME, deletedAt: null },
      select: { id: true, name: true },
    });
    const testTenant = await prisma.organization.findFirst({
      where: { name: TEST_TENANT_NAME, deletedAt: null },
      select: { id: true, name: true },
    });

    const steps = [
      {
        step: 1,
        name: "schema_migrate",
        action: "APPLY=1 node scripts/s2-schema-migrate.js",
        needed: dryJson.proposal?.schemaMigrate !== false,
      },
      {
        step: 2,
        name: "prisma_generate",
        action: "npx prisma generate",
        needed: true,
      },
      {
        step: 3,
        name: "seed_credit_prices",
        action: "upsert DEFAULT_CREDIT_PRICES (BYOK + MANAGED)",
        needed: true,
        rows: DEFAULT_CREDIT_PRICES.length * 2,
      },
      {
        step: 4,
        name: "ensure_starter_plan_monthly_credits",
        action: "set monthlyCredits=50 on public starter-like plans if null",
        needed: true,
      },
      {
        step: 5,
        name: "create_or_update_test_tenant",
        action: testTenant
          ? `ensure ${TEST_TENANT_NAME} balance=${TEST_TENANT_STARTING_CREDITS}, enforcement=true`
          : `create ${TEST_TENANT_NAME} + user ${maskEmail(TEST_TENANT_EMAIL)} + grant ${TEST_TENANT_STARTING_CREDITS}`,
        needed: true,
        existingId: testTenant?.id ?? null,
      },
      {
        step: 6,
        name: "owner_guard",
        action: `NEVER set billingEnforcementEnabled on ${OWNER_ORG_NAME}`,
        ownerId: owner?.id ?? null,
        needed: true,
      },
      {
        step: 7,
        name: "reconcile_check",
        action: "node scripts/s2-reconcile.js",
        needed: hasLedger && hasBal,
      },
    ];

    const out = {
      meta: {
        phase: "s2-apply-dry-run",
        mode: "READ_ONLY_PREVIEW",
        at: new Date().toISOString(),
        note: "No writes. Review then: APPLY=1 node scripts/s2-apply.js",
      },
      dryRunSummary: {
        schemaReady: dryJson.schema,
        owner: dryJson.owner,
        testTenant: dryJson.testTenant,
        priceCount: dryJson.creditPrices?.count,
        ledgerCount: dryJson.ledgerEntries?.count,
        env: dryJson.env,
      },
      applySteps: steps,
      safety: {
        globalBillingEnforcementMustStayFalse: true,
        ownerNeverEnforced: true,
        testTenantNoPlatformKeys: true,
        passwordPrintedOnceToStderrOnly: true,
        hasPricesTable: hasPrices,
      },
    };
    console.log(JSON.stringify(out, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
