import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission, type Permission } from "@/lib/auth/permissions";
import { ForbiddenError, UnauthorizedError } from "@/lib/api/response";
import type { AuthUser } from "@/types/auth";

export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

export async function requirePermission(
  permission: Permission
): Promise<AuthUser> {
  const user = await requireUser();
  if (!hasPermission(user.role, permission)) {
    throw new ForbiddenError();
  }
  return user;
}
