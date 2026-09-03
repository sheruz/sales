import { ForbiddenError, UnauthorizedError } from "@/lib/api/response";
import type { AuthUser } from "@/types/auth";
import type { PermissionKey } from "@/lib/auth/permission-catalog";

/** Require an authenticated org-scoped user (not platform-only). */
export function requireOrganizationId(user: AuthUser): string {
  if (!user.organizationId) {
    throw new ForbiddenError(
      "No active organization. Join or select an organization first."
    );
  }
  return user.organizationId;
}

export function assertSameOrganization(
  user: AuthUser,
  resourceOrganizationId: string | null | undefined,
  message = "Resource not found"
): void {
  if (!user.isPlatformAdmin) {
    const orgId = requireOrganizationId(user);
    if (!resourceOrganizationId || resourceOrganizationId !== orgId) {
      throw new ForbiddenError(message);
    }
  }
}

export function orgWhere(user: AuthUser): { organizationId: string } {
  return { organizationId: requireOrganizationId(user) };
}

export function hasOrgPermission(
  user: AuthUser,
  permission: PermissionKey
): boolean {
  if (user.isPlatformAdmin) return true;
  return user.permissions.includes(permission);
}

export function requireOrgPermission(
  user: AuthUser,
  permission: PermissionKey
): void {
  if (!user) throw new UnauthorizedError();
  if (!hasOrgPermission(user, permission)) {
    throw new ForbiddenError();
  }
}
