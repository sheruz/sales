import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission, type Permission } from "@/lib/auth/permissions";
import { ForbiddenError, UnauthorizedError } from "@/lib/api/response";
import type { AuthUser } from "@/types/auth";
import type { PermissionKey } from "@/lib/auth/permission-catalog";
import { hasOrgPermission } from "@/lib/tenant/scope";

export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

/** Legacy role-based permission (UserRole matrix). Prefer requireOrgPermission for tenant ops. */
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

export async function requireOrgPermission(
  permission: PermissionKey
): Promise<AuthUser> {
  const user = await requireUser();
  if (!hasOrgPermission(user, permission)) {
    throw new ForbiddenError();
  }
  if (!user.isPlatformAdmin && !user.organizationId) {
    throw new ForbiddenError("No active organization");
  }
  return user;
}

export async function requireSuperAdmin(): Promise<AuthUser> {
  const user = await requireUser();
  if (!user.isPlatformAdmin && !hasPermission(user.role, "platform:manage")) {
    throw new ForbiddenError();
  }
  return user;
}

export async function requireOrganizationContext(): Promise<AuthUser & { organizationId: string }> {
  const user = await requireUser();
  if (!user.organizationId) {
    throw new ForbiddenError("No active organization");
  }
  return user as AuthUser & { organizationId: string };
}
