/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * B3.1 apply — step-wise idempotent schema + seed + migrate platform_billing.
 * Requires APPLY=1.
 */
const {
  createPrisma,
  inspectB31Schema,
  isApply,
  tableExists,
  columnExists,
} = require("./b3-1-lib");

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

async function applySchema(prisma, log) {
  await ensureColumn(
    prisma,
    "organizations",
    "allowed_checkout_methods",
    `"allowed_checkout_methods" JSONB`,
    log
  );
  await ensureColumn(
    prisma,
    "organizations",
    "stripe_customer_id",
    `"stripe_customer_id" TEXT`,
    log
  );
  await ensureColumn(
    prisma,
    "organizations",
    "stripe_customer_env",
    `"stripe_customer_env" TEXT`,
    log
  );

  // Allow null billing_provider (= use default)
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "organizations" ALTER COLUMN "billing_provider" DROP NOT NULL`
    );
    log.push("ALTER organizations.billing_provider DROP NOT NULL");
  } catch (e) {
    log.push(
      `skip billing_provider nullability: ${e instanceof Error ? e.message : String(e)}`
    );
  }
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "organizations" ALTER COLUMN "billing_provider" DROP DEFAULT`
    );
    log.push("DROP DEFAULT organizations.billing_provider");
  } catch (e) {
    log.push(
      `skip drop default billing_provider: ${e instanceof Error ? e.message : String(e)}`
    );
  }

  await ensureTable(
    prisma,
    "payment_provider_configs",
    `CREATE TABLE "payment_provider_configs" (
      "provider" TEXT PRIMARY KEY,
      "enabled" BOOLEAN NOT NULL DEFAULT false,
      "mode" TEXT NOT NULL DEFAULT 'SANDBOX',
      "display_name" TEXT NOT NULL,
      "sort_order" INTEGER NOT NULL DEFAULT 0,
      "sandbox_credentials_enc" TEXT,
      "live_credentials_enc" TEXT,
      "sandbox_hint" TEXT,
      "live_hint" TEXT,
      "last_test_at" TIMESTAMP(3),
      "last_test_result" JSONB,
      "last_webhook_at" TIMESTAMP(3),
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    log
  );

  await ensureTable(
    prisma,
    "payment_settings",
    `CREATE TABLE "payment_settings" (
      "id" TEXT PRIMARY KEY DEFAULT 'default',
      "payments_enabled" BOOLEAN NOT NULL DEFAULT false,
      "default_provider" TEXT NOT NULL DEFAULT 'PADDLE',
      "checkout_methods" JSONB NOT NULL DEFAULT '[]',
      "currency" TEXT NOT NULL DEFAULT 'USD',
      "grace_days" INTEGER NOT NULL DEFAULT 7,
      "manual_renewal_lead_days" INTEGER NOT NULL DEFAULT 7,
      "business" JSONB NOT NULL DEFAULT '{}',
      "manual_instructions" JSONB NOT NULL DEFAULT '{}',
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    log
  );

  const seeds = [
    ["PADDLE", "Paddle", 10],
    ["STRIPE", "Stripe", 20],
    ["MANUAL_PAYONEER", "Payoneer (invoice)", 30],
    ["MANUAL_BANK", "Bank transfer", 40],
  ];
  for (const [provider, name, order] of seeds) {
    const existing = await prisma.$queryRawUnsafe(
      `SELECT 1 FROM "payment_provider_configs" WHERE "provider" = $1 LIMIT 1`,
      provider
    );
    if (Array.isArray(existing) && existing.length > 0) {
      log.push(`skip seed ${provider}`);
      continue;
    }
    await prisma.$executeRawUnsafe(
      `INSERT INTO "payment_provider_configs" ("provider","display_name","sort_order","enabled","mode","created_at","updated_at")
       VALUES ($1,$2,$3,false,'SANDBOX',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
      provider,
      name,
      order
    );
    log.push(`seed ${provider}`);
  }

  const settingsRows = await prisma.$queryRawUnsafe(
    `SELECT 1 FROM "payment_settings" WHERE "id" = 'default' LIMIT 1`
  );
  if (!(Array.isArray(settingsRows) && settingsRows.length > 0)) {
    let business = {};
    let manual = {};
    let paymentsEnabled = false;
    try {
      const legacy = await prisma.$queryRawUnsafe(
        `SELECT "value" FROM "settings" WHERE "key" = 'platform_billing' LIMIT 1`
      );
      if (Array.isArray(legacy) && legacy[0]?.value) {
        const v =
          typeof legacy[0].value === "string"
            ? JSON.parse(legacy[0].value)
            : legacy[0].value;
        business = {
          name: v.name || "Delvix",
          address: v.address || "",
          email: v.email || "",
          taxId: v.taxId || "",
        };
        manual = {
          payoneer: v.payoneerInstructions || "",
          bank: v.bankInstructions || "",
        };
        log.push("migrated platform_billing → payment_settings");
      }
    } catch {
      /* ignore */
    }
    if (process.env.PAYMENTS_ENABLED === "true") paymentsEnabled = true;

    await prisma.$executeRawUnsafe(
      `INSERT INTO "payment_settings" (
        "id","payments_enabled","default_provider","checkout_methods","currency",
        "grace_days","manual_renewal_lead_days","business","manual_instructions",
        "created_at","updated_at"
      ) VALUES (
        'default',$1,'PADDLE','[]','USD',7,7,$2::jsonb,$3::jsonb,
        CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
      )`,
      paymentsEnabled,
      JSON.stringify(business),
      JSON.stringify(manual)
    );
    log.push("seed payment_settings default");
  } else {
    log.push("skip payment_settings seed");
  }
}

async function main() {
  const out = {
    phase: "B3.1",
    mode: "APPLY",
    at: new Date().toISOString(),
    log: [],
    schema: null,
    fatal: [],
  };

  if (!isApply()) {
    out.fatal.push("Refusing apply without APPLY=1");
    console.log(JSON.stringify(out, null, 2));
    process.exit(1);
  }

  const prisma = createPrisma();
  try {
    await applySchema(prisma, out.log);
    out.schema = await inspectB31Schema(prisma);
    if (!out.schema.ready) {
      out.fatal.push("Schema still incomplete after apply");
    }
  } catch (err) {
    out.fatal.push(err instanceof Error ? err.message : String(err));
  } finally {
    await prisma.$disconnect().catch(() => {});
  }

  console.log(JSON.stringify(out, null, 2));
  if (out.fatal.length) process.exit(1);
}

main();
