/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * B3.2 apply — idempotent schema + backfill billing emails + fix shared Paddle customers.
 * Requires APPLY=1.
 */
const {
  createPrisma,
  inspectB32Schema,
  verifyB32,
  isApply,
  tableExists,
  columnExists,
} = require("./b3-2-lib");

async function ensureColumn(client, table, column, ddl, log) {
  if (await columnExists(client, table, column)) {
    log.push(`skip ${table}.${column}`);
    return;
  }
  await client.$executeRawUnsafe(`ALTER TABLE "${table}" ADD COLUMN ${ddl}`);
  log.push(`ADD ${table}.${column}`);
}

async function ensureTable(client, name, sql, log) {
  if (await tableExists(client, name)) {
    log.push(`skip table ${name}`);
    return;
  }
  await client.$executeRawUnsafe(sql);
  log.push(`CREATE TABLE ${name}`);
}

async function ensureEnumValue(client, enumName, value, log) {
  try {
    await client.$executeRawUnsafe(
      `ALTER TYPE "${enumName}" ADD VALUE IF NOT EXISTS '${value}'`
    );
    log.push(`ENUM ${enumName} += ${value}`);
  } catch (e) {
    log.push(
      `skip enum ${enumName}.${value}: ${e instanceof Error ? e.message : String(e)}`
    );
  }
}

async function applySchema(prisma, log) {
  await ensureColumn(
    prisma,
    "organizations",
    "billing_contact_name",
    `"billing_contact_name" TEXT`,
    log
  );
  await ensureColumn(
    prisma,
    "organizations",
    "billing_address",
    `"billing_address" TEXT`,
    log
  );
  await ensureColumn(
    prisma,
    "organizations",
    "billing_country",
    `"billing_country" TEXT`,
    log
  );
  await ensureColumn(
    prisma,
    "organizations",
    "billing_tax_id",
    `"billing_tax_id" TEXT`,
    log
  );

  if (await tableExists(prisma, "payment_settings")) {
    await ensureColumn(
      prisma,
      "payment_settings",
      "seller_admin_emails",
      `"seller_admin_emails" JSONB NOT NULL DEFAULT '[]'`,
      log
    );
    await ensureColumn(
      prisma,
      "payment_settings",
      "email_branding",
      `"email_branding" JSONB NOT NULL DEFAULT '{}'`,
      log
    );
  }

  await ensureEnumValue(prisma, "NotificationType", "BILLING_SELLER_ALERT", log);

  await ensureTable(
    prisma,
    "billing_transactions",
    `CREATE TABLE "billing_transactions" (
      "id" TEXT PRIMARY KEY,
      "organization_id" TEXT NOT NULL,
      "provider" TEXT NOT NULL,
      "environment" TEXT NOT NULL DEFAULT 'sandbox',
      "kind" TEXT NOT NULL,
      "status" TEXT NOT NULL,
      "amount" DECIMAL(12,2) NOT NULL,
      "currency" TEXT NOT NULL DEFAULT 'USD',
      "fee_amount" DECIMAL(12,2),
      "net_amount" DECIMAL(12,2),
      "external_id" TEXT,
      "external_invoice_id" TEXT,
      "plan_version_id" TEXT,
      "top_up_pack_id" TEXT,
      "description" TEXT,
      "occurred_at" TIMESTAMP(3) NOT NULL,
      "metadata" JSONB NOT NULL DEFAULT '{}',
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "billing_transactions_organization_id_fkey"
        FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    log
  );

  // indexes / unique (idempotent)
  const indexes = [
    `CREATE UNIQUE INDEX IF NOT EXISTS "billing_transactions_provider_environment_external_id_key"
      ON "billing_transactions" ("provider", "environment", "external_id")`,
    `CREATE INDEX IF NOT EXISTS "billing_transactions_organization_id_occurred_at_idx"
      ON "billing_transactions" ("organization_id", "occurred_at")`,
    `CREATE INDEX IF NOT EXISTS "billing_transactions_environment_occurred_at_idx"
      ON "billing_transactions" ("environment", "occurred_at")`,
    `CREATE INDEX IF NOT EXISTS "billing_transactions_status_occurred_at_idx"
      ON "billing_transactions" ("status", "occurred_at")`,
    `CREATE INDEX IF NOT EXISTS "billing_transactions_kind_occurred_at_idx"
      ON "billing_transactions" ("kind", "occurred_at")`,
  ];
  for (const sql of indexes) {
    try {
      await prisma.$executeRawUnsafe(sql);
      log.push(`index ok: ${sql.slice(0, 60)}…`);
    } catch (e) {
      log.push(`skip index: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

async function backfill(prisma, log) {
  // billing_email from primary admin
  const r1 = await prisma.$executeRawUnsafe(`
    UPDATE organizations o
    SET billing_email = u.email,
        updated_at = CURRENT_TIMESTAMP
    FROM organization_users ou
    JOIN users u ON u.id = ou.user_id
    WHERE ou.organization_id = o.id
      AND ou.is_primary_admin = true
      AND o.billing_email IS NULL
      AND o.deleted_at IS NULL
  `);
  log.push(`backfill billing_email rows≈${r1}`);

  // Clear shared paddle customers (keep oldest org by created_at)
  const shared = await prisma.$queryRawUnsafe(`
    SELECT paddle_customer_id, paddle_customer_env
    FROM organizations
    WHERE paddle_customer_id IS NOT NULL AND deleted_at IS NULL
    GROUP BY paddle_customer_id, paddle_customer_env
    HAVING COUNT(*) > 1
  `);
  for (const row of shared) {
    const orgs = await prisma.$queryRawUnsafe(
      `SELECT id FROM organizations
       WHERE paddle_customer_id = $1 AND paddle_customer_env = $2 AND deleted_at IS NULL
       ORDER BY created_at ASC`,
      row.paddle_customer_id,
      row.paddle_customer_env
    );
    for (let i = 1; i < orgs.length; i++) {
      await prisma.$executeRawUnsafe(
        `UPDATE organizations SET paddle_customer_id = NULL, paddle_customer_env = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        orgs[i].id
      );
      log.push(`cleared shared paddle customer from org ${orgs[i].id}`);
    }
  }
}

async function main() {
  if (!isApply()) {
    console.error("Refusing to apply without APPLY=1");
    process.exit(1);
  }
  const prisma = createPrisma();
  const log = [];
  try {
    await applySchema(prisma, log);
    await backfill(prisma, log);
    const verify = await verifyB32(prisma);
    console.log(
      JSON.stringify(
        {
          phase: "B3.2",
          mode: "apply",
          log,
          verify,
          next: "npx prisma generate && npm run build && pm2 restart sales",
        },
        null,
        2
      )
    );
    if (!verify.ok) process.exit(2);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
