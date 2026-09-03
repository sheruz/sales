/**
 * Phase 1 multi-tenancy backfill.
 * Run after schema is applied (db push / migrate) OR use --bootstrap to add nullable columns first.
 *
 * Usage:
 *   node scripts/run-with-env.js npx tsx scripts/phase1-backfill.ts
 */
import { PrismaClient, UserRole } from "@prisma/client";
import {
  seedRolesAndPermissions,
  getRoleByKey,
  ensureUniqueOrgSlug,
} from "../src/lib/tenant/rbac";
import { ROLE_KEYS, legacyUserRoleToRoleKey } from "../src/lib/auth/permission-catalog";

const prisma = new PrismaClient();

async function main() {
  console.log("Phase 1 backfill: seeding RBAC…");
  await seedRolesAndPermissions();

  let org = await prisma.organization.findFirst({
    where: { slug: "default-workspace", deletedAt: null },
  });

  if (!org) {
    const slug = await ensureUniqueOrgSlug("default-workspace");
    org = await prisma.organization.create({
      data: {
        name: "Default Workspace",
        slug,
        status: "ACTIVE",
        settings: { create: {} },
      },
    });
    console.log("Created default organization", org.id);
  } else {
    console.log("Using existing default organization", org.id);
  }

  const users = await prisma.user.findMany({
    where: { deletedAt: null, role: { not: UserRole.SUPER_ADMIN } },
  });

  for (const user of users) {
    const roleKey = legacyUserRoleToRoleKey(user.role);
    const role = await getRoleByKey(roleKey);
    await prisma.organizationUser.upsert({
      where: {
        organizationId_userId: { organizationId: org.id, userId: user.id },
      },
      create: {
        organizationId: org.id,
        userId: user.id,
        roleId: role.id,
        status: "ACTIVE",
        isPrimaryAdmin: user.role === UserRole.ADMIN,
        joinedAt: new Date(),
      },
      update: {
        roleId: role.id,
        status: "ACTIVE",
      },
    });
  }
  console.log(`Memberships ensured for ${users.length} users`);

  // Backfill tenant tables (raw SQL — idempotent)
  const orgId = org.id;
  const tables = [
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
  ] as const;

  for (const table of tables) {
    try {
      const result = await prisma.$executeRawUnsafe(
        `UPDATE "${table}" SET organization_id = $1 WHERE organization_id IS NULL`,
        orgId
      );
      console.log(`Backfilled ${table}: ${result} rows`);
    } catch (err) {
      console.warn(`Skip/backfill ${table}:`, err instanceof Error ? err.message : err);
    }
  }

  // Conversations / follow_up_jobs may need org from lead
  try {
    await prisma.$executeRawUnsafe(`
      UPDATE conversations c
      SET organization_id = l.organization_id
      FROM leads l
      WHERE c.lead_id = l.id AND (c.organization_id IS NULL OR c.organization_id <> l.organization_id)
    `);
  } catch (err) {
    console.warn("conversations sync:", err instanceof Error ? err.message : err);
  }

  try {
    await prisma.$executeRawUnsafe(`
      UPDATE follow_up_jobs f
      SET organization_id = l.organization_id
      FROM leads l
      WHERE f.lead_id = l.id AND (f.organization_id IS NULL OR f.organization_id <> l.organization_id)
    `);
  } catch (err) {
    console.warn("follow_up_jobs sync:", err instanceof Error ? err.message : err);
  }

  console.log("Phase 1 backfill complete.");
  console.log("Platform admin role key:", ROLE_KEYS.PLATFORM_ADMIN);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
