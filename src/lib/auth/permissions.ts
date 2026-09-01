import { UserRole } from "@prisma/client";

export const SESSION_COOKIE = "session_token";

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "Admin",
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
  | "ai:use";

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  ADMIN: [
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
    "ai:use",
  ],
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
    "ai:use",
  ],
  SALES_REPRESENTATIVE: [
    "leads:read",
    "leads:write",
    "campaigns:read",
    "deals:read",
    "deals:write",
    "conversations:read",
    "conversations:write",
    "meetings:read",
    "meetings:write",
    "proposals:read",
    "tasks:read",
    "tasks:write",
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

export function isAdmin(role: UserRole): boolean {
  return role === UserRole.ADMIN;
}

export function isManagerOrAbove(role: UserRole): boolean {
  return role === UserRole.ADMIN || role === UserRole.SALES_MANAGER;
}
