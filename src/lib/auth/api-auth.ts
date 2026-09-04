import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission, type Permission } from "@/lib/auth/permissions";
import { ForbiddenError, UnauthorizedError } from "@/lib/api/response";
import type { AuthUser } from "@/types/auth";
import type { PermissionKey } from "@/lib/auth/permission-catalog";
import {
  hasAnyOrgPermission,
  hasOrgPermission,
} from "@/lib/tenant/scope";

export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

/**
 * @deprecated Legacy UserRole matrix. Do not use on customer-facing APIs.
 * Prefer requireOrgPermission. Kept only for platform-adjacent legacy until removed.
 */
export async function requirePermission(
  permission: Permission
): Promise<AuthUser> {
  const user = await requireUser();
  if (user.isPlatformAdmin) return user;
  if (!hasPermission(user.role, permission)) {
    throw new ForbiddenError();
  }
  return user;
}

/**
 * Authoritative customer-API authorization:
 * active organization membership + organization permission catalog.
 * SUPER_ADMIN does not bypass — must have org context + membership perms.
 */
export async function requireOrgPermission(
  permission: PermissionKey
): Promise<AuthUser & { organizationId: string }> {
  const user = await requireUser();
  if (!user.organizationId) {
    throw new ForbiddenError("No active organization");
  }
  if (!hasOrgPermission(user, permission)) {
    throw new ForbiddenError();
  }
  return user as AuthUser & { organizationId: string };
}

/** OR of organization permissions (e.g. deals.manage | opportunities.view). */
export async function requireAnyOrgPermission(
  permissions: PermissionKey[]
): Promise<AuthUser & { organizationId: string }> {
  const user = await requireUser();
  if (!user.organizationId) {
    throw new ForbiddenError("No active organization");
  }
  if (!hasAnyOrgPermission(user, permissions)) {
    throw new ForbiddenError();
  }
  return user as AuthUser & { organizationId: string };
}

export async function requireSuperAdmin(): Promise<AuthUser> {
  const user = await requireUser();
  if (!user.isPlatformAdmin && !hasPermission(user.role, "platform:manage")) {
    throw new ForbiddenError();
  }
  return user;
}

export async function requireOrganizationContext(): Promise<
  AuthUser & { organizationId: string }
> {
  const user = await requireUser();
  if (!user.organizationId) {
    throw new ForbiddenError("No active organization");
  }
  return user as AuthUser & { organizationId: string };
}
