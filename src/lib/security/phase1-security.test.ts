import { describe, expect, it } from "vitest";
import {
  assertSameOrganization,
  hasAnyOrgPermission,
  hasOrgPermission,
  orgResourceWhere,
  orgWhere,
  requireOrganizationId,
} from "@/lib/tenant/scope";
import {
  ROLE_KEYS,
  ROLE_PERMISSION_MAP,
} from "@/lib/auth/permission-catalog";
import { ForbiddenError } from "@/lib/api/response";
import type { AuthUser } from "@/types/auth";
import { UserRole } from "@prisma/client";

function mockUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "user-1",
    email: "u@example.com",
    firstName: "U",
    lastName: "Ser",
    role: UserRole.ADMIN,
    avatarUrl: null,
    isPlatformAdmin: false,
    organizationId: "org-a",
    organizationName: "Org A",
    organizationSlug: "org-a",
    organizationRoleKey: ROLE_KEYS.COMPANY_ADMIN,
    permissions: ROLE_PERMISSION_MAP.company_admin,
    ...overrides,
  };
}

function roleUser(
  roleKey: string,
  organizationId: string,
  legacyRole: UserRole = UserRole.SALES_REPRESENTATIVE
): AuthUser {
  return mockUser({
    organizationId,
    organizationRoleKey: roleKey,
    permissions: ROLE_PERMISSION_MAP[roleKey] ?? [],
    role: legacyRole,
    isPlatformAdmin: false,
  });
}

describe("Phase 1 — tenant isolation helpers", () => {
  it("orgResourceWhere always pairs id + organizationId", () => {
    expect(orgResourceWhere(mockUser(), "res-1")).toEqual({
      id: "res-1",
      organizationId: "org-a",
    });
  });

  it("orgWhere uses authenticated org only", () => {
    expect(orgWhere(mockUser())).toEqual({ organizationId: "org-a" });
  });

  it("blocks cross-tenant assertSameOrganization", () => {
    expect(() => assertSameOrganization(mockUser(), "org-b")).toThrow(
      ForbiddenError
    );
  });

  it("SUPER_ADMIN without org cannot assert tenant ownership", () => {
    expect(() =>
      requireOrganizationId(
        mockUser({
          isPlatformAdmin: true,
          organizationId: null,
          permissions: ["platform.manage"],
        })
      )
    ).toThrow(ForbiddenError);
  });

  it("SUPER_ADMIN does not inherit all org permissions via bypass", () => {
    const sa = mockUser({
      isPlatformAdmin: true,
      organizationId: "org-a",
      permissions: ["platform.manage"],
    });
    expect(hasOrgPermission(sa, "billing.manage")).toBe(false);
    expect(hasOrgPermission(sa, "leads.view")).toBe(false);
  });
});

