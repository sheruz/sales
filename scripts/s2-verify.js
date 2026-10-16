/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * S2 post-APPLY verify (read-mostly).
 *
 *   node scripts/s2-verify.js
 */
const {
  createPrisma,
  OWNER_ORG_NAME,
  TEST_TENANT_NAME,
  TEST_TENANT_STARTING_CREDITS,
  tableExists,
  columnExists,
  enumExists,
} = require("./s2-lib");

async function main() {
  const prisma = createPrisma();
  const checks = [];
  const pass = (name, ok, detail) => checks.push({ name, ok, detail });

  try {
    pass("enum_CreditLedgerType", await enumExists(prisma, "CreditLedgerType"));
    pass("enum_CreditKeyMode", await enumExists(prisma, "CreditKeyMode"));
    pass("table_credit_prices", await tableExists(prisma, "credit_prices"));
    pass(
      "table_credit_ledger_entries",
      await tableExists(prisma, "credit_ledger_entries")
    );
    pass(
      "col_credit_balance_cached",
      await columnExists(prisma, "organizations", "credit_balance_cached")
    );
    pass(
      "col_billing_enforcement",
      await columnExists(
        prisma,
        "organizations",
        "billing_enforcement_enabled"
      )
    );

    const priceCount = await prisma.creditPrice.count();
    pass("credit_prices_seeded", priceCount >= 8, { priceCount });

    const owner = await prisma.organization.findFirst({
      where: { name: OWNER_ORG_NAME, deletedAt: null },
    });
    pass("owner_exists", !!owner, { id: owner?.id });
    pass(
      "owner_enforcement_off",
      owner ? owner.billingEnforcementEnabled === false : false
    );

    const test = await prisma.organization.findFirst({
      where: { name: TEST_TENANT_NAME, deletedAt: null },
    });
    pass("test_tenant_exists", !!test, { id: test?.id });
    pass(
      "test_tenant_enforcement_on",
      test ? test.billingEnforcementEnabled === true : false
    );
    pass(
      "test_tenant_credits",
      test
        ? test.creditBalanceCached >= TEST_TENANT_STARTING_CREDITS ||
            test.creditBalanceCached >= 0
        : false,
      { balance: test?.creditBalanceCached }
    );

    if (
      process.env.PLATFORM_OWNER_ORG_ID &&
      test &&
      process.env.PLATFORM_OWNER_ORG_ID === test.id
    ) {
      pass("test_tenant_not_platform_keys", false, {
        error: "Test Tenant == PLATFORM_OWNER_ORG_ID",
      });
    } else {
      pass("test_tenant_not_platform_keys", true);
    }

    pass(
      "global_enforcement_off",
      process.env.BILLING_ENFORCEMENT_ENABLED !== "true",
      { value: process.env.BILLING_ENFORCEMENT_ENABLED ?? "unset" }
    );

    const ok = checks.every((c) => c.ok);
    console.log(
      JSON.stringify(
        {
          meta: { phase: "s2-verify", at: new Date().toISOString() },
          ok,
          checks,
        },
        null,
        2
      )
    );
    if (!ok) process.exitCode = 2;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
