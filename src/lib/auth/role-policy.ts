import { UserRole } from "@prisma/client";

/** Roles a company admin may assign when creating/editing team members */
export const COMPANY_ASSIGNABLE_ROLES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.SALES_MANAGER,
  UserRole.SALES_REPRESENTATIVE,
];

export function getAssignableRoles(actorRole: UserRole): UserRole[] {
  if (actorRole === UserRole.SUPER_ADMIN) {
    return Object.values(UserRole);
  }
  if (actorRole === UserRole.ADMIN) {
    return COMPANY_ASSIGNABLE_ROLES;
  }
  return [];
}

export function canAssignRole(actorRole: UserRole, targetRole: UserRole): boolean {
  return getAssignableRoles(actorRole).includes(targetRole);
}

export function canManageTargetUser(
  actorRole: UserRole,
  targetRole: UserRole
): boolean {
  if (actorRole === UserRole.SUPER_ADMIN) return true;
  if (actorRole === UserRole.ADMIN && targetRole !== UserRole.SUPER_ADMIN) {
    return true;
  }
  return false;
}
