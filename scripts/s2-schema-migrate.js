/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * S2 additive schema migrate (idempotent).
 * Default: DRY_RUN. APPLY=1 to execute.
 *
 *   node scripts/s2-schema-migrate.js
 *   APPLY=1 node scripts/s2-schema-migrate.js
 */
const {
  createPrisma,
  isApply,
  tableExists,
  columnExists,
  enumExists,
  enumHasValue,
} = require("./s2-lib");

const APPLY = isApply();

async function ensureEnum(client, name, values) {
  if (!(await enumExists(client, name))) {
    console.log(`  CREATE TYPE ${name}`);
    if (APPLY) {
      const list = values.map((v) => `'${v}'`).join(", ");
      await client.$executeRawUnsafe(`CREATE TYPE "${name}" AS ENUM (${list})`);
    }
    return;
  }
  console.log(`  skip enum ${name} (exists)`);
  for (const v of values) {
    if (await enumHasValue(client, name, v)) {
      console.log(`  skip enum value ${name}.${v}`);
      continue;
    }
    console.log(`  ADD VALUE ${name}.${v}`);
    if (APPLY) {
      await client.$executeRawUnsafe(
        `ALTER TYPE "${name}" ADD VALUE IF NOT EXISTS '${v}'`
      );
    }
  }
}

async function ensureColumn(client, table, column, ddl) {
  if (await columnExists(client, table, column)) {
    console.log(`  skip column ${table}.${column}`);
    return;
  }
  console.log(`  ADD COLUMN ${table}.${column}`);
  if (APPLY) {
    await client.$executeRawUnsafe(`ALTER TABLE "${table}" ADD COLUMN ${ddl}`);
  }
}

async function ensureTable(client, name, createSql) {
  if (await tableExists(client, name)) {
    console.log(`  skip table ${name}`);
    return;
  }
  console.log(`  CREATE TABLE ${name}`);
  if (APPLY) {
    await client.$executeRawUnsafe(createSql);
  }
}

async function ensureIndex(client, name, sql) {
  const rows = await client.$queryRawUnsafe(
    `SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = $1 LIMIT 1`,
    name
  );
  if (Array.isArray(rows) && rows.length > 0) {
    console.log(`  skip index ${name}`);
    return;
  }
  console.log(`  CREATE INDEX ${name}`);
  if (APPLY) {
    await client.$executeRawUnsafe(sql);
  }
}

async function main() {
  const prisma = createPrisma();
  console.log(
    JSON.stringify(
      { mode: APPLY ? "APPLY" : "DRY_RUN", phase: "s2-schema" },
      null,
      2
    )
  );
  try {
    await ensureEnum(prisma, "CreditLedgerType", [
      "GRANT_PLAN",
      "GRANT_MANUAL",
      "PURCHASE",
      "CONSUME",
      "RESERVE",
      "COMMIT",
      "REFUND",
      "EXPIRE",
      "ADJUST",
    ]);
    await ensureEnum(prisma, "CreditKeyMode", ["BYOK", "MANAGED"]);

    await ensureColumn(
      prisma,
      "organizations",
      "credit_balance_cached",
      `"credit_balance_cached" INTEGER NOT NULL DEFAULT 0`
    );
    await ensureColumn(
      prisma,
      "organizations",
      "billing_enforcement_enabled",
      `"billing_enforcement_enabled" BOOLEAN NOT NULL DEFAULT false`
    );
    await ensureColumn(
      prisma,
      "organizations",
      "credits_warned_at_20",
      `"credits_warned_at_20" TIMESTAMP(3)`
    );
    await ensureColumn(
      prisma,
      "organizations",
      "credits_warned_at_5",
      `"credits_warned_at_5" TIMESTAMP(3)`
    );
    await ensureColumn(
      prisma,
      "organizations",
      "credits_warned_at_0",
      `"credits_warned_at_0" TIMESTAMP(3)`
    );

    await ensureColumn(
      prisma,
      "plans",
      "monthly_credits",
      `"monthly_credits" INTEGER`
    );
    await ensureColumn(
      prisma,
      "plans",
      "credit_rollover_enabled",
      `"credit_rollover_enabled" BOOLEAN NOT NULL DEFAULT false`
    );
    await ensureColumn(
      prisma,
      "plans",
      "credit_rollover_cap",
      `"credit_rollover_cap" INTEGER`
    );

    await ensureTable(
      prisma,
      "credit_prices",
      `CREATE TABLE "credit_prices" (
        "id" TEXT PRIMARY KEY,
        "action_type" TEXT NOT NULL,
        "key_mode" "CreditKeyMode" NOT NULL DEFAULT 'BYOK',
        "credits" INTEGER NOT NULL,
        "active" BOOLEAN NOT NULL DEFAULT true,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "credit_prices_action_type_key_mode_key"
          UNIQUE ("action_type", "key_mode")
      )`
    );
    await ensureIndex(
      prisma,
      "credit_prices_action_type_idx",
      `CREATE INDEX "credit_prices_action_type_idx" ON "credit_prices" ("action_type")`
    );

    await ensureTable(
      prisma,
      "credit_ledger_entries",
      `CREATE TABLE "credit_ledger_entries" (
        "id" TEXT PRIMARY KEY,
        "organization_id" TEXT NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
        "type" "CreditLedgerType" NOT NULL,
        "amount" INTEGER NOT NULL,
        "balance_after" INTEGER NOT NULL,
        "action_type" TEXT,
        "reference_type" TEXT,
        "reference_id" TEXT,
        "idempotency_key" TEXT NOT NULL,
        "reserve_idempotency_key" TEXT,
        "actor_user_id" TEXT,
        "reason" TEXT,
        "metadata" JSONB,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "credit_ledger_entries_idempotency_key_key" UNIQUE ("idempotency_key")
      )`
    );
    await ensureIndex(
      prisma,
      "credit_ledger_entries_organization_id_created_at_idx",
      `CREATE INDEX "credit_ledger_entries_organization_id_created_at_idx"
       ON "credit_ledger_entries" ("organization_id", "created_at")`
    );
    await ensureIndex(
      prisma,
      "credit_ledger_entries_organization_id_type_idx",
      `CREATE INDEX "credit_ledger_entries_organization_id_type_idx"
       ON "credit_ledger_entries" ("organization_id", "type")`
    );
    await ensureIndex(
      prisma,
      "credit_ledger_entries_reserve_idempotency_key_idx",
      `CREATE INDEX "credit_ledger_entries_reserve_idempotency_key_idx"
       ON "credit_ledger_entries" ("reserve_idempotency_key")`
    );
    await ensureIndex(
      prisma,
      "credit_ledger_entries_reference_type_reference_id_idx",
      `CREATE INDEX "credit_ledger_entries_reference_type_reference_id_idx"
       ON "credit_ledger_entries" ("reference_type", "reference_id")`
    );

    console.log(
      JSON.stringify(
        {
          mode: APPLY ? "APPLY" : "DRY_RUN",
          phase: "s2-schema",
          ok: true,
          note: APPLY
            ? "DDL applied (idempotent)"
            : "No writes. Re-run with APPLY=1 to execute.",
        },
        null,
        2
      )
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
