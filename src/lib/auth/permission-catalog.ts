/** Canonical permission keys (Phase 1). Stored in `permissions` table. */
export const PERMISSION_KEYS = [
  "organization.view",
  "organization.update",
  "users.view",
  "users.create",
  "users.update",
  "users.delete",
  "users.invite",
  "leads.view",
  "leads.create",
  "leads.update",
  "leads.delete",
  "opportunities.view",
  "opportunities.create",
  "opportunities.update",
  "opportunities.delete",
  "campaigns.manage",
  "sequences.manage",
  "conversations.view",
  "conversations.manage",
  "deals.manage",
  "revenue.view",
  "analytics.view",
  "integrations.manage",
  "business_brain.manage",
  "revenue_goals.manage",
  "billing.manage",
  "agent.view",
  "agent.manage",
  "agent.approve",
  "platform.manage",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export const ROLE_KEYS = {
  PLATFORM_ADMIN: "platform_admin",
  COMPANY_ADMIN: "company_admin",
  SALES_MANAGER: "sales_manager",
  SALES_REP: "sales_rep",
  VIEWER: "viewer",
} as const;

export type RoleKey = (typeof ROLE_KEYS)[keyof typeof ROLE_KEYS];

/** Default permission sets per organization role */
export const ROLE_PERMISSION_MAP: Record<string, PermissionKey[]> = {
  platform_admin: [...PERMISSION_KEYS],
  company_admin: PERMISSION_KEYS.filter((k) => k !== "platform.manage"),
  sales_manager: [
    "organization.view",
    "users.view",
    "leads.view",
    "leads.create",
    "leads.update",
    "leads.delete",
    "opportunities.view",
    "opportunities.create",
    "opportunities.update",
    "campaigns.manage",
    "sequences.manage",
    "conversations.view",
    "conversations.manage",
    "deals.manage",
    "analytics.view",
    "integrations.manage",
    "business_brain.manage",
    "revenue_goals.manage",
    "revenue.view",
    "agent.view",
    "agent.manage",
    "agent.approve",
  ],
  sales_rep: [
    "organization.view",
    "leads.view",
    "leads.create",
    "leads.update",
    "opportunities.view",
    "opportunities.update",
    "conversations.view",
    "conversations.manage",
    "deals.manage",
    "integrations.manage",
    "revenue.view",
    "agent.view",
  ],
  viewer: [
    "organization.view",
    "leads.view",
    "opportunities.view",
    "conversations.view",
    "analytics.view",
    "revenue.view",
    "agent.view",
  ],
};

/** Map legacy UserRole → Role.key */
export function legacyUserRoleToRoleKey(
  role: "SUPER_ADMIN" | "ADMIN" | "SALES_MANAGER" | "SALES_REPRESENTATIVE"
): RoleKey {
  switch (role) {
    case "SUPER_ADMIN":
      return ROLE_KEYS.PLATFORM_ADMIN;
    case "ADMIN":
      return ROLE_KEYS.COMPANY_ADMIN;
    case "SALES_MANAGER":
      return ROLE_KEYS.SALES_MANAGER;
    default:
      return ROLE_KEYS.SALES_REP;
  }
}
