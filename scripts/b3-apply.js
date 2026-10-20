/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * B3 apply — step-wise idempotent schema + verification.
 * Requires APPLY=1.
 */
const {
  createPrisma,
  inspectB3Schema,
  isApply,
  tableExists,
  columnExists,
  enumExists,
} = require("./b3-lib");

async function ensureEnum(client, name, values, log) {
  if (!(await enumExists(client, name))) {
    const list = values.map((v) => `'${v}'`).join(", ");
    await client.$executeRawUnsafe(`CREATE TYPE "${name}" AS ENUM (${list})`);
    log.push(`CREATE TYPE ${name}`);
  } else log.push(`skip enum ${name}`);
}

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

async function ensureIndex(client, name, sql, log) {
  const rows = await client.$queryRawUnsafe(
    `SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = $1 LIMIT 1`,
    name
  );
  if (Array.isArray(rows) && rows.length > 0) {
    log.push(`skip index ${name}`);
    return;
  }
  await client.$executeRawUnsafe(sql);
  log.push(`CREATE INDEX ${name}`);
}

async function applySchema(prisma, log) {
  await ensureEnum(
    prisma,
    "InvoiceStatus",
    ["DRAFT", "OPEN", "PAID", "VOID", "OVERDUE"],
    log
  );

  await ensureColumn(
    prisma,
    "organizations",
    "billing_provider",
    `"billing_provider" TEXT NOT NULL DEFAULT 'PADDLE'`,
    log
  );
  await ensureColumn(
    prisma,
    "organizations",
    "billing_email",
    `"billing_email" TEXT`,
    log
  );
  await ensureColumn(
    prisma,
    "organizations",
    "paddle_customer_id",
    `"paddle_customer_id" TEXT`,
    log
  );
  await ensureColumn(
    prisma,
    "organizations",
    "paddle_customer_env",
    `"paddle_customer_env" TEXT`,
    log
  );

  await ensureColumn(
    prisma,
    "subscriptions",
    "provider_environment",
    `"provider_environment" TEXT`,
    log
  );
  await ensureColumn(
    prisma,
    "subscriptions",
    "billing_interval",
    `"billing_interval" TEXT`,
    log
  );
  await ensureColumn(
    prisma,
    "subscriptions",
    "last_payment_failed_notice_day",
    `"last_payment_failed_notice_day" INTEGER`,
    log
  );

  // webhook extras
  await ensureColumn(
    prisma,
    "billing_webhook_events",
    "environment",
    `"environment" TEXT`,
    log
  );
  await ensureColumn(
    prisma,
    "billing_webhook_events",
    "occurred_at",
    `"occurred_at" TIMESTAMP(3)`,
    log
  );
  await ensureColumn(
    prisma,
    "billing_webhook_events",
    "organization_id",
    `"organization_id" TEXT`,
    log
  );
  await ensureColumn(
    prisma,
    "billing_webhook_events",
    "external_subscription_id",
    `"external_subscription_id" TEXT`,
    log
  );
  await ensureColumn(
    prisma,
    "billing_webhook_events",
    "attempt_count",
    `"attempt_count" INTEGER NOT NULL DEFAULT 0`,
    log
  );
  await ensureColumn(
    prisma,
    "billing_webhook_events",
    "next_retry_at",
    `"next_retry_at" TIMESTAMP(3)`,
    log
  );
  await ensureColumn(
    prisma,
    "billing_webhook_events",
    "created_at",
    `"created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
    log
  );
  await ensureColumn(
    prisma,
    "billing_webhook_events",
    "updated_at",
    `"updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
    log
  );

  await ensureTable(
    prisma,
    "provider_price_maps",
    `CREATE TABLE "provider_price_maps" (
      "id" TEXT NOT NULL,
      "provider" TEXT NOT NULL,
      "environment" TEXT NOT NULL,
      "interval" TEXT NOT NULL,
      "plan_version_id" TEXT,
      "top_up_pack_id" TEXT,
      "external_product_id" TEXT NOT NULL,
      "external_price_id" TEXT NOT NULL,
      "active" BOOLEAN NOT NULL DEFAULT true,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "provider_price_maps_pkey" PRIMARY KEY ("id")
    )`,
    log
  );
  await ensureIndex(
    prisma,
    "provider_price_maps_provider_environment_external_price_id_idx",
    `CREATE INDEX "provider_price_maps_provider_environment_external_price_id_idx"
      ON "provider_price_maps"("provider", "environment", "external_price_id")`,
    log
  );

  await ensureTable(
    prisma,
    "invoice_sequences",
    `CREATE TABLE "invoice_sequences" (
      "year" INTEGER NOT NULL,
      "last_number" INTEGER NOT NULL DEFAULT 0,
      CONSTRAINT "invoice_sequences_pkey" PRIMARY KEY ("year")
    )`,
    log
  );

  await ensureTable(
    prisma,
    "invoices",
    `CREATE TABLE "invoices" (
      "id" TEXT NOT NULL,
      "number" TEXT NOT NULL,
      "organization_id" TEXT NOT NULL,
      "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
      "provider" TEXT NOT NULL,
      "currency" TEXT NOT NULL DEFAULT 'USD',
      "subtotal" DECIMAL(12,2) NOT NULL,
      "total" DECIMAL(12,2) NOT NULL,
      "due_date" TIMESTAMP(3),
      "paid_at" TIMESTAMP(3),
      "period_start" TIMESTAMP(3),
      "period_end" TIMESTAMP(3),
      "line_items" JSONB NOT NULL,
      "payment_url" TEXT,
      "pdf_path" TEXT,
      "billing_name" TEXT,
      "billing_email" TEXT,
      "billing_address" TEXT,
      "notes" TEXT,
      "paddle_transaction_id" TEXT,
      "plan_version_id" TEXT,
      "created_by_user_id" TEXT,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
    )`,
    log
  );
  await ensureIndex(
    prisma,
    "invoices_number_key",
    `CREATE UNIQUE INDEX "invoices_number_key" ON "invoices"("number")`,
    log
  );

  await ensureTable(
    prisma,
    "payments",
    `CREATE TABLE "payments" (
      "id" TEXT NOT NULL,
      "invoice_id" TEXT NOT NULL,
      "amount" DECIMAL(12,2) NOT NULL,
      "method" TEXT NOT NULL,
      "reference" TEXT,
      "received_at" TIMESTAMP(3) NOT NULL,
      "recorded_by_user_id" TEXT,
      "notes" TEXT,
      "proof_path" TEXT,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
    )`,
    log
  );

  // Default billing_provider for existing orgs
  try {
    await prisma.$executeRawUnsafe(
      `UPDATE "organizations" SET "billing_provider" = 'PADDLE' WHERE "billing_provider" IS NULL OR "billing_provider" = ''`
    );
  } catch {
    // ignore
  }
}

async function main() {
  if (!isApply()) {
    console.error("Refusing without APPLY=1");
    process.exit(1);
  }
  const prisma = createPrisma();
  const out = {
    phase: "B3",
    mode: "APPLY",
    at: new Date().toISOString(),
    schemaBefore: null,
    schemaAfter: null,
    schemaSteps: [],
    notes: [],
    fatal: [],
  };
  try {
    out.schemaBefore = await inspectB3Schema(prisma);
    await applySchema(prisma, out.schemaSteps);
    out.schemaAfter = await inspectB3Schema(prisma);
    if (!out.schemaAfter.ready) {
      out.fatal.push("Schema still not ready after apply");
    } else {
      out.notes.push("Schema ready — verification passed");
    }
    out.notes.push(
      `Delvix org ${process.env.PLATFORM_OWNER_ORG_ID || "(unset)"} excluded from billing`
    );
  } catch (err) {
    out.fatal.push(err instanceof Error ? err.message : String(err));
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
  console.log(JSON.stringify(out, null, 2));
  if (out.fatal.length) process.exit(1);
}

main();
