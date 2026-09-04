import { ForbiddenError, UnauthorizedError } from "@/lib/api/response";
import type { AuthUser } from "@/types/auth";
import type { PermissionKey } from "@/lib/auth/permission-catalog";

/**
 * Phase 1 security pattern (authoritative for customer APIs):
 *
 * 1. Authenticate → getCurrentUser / requireUser
 * 2. requireOrgPermission(perm) → membership permissions + active organizationId
 * 3. Resource lookup: `{ id, organizationId }` (never id alone)
 * 4. Never trust client-supplied organizationId as authorization
 *
 * SUPER_ADMIN does NOT bypass org permissions on customer APIs.
 * Platform routes use requireSuperAdmin separately.
 */

/** Require an authenticated org-scoped user (not platform-only). */
export function requireOrganizationId(user: AuthUser): string {
  if (!user.organizationId) {
    throw new ForbiddenError(
      "No active organization. Join or select an organization first."
    );
  }
  return user.organizationId;
}

/**
 * Ensure a loaded resource belongs to the caller's active organization.
 * Does not grant platform-admin bypass — use platform APIs for cross-tenant ops.
 */
export function assertSameOrganization(
  user: AuthUser,
  resourceOrganizationId: string | null | undefined,
  message = "Resource not found"
): void {
  const orgId = requireOrganizationId(user);
  if (!resourceOrganizationId || resourceOrganizationId !== orgId) {
    throw new ForbiddenError(message);
  }
}

/** Prisma where fragment for the caller's tenant. */
export function orgWhere(user: AuthUser): { organizationId: string } {
  return { organizationId: requireOrganizationId(user) };
}

/** Prisma where for a single resource owned by the caller's tenant. */
export function orgResourceWhere(
  user: AuthUser,
  id: string
): { id: string; organizationId: string } {
  return { id, organizationId: requireOrganizationId(user) };
}

export function hasOrgPermission(
  user: AuthUser,
  permission: PermissionKey
): boolean {
  return user.permissions.includes(permission);
}

export function hasAnyOrgPermission(
  user: AuthUser,
  permissions: PermissionKey[]
): boolean {
  return permissions.some((p) => hasOrgPermission(user, p));
}

export function requireOrgPermission(
  user: AuthUser,
  permission: PermissionKey
): void {
  if (!user) throw new UnauthorizedError();
  requireOrganizationId(user);
  if (!hasOrgPermission(user, permission)) {
    throw new ForbiddenError();
  }
}
