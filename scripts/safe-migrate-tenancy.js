/**
 * Safe multi-tenancy migrate for databases that already have data.
 *
 * Problem: `prisma db push` fails when adding required organization_id to
 * non-empty tables (leads, conversations, services, …).
 *
 * This script:
 *  1. Creates organizations / RBAC tables if missing
 *  2. Adds organization_id as NULLABLE on tenant tables
 *  3. Creates default-workspace org + backfills all NULL org ids
 *  4. Sets organization_id NOT NULL where every row is filled
 *  5. Softens unique constraints that block the new composite keys
 *  6. Runs `prisma db push` for remaining schema sync (Phase 2 tables, etc.)
 *  7. Runs RBAC + membership backfill
 *
 * Usage (on server — keeps all data):
 *   npm run db:migrate:safe
 *
 * NEVER use prisma db push --force-reset unless you intend to wipe the database.
 */
const { execSync } = require("child_process");
const path = require("path");
const { randomUUID } = require("crypto");
const { PrismaClient } = require("@prisma/client");

require("./load-env");

const rootDir = path.join(__dirname, "..");
const prisma = new PrismaClient();

const TENANT_TABLES = [
  "companies",
  "leads",
  "tags",
  "campaigns",
  "services",
  "tasks",
  "conversations",
  "deals",
  "meetings",
  "proposals",
  "email_accounts",
  "linkedin_discovery_jobs",
  "follow_up_jobs",
  "autopilot_configs",
  "user_integrations",
];

async function tableExists(table) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT 1 AS ok FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1`,
    table
  );
  return rows.length > 0;
}

async function columnExists(table, column) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT 1 AS ok FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    table,
    column
  );
  return rows.length > 0;
}

async function ensureNullableOrgColumn(table) {
  if (!(await tableExists(table))) {
    console.log(`  skip missing table ${table}`);
    return;
  }
  if (await columnExists(table, "organization_id")) {
    console.log(`  organization_id already on ${table}`);
    return;
  }
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "${table}" ADD COLUMN organization_id TEXT`
  );
  console.log(`  added nullable organization_id to ${table}`);
}