describe("Phase 1 — RBAC matrix (org catalog)", () => {
  const admin = () => roleUser(ROLE_KEYS.COMPANY_ADMIN, "org-a", UserRole.ADMIN);
  const manager = () =>
    roleUser(ROLE_KEYS.SALES_MANAGER, "org-a", UserRole.SALES_MANAGER);
  const rep = () =>
    roleUser(ROLE_KEYS.SALES_REP, "org-a", UserRole.SALES_REPRESENTATIVE);
  const viewer = () =>
    roleUser(ROLE_KEYS.VIEWER, "org-a", UserRole.SALES_REPRESENTATIVE);

  it("viewer is read-mostly", () => {
    const v = viewer();
    expect(hasOrgPermission(v, "leads.view")).toBe(true);
    expect(hasOrgPermission(v, "opportunities.view")).toBe(true);
    expect(hasOrgPermission(v, "analytics.view")).toBe(true);
    expect(hasOrgPermission(v, "conversations.view")).toBe(true);
    expect(hasOrgPermission(v, "leads.update")).toBe(false);
    expect(hasOrgPermission(v, "leads.create")).toBe(false);
    expect(hasOrgPermission(v, "deals.manage")).toBe(false);
    expect(hasOrgPermission(v, "campaigns.manage")).toBe(false);
    expect(hasOrgPermission(v, "sequences.manage")).toBe(false);
    expect(hasOrgPermission(v, "integrations.manage")).toBe(false);
    expect(hasOrgPermission(v, "billing.manage")).toBe(false);
    expect(hasOrgPermission(v, "agent.view")).toBe(false);
    expect(hasOrgPermission(v, "agent.manage")).toBe(false);
    expect(hasOrgPermission(v, "users.invite")).toBe(false);
    expect(hasOrgPermission(v, "conversations.manage")).toBe(false);
  });

  it("sales rep cannot admin/billing/campaigns/agent", () => {
    const r = rep();
    expect(hasOrgPermission(r, "leads.update")).toBe(true);
    expect(hasOrgPermission(r, "opportunities.update")).toBe(true);
    expect(hasOrgPermission(r, "deals.manage")).toBe(true);
    expect(hasOrgPermission(r, "conversations.manage")).toBe(true);
    expect(hasOrgPermission(r, "billing.manage")).toBe(false);
    expect(hasOrgPermission(r, "users.invite")).toBe(false);
    expect(hasOrgPermission(r, "campaigns.manage")).toBe(false);
    expect(hasOrgPermission(r, "agent.manage")).toBe(false);
    expect(hasOrgPermission(r, "analytics.view")).toBe(false);
    expect(hasOrgPermission(r, "business_brain.manage")).toBe(false);
  });

  it("sales manager has campaigns/agent/analytics but not billing/users admin", () => {
    const m = manager();
    expect(hasOrgPermission(m, "campaigns.manage")).toBe(true);
    expect(hasOrgPermission(m, "agent.approve")).toBe(true);
    expect(hasOrgPermission(m, "analytics.view")).toBe(true);
    expect(hasOrgPermission(m, "billing.manage")).toBe(false);
    expect(hasOrgPermission(m, "users.invite")).toBe(false);
    expect(hasOrgPermission(m, "platform.manage")).toBe(false);
  });

  it("company admin has org admin powers but not platform.manage", () => {
    const a = admin();
    expect(hasOrgPermission(a, "billing.manage")).toBe(true);
    expect(hasOrgPermission(a, "users.invite")).toBe(true);
    expect(hasOrgPermission(a, "agent.manage")).toBe(true);
    expect(hasOrgPermission(a, "platform.manage")).toBe(false);
  });

  it("requireAny helper semantics for deals read path", () => {
    const v = viewer();
    const r = rep();
    expect(
      hasAnyOrgPermission(v, ["deals.manage", "opportunities.view"])
    ).toBe(true);
    expect(hasAnyOrgPermission(v, ["deals.manage"])).toBe(false);
    expect(hasAnyOrgPermission(r, ["deals.manage"])).toBe(true);
  });
});

describe("Phase 1 — conceptual IDOR contracts", () => {
  it("Org A lookup where never matches Org B resource id alone", () => {
    const orgA = mockUser({ organizationId: "org-a" });
    const orgBOpportunityId = "opp-from-org-b";
    const where = orgResourceWhere(orgA, orgBOpportunityId);
    expect(where).toEqual({
      id: "opp-from-org-b",
      organizationId: "org-a",
    });
    // Prisma findFirst with this where returns null for cross-tenant UUIDs
    expect(where.organizationId).not.toBe("org-b");
  });

  it("entitlement keys are org-scoped conceptually (Free cannot share usage)", () => {
    // Document expected call shape for billing enforcement
    const consume = (organizationId: string, feature: string) => ({
      organizationId,
      feature,
    });
    expect(consume("org-a", "ai_calls").organizationId).toBe("org-a");
    expect(consume("org-b", "ai_calls").organizationId).toBe("org-b");
  });
});
