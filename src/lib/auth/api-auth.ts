import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission, type Permission } from "@/lib/auth/permissions";
import { ForbiddenError, UnauthorizedError } from "@/lib/api/response";
import type { AuthUser } from "@/types/auth";
import type { PermissionKey } from "@/lib/auth/permission-catalog";
import {
  hasAnyOrgPermission,
  hasOrgPermission,
} from "@/lib/tenant/scope";
import {
  tenantAccessService,
  ACCESS_REASONS,
} from "@/services/tenant-access.service";

/** Permissions still allowed when subscription is NONE/EXPIRED (locked). */
const LOCKED_ALLOWED_PERMS = new Set<string>([
  "billing.manage",
  "users.view",
  "users.update",
  "organization.view",
  "organization.update",
]);

async function assertNotLocked(
  organizationId: string,
  permission: string
) {
  const access = await tenantAccessService.getAccess(organizationId);
  if (!access.lifecycleEnforced || access.isPlatformOwner) return;

  if (access.accessMode === "locked") {
    if (!LOCKED_ALLOWED_PERMS.has(permission)) {
      throw new ForbiddenError(
        "No active subscription. Choose a plan to activate your workspace.",
        ACCESS_REASONS.NO_ACTIVE_SUBSCRIPTION
      );
    }
  }
}

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
  await assertNotLocked(user.organizationId, permission);
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
  // Lifecycle: allow if any requested perm is on the locked allow-list
  const access = await tenantAccessService.getAccess(user.organizationId);
  if (
    access.lifecycleEnforced &&
    !access.isPlatformOwner &&
    access.accessMode === "locked" &&
    !permissions.some((p) => LOCKED_ALLOWED_PERMS.has(p))
  ) {
    throw new ForbiddenError(
      "No active subscription. Choose a plan to activate your workspace.",
      ACCESS_REASONS.NO_ACTIVE_SUBSCRIPTION
    );
  }
  return user as AuthUser & { organizationId: string };
}

export async function requireSuperAdmin(): Promise<AuthUser> {
  const user = await requireUser();
  // S1: platformRole SUPER_ADMIN is source of truth
  if (user.platformRole === "SUPER_ADMIN" || user.isPlatformAdmin) {
    if (user.platformRole !== "SUPER_ADMIN" && user.role === "SUPER_ADMIN") {
      console.warn(
        "[auth] requireSuperAdmin legacy fallback (UserRole.SUPER_ADMIN)",
        { userId: user.id }
      );
    }
    return user;
  }
  if (hasPermission(user.role, "platform:manage")) {
    console.warn(
      "[auth] requireSuperAdmin legacy fallback (platform:manage permission)",
      { userId: user.id }
    );
    return user;
  }
  throw new ForbiddenError();
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