async function backfillAndTighten(table, orgId) {
  if (!(await tableExists(table))) return;
  if (!(await columnExists(table, "organization_id"))) return;

  const updated = await prisma.$executeRawUnsafe(
    `UPDATE "${table}" SET organization_id = $1 WHERE organization_id IS NULL`,
    orgId
  );
  console.log(`  backfilled ${table}: ${updated} rows`);

  const nulls = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS c FROM "${table}" WHERE organization_id IS NULL`
  );
  if (nulls[0].c > 0) {
    console.warn(
      `  WARNING: ${table} still has ${nulls[0].c} NULL org rows — skipping NOT NULL`
    );
    return;
  }

  await prisma.$executeRawUnsafe(
    `ALTER TABLE "${table}" ALTER COLUMN organization_id SET NOT NULL`
  );
  console.log(`  set ${table}.organization_id NOT NULL`);
}

async function dropNameOnlyUniques(table) {
  if (!(await tableExists(table))) return;
  const uniques = await prisma.$queryRawUnsafe(
    `SELECT conname FROM pg_constraint
     WHERE conrelid = $1::regclass AND contype = 'u'`,
    table
  );
  for (const row of uniques) {
    const name = String(row.conname);
    if (name.includes("name") && !name.includes("organization")) {
      try {
        await prisma.$executeRawUnsafe(
          `ALTER TABLE "${table}" DROP CONSTRAINT "${name}"`
        );
        console.log(`  dropped unique ${name} on ${table}`);
      } catch (e) {
        console.warn(`  could not drop ${name}:`, e.message);
      }
    }
  }
}

async function bootstrapSql() {
  console.log("Creating org / RBAC tables if missing…");

  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'TRIAL', 'CANCELLED');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `);
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'INVITED', 'DISABLED');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `);
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `);
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      CREATE TYPE "RoleScope" AS ENUM ('PLATFORM', 'ORGANIZATION');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      legal_name TEXT,
      website TEXT,
      status "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE',
      timezone TEXT NOT NULL DEFAULT 'UTC',
      default_currency TEXT NOT NULL DEFAULT 'USD',
      created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      deleted_at TIMESTAMP(3)
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      scope "RoleScope" NOT NULL,
      is_system BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS permissions (
      id TEXT PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
      PRIMARY KEY (role_id, permission_id)
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS organization_settings (
      organization_id TEXT PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
      timezone TEXT NOT NULL DEFAULT 'UTC',
      currency TEXT NOT NULL DEFAULT 'USD',
      locale TEXT NOT NULL DEFAULT 'en-US',
      default_email_account TEXT,
      default_ai_provider TEXT,
      default_ai_model TEXT,
      daily_email_limit INTEGER NOT NULL DEFAULT 200,
      daily_ai_limit INTEGER NOT NULL DEFAULT 500,
      settings JSONB,
      created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS organization_users (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role_id TEXT NOT NULL REFERENCES roles(id),
      status "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
      is_primary_admin BOOLEAN NOT NULL DEFAULT false,
      invited_at TIMESTAMP(3),
      joined_at TIMESTAMP(3),
      last_active_at TIMESTAMP(3),
      created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (organization_id, user_id)
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS organization_invitations (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      role_id TEXT NOT NULL REFERENCES roles(id),
      invited_by TEXT REFERENCES users(id),
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMP(3) NOT NULL,
      accepted_at TIMESTAMP(3),
      status "InvitationStatus" NOT NULL DEFAULT 'PENDING',
      created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  if (await tableExists("sessions")) {
    if (!(await columnExists("sessions", "active_organization_id"))) {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE sessions ADD COLUMN active_organization_id TEXT`
      );
      console.log("  added sessions.active_organization_id");
    }
  }

  for (const t of ["audit_logs", "ai_usage_logs"]) {
    if ((await tableExists(t)) && !(await columnExists(t, "organization_id"))) {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "${t}" ADD COLUMN organization_id TEXT`
      );
      console.log(`  added nullable organization_id to ${t}`);
    }
  }

  console.log("Adding nullable organization_id columns…");
  for (const table of TENANT_TABLES) {
    await ensureNullableOrgColumn(table);
  }

  let orgs = await prisma.$queryRawUnsafe(
    `SELECT id FROM organizations WHERE slug = 'default-workspace' AND deleted_at IS NULL LIMIT 1`
  );
  let orgId;
  if (orgs.length === 0) {
    orgId = randomUUID();
    const now = new Date();
    await prisma.$executeRawUnsafe(
      `INSERT INTO organizations (id, name, slug, status, timezone, default_currency, created_at, updated_at)
       VALUES ($1, 'Default Workspace', 'default-workspace', 'ACTIVE', 'UTC', 'USD', $2, $2)`,
      orgId,
      now
    );
    await prisma.$executeRawUnsafe(
      `INSERT INTO organization_settings (organization_id, created_at, updated_at)
       VALUES ($1, $2, $2)
       ON CONFLICT (organization_id) DO NOTHING`,
      orgId,
      now
    );
    console.log("Created default-workspace org", orgId);
  } else {
    orgId = orgs[0].id;
    console.log("Using existing default-workspace org", orgId);
  }

  console.log("Backfilling organization_id…");
  for (const table of TENANT_TABLES) {
    await backfillAndTighten(table, orgId);
  }

  if (
    (await tableExists("conversations")) &&
    (await columnExists("conversations", "organization_id"))
  ) {
    await prisma.$executeRawUnsafe(`
      UPDATE conversations c
      SET organization_id = l.organization_id
      FROM leads l
      WHERE c.lead_id = l.id
        AND l.organization_id IS NOT NULL
        AND (c.organization_id IS NULL OR c.organization_id <> l.organization_id)
    `);
  }

  if (
    (await tableExists("follow_up_jobs")) &&
    (await columnExists("follow_up_jobs", "organization_id"))
  ) {
    await prisma.$executeRawUnsafe(`
      UPDATE follow_up_jobs f
      SET organization_id = l.organization_id
      FROM leads l
      WHERE f.lead_id = l.id
        AND l.organization_id IS NOT NULL
        AND (f.organization_id IS NULL OR f.organization_id <> l.organization_id)
    `);
  }

  console.log("Relaxing old unique constraints…");
  await dropNameOnlyUniques("tags");
  await dropNameOnlyUniques("services");

  if (await tableExists("user_integrations")) {
    const uniques = await prisma.$queryRawUnsafe(
      `SELECT conname FROM pg_constraint
       WHERE conrelid = 'user_integrations'::regclass AND contype = 'u'`
    );
    for (const row of uniques) {
      const name = String(row.conname);
      if (!name.includes("organization")) {
        try {
          await prisma.$executeRawUnsafe(
            `ALTER TABLE user_integrations DROP CONSTRAINT "${name}"`
          );
          console.log(`  dropped unique ${name} on user_integrations`);
        } catch (e) {
          console.warn(`  could not drop ${name}:`, e.message);
        }
      }
    }
  }

  if (await tableExists("services")) {
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        CREATE TYPE "CatalogItemStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    const serviceCols = [
      ["category", "TEXT"],
      ["pricing_model", "TEXT"],
      ["currency", "TEXT DEFAULT 'USD'"],
      ["ideal_customer", "TEXT"],
      ["problems_solved", "TEXT[] DEFAULT ARRAY[]::TEXT[]"],
    ];
    for (const [col, def] of serviceCols) {
      if (!(await columnExists("services", col))) {
        await prisma.$executeRawUnsafe(
          `ALTER TABLE services ADD COLUMN ${col} ${def}`
        );
        console.log(`  added services.${col}`);
      }
    }
    if (!(await columnExists("services", "status"))) {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE services ADD COLUMN status "CatalogItemStatus" NOT NULL DEFAULT 'ACTIVE'`
      );
      console.log("  added services.status");
    }
  }

  return orgId;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  console.log("Starting safe tenancy migration (data preserved)…\n");
  await bootstrapSql();

  console.log("\nRunning prisma db push…");
  try {
    execSync("node scripts/prisma-cli.js db push", {
      stdio: "inherit",
      cwd: rootDir,
      env: process.env,
    });
  } catch {
    console.error(
      "\nprisma db push still failed. Inspect the error above.\n" +
        "Do NOT use --force-reset unless you want to wipe all data.\n" +
        "Fix any remaining NULL organization_id rows, then re-run:\n" +
        "  npm run db:migrate:safe"
    );
    process.exit(1);
  }

  console.log("\nSeeding RBAC + memberships…");
  execSync("node scripts/run-with-env.js npx tsx scripts/phase1-backfill.ts", {
    stdio: "inherit",
    cwd: rootDir,
    env: process.env,
  });

  console.log("\nSafe tenancy migration complete. Data kept.");
  console.log("Next: npm run build && pm2 restart sales");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
