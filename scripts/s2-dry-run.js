/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * S2 dry-run (READ-ONLY) — schema readiness, owner org, credit prices, proposal.
 *
 *   node scripts/s2-dry-run.js
 *   node scripts/run-with-env.js node scripts/s2-dry-run.js
 */
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
  enumExists,
} = require("./s2-lib");

async function main() {
  const prisma = readOnlyPrisma();
  try {
    const schema = {
      CreditLedgerType: await enumExists(prisma, "CreditLedgerType"),
      CreditKeyMode: await enumExists(prisma, "CreditKeyMode"),
      credit_prices: await tableExists(prisma, "credit_prices"),
      credit_ledger_entries: await tableExists(prisma, "credit_ledger_entries"),
      org_credit_balance_cached: await columnExists(
        prisma,
        "organizations",
        "credit_balance_cached"
      ),
      org_billing_enforcement_enabled: await columnExists(
        prisma,
        "organizations",
        "billing_enforcement_enabled"
      ),
      plans_monthly_credits: await columnExists(
        prisma,
        "plans",
        "monthly_credits"
      ),
    };

    let owner = null;
    try {
      owner = await prisma.organization.findFirst({
        where: { name: OWNER_ORG_NAME, deletedAt: null },
        select: { id: true, name: true },
      });
      if (owner && schema.org_credit_balance_cached) {
        const rows = await prisma.$queryRawUnsafe(
          `SELECT credit_balance_cached, billing_enforcement_enabled
           FROM organizations WHERE id = $1`,
          owner.id
        );
        if (rows[0]) {
          owner = {
            ...owner,
            creditBalanceCached: rows[0].credit_balance_cached,
            billingEnforcementEnabled: rows[0].billing_enforcement_enabled,
          };
        }
      }
    } catch (e) {
      owner = {
        error: e instanceof Error ? e.message : String(e),
      };
    }

    let ownerPlan = null;
    if (owner?.id) {
      try {
        const sub = await prisma.subscription.findUnique({
          where: { organizationId: owner.id },
          include: { plan: { select: { id: true, code: true, name: true } } },
        });
        let monthlyCredits = null;
        if (sub && schema.plans_monthly_credits) {
          const rows = await prisma.$queryRawUnsafe(
            `SELECT monthly_credits FROM plans WHERE id = $1`,
            sub.planId
          );
          monthlyCredits = rows[0]?.monthly_credits ?? null;
        }
        ownerPlan = sub
          ? {
              planCode: sub.plan.code,
              planName: sub.plan.name,
              monthlyCredits,
              status: sub.status,
            }
          : null;
      } catch {
        ownerPlan = null;
      }
    }

    let testTenant = null;
    try {
      testTenant = await prisma.organization.findFirst({
        where: { name: TEST_TENANT_NAME, deletedAt: null },
        select: { id: true, name: true },
      });
      if (testTenant && schema.org_credit_balance_cached) {
        const rows = await prisma.$queryRawUnsafe(
          `SELECT credit_balance_cached, billing_enforcement_enabled
           FROM organizations WHERE id = $1`,
          testTenant.id
        );
        if (rows[0]) {
          testTenant = {
            ...testTenant,
            creditBalanceCached: rows[0].credit_balance_cached,
            billingEnforcementEnabled: rows[0].billing_enforcement_enabled,
          };
        }
      }
    } catch {
      testTenant = null;
    }

    let priceCount = 0;
    if (schema.credit_prices) {
      try {
        const rows = await prisma.$queryRawUnsafe(
          `SELECT COUNT(*)::int AS c FROM credit_prices`
        );
        priceCount = rows[0]?.c ?? 0;
      } catch {
        priceCount = 0;
      }
    }

    let ledgerCount = 0;
    if (schema.credit_ledger_entries) {
      try {
        const rows = await prisma.$queryRawUnsafe(
          `SELECT COUNT(*)::int AS c FROM credit_ledger_entries`
        );
        ledgerCount = rows[0]?.c ?? 0;
      } catch {
        ledgerCount = 0;
      }
    }

    const platformOwnerOrgId = process.env.PLATFORM_OWNER_ORG_ID || null;
    const ownerIsPlatformKeys =
      owner && platformOwnerOrgId
        ? owner.id === platformOwnerOrgId
        : owner
          ? "PLATFORM_OWNER_ORG_ID unset — set to Default Workspace id after APPLY"
          : null;

    const proposal = {
      schemaMigrate: !Object.values(schema).every(Boolean),
      seedCreditPrices: priceCount < DEFAULT_CREDIT_PRICES.length,
      createTestTenant: !testTenant,
      testTenantStartingCredits: TEST_TENANT_STARTING_CREDITS,
      testTenantEmail: maskEmail(TEST_TENANT_EMAIL),
      testTenantEnforcement: true,
      testTenantPlatformKeys: false,
      neverTouchOwnerEnforcement: true,
      ownerOrgName: OWNER_ORG_NAME,
      reserveTtlMinutes: Number(process.env.CREDIT_RESERVE_TTL_MINUTES || 15),
      globalBillingEnforcement:
        process.env.BILLING_ENFORCEMENT_ENABLED === "true",
      note: "Global BILLING_ENFORCEMENT_ENABLED must stay false; Test Tenant uses per-org flag.",
    };

    const out = {
      meta: {
        phase: "s2-dry-run",
        mode: "READ_ONLY",
        at: new Date().toISOString(),
      },
      schema,
      owner: owner
        ? {
            id: owner.id,
            name: owner.name,
            creditBalanceCached: owner.creditBalanceCached ?? null,
            billingEnforcementEnabled:
              owner.billingEnforcementEnabled ?? null,
            plan: ownerPlan,
            isPlatformKeyOrg: ownerIsPlatformKeys,
          }
        : null,
      testTenant: testTenant
        ? {
            id: testTenant.id,
            name: testTenant.name,
            creditBalanceCached: testTenant.creditBalanceCached ?? null,
            billingEnforcementEnabled:
              testTenant.billingEnforcementEnabled ?? null,
          }
        : null,
      creditPrices: { count: priceCount, defaults: DEFAULT_CREDIT_PRICES },
      ledgerEntries: { count: ledgerCount },
      env: {
        BILLING_METERING_ENABLED:
          process.env.BILLING_METERING_ENABLED !== "false",
        BILLING_ENFORCEMENT_ENABLED:
          process.env.BILLING_ENFORCEMENT_ENABLED === "true",
        CREDIT_RESERVE_TTL_MINUTES: Number(
          process.env.CREDIT_RESERVE_TTL_MINUTES || 15
        ),
        PLATFORM_OWNER_ORG_ID: platformOwnerOrgId
          ? `${platformOwnerOrgId.slice(0, 8)}…`
          : null,
      },
      proposal,
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
