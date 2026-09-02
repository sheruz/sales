import { UserRole } from "@prisma/client";

export const SESSION_COOKIE = "session_token";

export const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Company Admin",
  SALES_MANAGER: "Sales Manager",
  SALES_REPRESENTATIVE: "Sales Representative",
};

export type Permission =
  | "leads:read"
  | "leads:write"
  | "leads:delete"
  | "leads:assign"
  | "campaigns:read"
  | "campaigns:write"
  | "campaigns:delete"
  | "deals:read"
  | "deals:write"
  | "conversations:read"
  | "conversations:write"
  | "meetings:read"
  | "meetings:write"
  | "proposals:read"
  | "proposals:write"
  | "tasks:read"
  | "tasks:write"
  | "analytics:read"
  | "settings:read"
  | "settings:write"
  | "users:manage"
  | "integrations:manage"
  | "ai:use"
  | "platform:manage";

const ALL_APP_PERMISSIONS: Permission[] = [
  "leads:read",
  "leads:write",
  "leads:delete",
  "leads:assign",
  "campaigns:read",
  "campaigns:write",
  "campaigns:delete",
  "deals:read",
  "deals:write",
  "conversations:read",
  "conversations:write",
  "meetings:read",
  "meetings:write",
  "proposals:read",
  "proposals:write",
  "tasks:read",
  "tasks:write",
  "analytics:read",
  "settings:read",
  "settings:write",
  "users:manage",
  "integrations:manage",
  "ai:use",
];

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  SUPER_ADMIN: [...ALL_APP_PERMISSIONS, "platform:manage"],
  ADMIN: [...ALL_APP_PERMISSIONS],
  SALES_MANAGER: [
    "leads:read",
    "leads:write",
    "leads:delete",
    "leads:assign",
    "campaigns:read",
    "campaigns:write",
    "deals:read",
    "deals:write",
    "conversations:read",
    "conversations:write",
    "meetings:read",
    "meetings:write",
    "proposals:read",
    "proposals:write",
    "tasks:read",
    "tasks:write",
    "analytics:read",
    "settings:read",
    "integrations:manage",
    "ai:use",
  ],
  SALES_REPRESENTATIVE: [
    "leads:read",
    "leads:write",
    "campaigns:read",
    "campaigns:write",
    "deals:read",
    "deals:write",
    "conversations:read",
    "conversations:write",
    "meetings:read",
    "meetings:write",
    "proposals:read",
    "tasks:read",
    "tasks:write",
    "settings:read",
    "integrations:manage",
    "ai:use",
  ],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function hasAnyPermission(
  role: UserRole,
  permissions: Permission[]
): boolean {
  return permissions.some((permission) => hasPermission(role, permission));
}

export function isSuperAdmin(role: UserRole): boolean {
  return role === UserRole.SUPER_ADMIN;
}

export function isCompanyAdmin(role: UserRole): boolean {
  return role === UserRole.ADMIN;
}

/** Company admin or platform super admin */
export function isAdmin(role: UserRole): boolean {
  return role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN;
}

export function isManagerOrAbove(role: UserRole): boolean {
  return (
    role === UserRole.SUPER_ADMIN ||
    role === UserRole.ADMIN ||
    role === UserRole.SALES_MANAGER
  );
}
