import { createHash, randomBytes } from "crypto";
import prisma from "@/lib/db/prisma";
import {
  ROLE_KEYS,
  ROLE_PERMISSION_MAP,
  PERMISSION_KEYS,
  legacyUserRoleToRoleKey,
  type PermissionKey,
} from "@/lib/auth/permission-catalog";
import { RoleScope, UserRole } from "@prisma/client";

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateInviteToken(): string {
  return randomBytes(32).toString("hex");
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export async function ensureUniqueOrgSlug(base: string): Promise<string> {
  const slug = slugify(base) || "org";
  let n = 0;
  while (true) {
    const candidate = n === 0 ? slug : `${slug}-${n}`;
    const existing = await prisma.organization.findUnique({
      where: { slug: candidate },
    });
    if (!existing) return candidate;
    n += 1;
  }
}

/** Seed system roles + permissions (idempotent). */
export async function seedRolesAndPermissions() {
  for (const key of PERMISSION_KEYS) {
    await prisma.permission.upsert({
      where: { key },
      create: { key, name: key },
      update: { name: key },
    });
  }

  const roleDefs: Array<{
    key: string;
    name: string;
    scope: RoleScope;
  }> = [
    { key: ROLE_KEYS.PLATFORM_ADMIN, name: "Platform Admin", scope: RoleScope.PLATFORM },
    { key: ROLE_KEYS.COMPANY_ADMIN, name: "Company Admin", scope: RoleScope.ORGANIZATION },
    { key: ROLE_KEYS.SALES_MANAGER, name: "Sales Manager", scope: RoleScope.ORGANIZATION },
    { key: ROLE_KEYS.SALES_REP, name: "Sales Representative", scope: RoleScope.ORGANIZATION },
    { key: ROLE_KEYS.VIEWER, name: "Viewer", scope: RoleScope.ORGANIZATION },
  ];

  for (const def of roleDefs) {
    const role = await prisma.role.upsert({
      where: { key: def.key },
      create: def,
      update: { name: def.name, scope: def.scope },
    });

    const permKeys = ROLE_PERMISSION_MAP[def.key] ?? [];
    const perms = await prisma.permission.findMany({
      where: { key: { in: permKeys } },
    });

    for (const perm of perms) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: role.id, permissionId: perm.id },
        },
        create: { roleId: role.id, permissionId: perm.id },
        update: {},
      });
    }

    // Drop stale permissions no longer in ROLE_PERMISSION_MAP for this role
    const allowedIds = new Set(perms.map((p) => p.id));
    const existing = await prisma.rolePermission.findMany({
      where: { roleId: role.id },
      select: { permissionId: true },
    });
    const stale = existing
      .map((e) => e.permissionId)
      .filter((id) => !allowedIds.has(id));
    if (stale.length) {
      await prisma.rolePermission.deleteMany({
        where: { roleId: role.id, permissionId: { in: stale } },
      });
    }
  }
}

export async function getRoleByKey(key: string) {
  return prisma.role.findUniqueOrThrow({ where: { key } });
}

export async function getPermissionKeysForRoleId(
  roleId: string
): Promise<PermissionKey[]> {
  const rows = await prisma.rolePermission.findMany({
    where: { roleId },
    include: { permission: true },
  });
  return rows.map((r) => r.permission.key as PermissionKey);
}

export async function resolveMembershipPermissions(userId: string, organizationId: string) {
  const membership = await prisma.organizationUser.findUnique({
    where: {
      organizationId_userId: { organizationId, userId },
    },
    include: {
      role: true,
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          deletedAt: true,
        },
      },
    },
  });

  if (!membership || membership.status !== "ACTIVE") return null;
  if (
    membership.organization.deletedAt ||
    membership.organization.status === "SUSPENDED" ||
    membership.organization.status === "CANCELLED"
  ) {
    return null;
  }

  const permissions = await getPermissionKeysForRoleId(membership.roleId);
  return { membership, permissions };
}

export function mapLegacyRole(role: UserRole) {
  return legacyUserRoleToRoleKey(role);
}
