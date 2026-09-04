import { describe, expect, it } from "vitest";
import {
  assertSameOrganization,
  hasOrgPermission,
  requireOrganizationId,
} from "@/lib/tenant/scope";
import {
  ROLE_PERMISSION_MAP,
  ROLE_KEYS,
  PERMISSION_KEYS,
} from "@/lib/auth/permission-catalog";
import { ForbiddenError } from "@/lib/api/response";
import type { AuthUser } from "@/types/auth";
import { UserRole } from "@prisma/client";

function mockUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "user-a",
    email: "a@example.com",
    firstName: "A",
    lastName: "User",
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

describe("tenant scope", () => {
  it("requireOrganizationId returns active org", () => {
    expect(requireOrganizationId(mockUser())).toBe("org-a");
  });

  it("requireOrganizationId rejects missing org", () => {
    expect(() =>
      requireOrganizationId(mockUser({ organizationId: null }))
    ).toThrow(ForbiddenError);
  });

  it("assertSameOrganization blocks cross-tenant ID access", () => {
    expect(() =>
      assertSameOrganization(mockUser(), "org-b")
    ).toThrow(ForbiddenError);
  });

  it("assertSameOrganization allows matching org", () => {
    expect(() =>
      assertSameOrganization(mockUser(), "org-a")
    ).not.toThrow();
  });

  it("platform admin does not bypass org assertion without membership org", () => {
    expect(() =>
      assertSameOrganization(
        mockUser({
          isPlatformAdmin: true,
          organizationId: null,
          permissions: ["platform.manage"],
        }),
        "org-b"
      )
    ).toThrow(ForbiddenError);
  });

  it("platform admin with active org still cannot access other org resources", () => {
    expect(() =>
      assertSameOrganization(
        mockUser({
          isPlatformAdmin: true,
          organizationId: "org-a",
          permissions: ["platform.manage"],
        }),
        "org-b"
      )
    ).toThrow(ForbiddenError);
  });
});

describe("org RBAC", () => {
  it("company admin cannot platform.manage", () => {
    expect(
      hasOrgPermission(mockUser(), "platform.manage")
    ).toBe(false);
  });

  it("sales_rep cannot manage billing", () => {
    const rep = mockUser({
      organizationRoleKey: ROLE_KEYS.SALES_REP,
      permissions: ROLE_PERMISSION_MAP.sales_rep,
      role: UserRole.SALES_REPRESENTATIVE,
    });
    expect(hasOrgPermission(rep, "billing.manage")).toBe(false);
    expect(hasOrgPermission(rep, "leads.view")).toBe(true);
    expect(hasOrgPermission(rep, "analytics.view")).toBe(false);
    expect(hasOrgPermission(rep, "agent.view")).toBe(false);
    expect(hasOrgPermission(rep, "campaigns.manage")).toBe(false);
  });

  it("viewer is read-mostly", () => {
    const viewer = mockUser({
      organizationRoleKey: ROLE_KEYS.VIEWER,
      permissions: ROLE_PERMISSION_MAP.viewer,
    });
    expect(hasOrgPermission(viewer, "leads.create")).toBe(false);
    expect(hasOrgPermission(viewer, "analytics.view")).toBe(true);
    expect(hasOrgPermission(viewer, "agent.view")).toBe(false);
    expect(hasOrgPermission(viewer, "business_brain.manage")).toBe(false);
  });

  it("sales_manager can use analytics and revenue agent", () => {
    const manager = mockUser({
      organizationRoleKey: ROLE_KEYS.SALES_MANAGER,
      permissions: ROLE_PERMISSION_MAP.sales_manager,
      role: UserRole.SALES_MANAGER,
    });
    expect(hasOrgPermission(manager, "analytics.view")).toBe(true);
    expect(hasOrgPermission(manager, "agent.view")).toBe(true);
    expect(hasOrgPermission(manager, "agent.approve")).toBe(true);
    expect(hasOrgPermission(manager, "campaigns.manage")).toBe(true);
  });

  it("permission catalog is complete for platform_admin", () => {
    expect(ROLE_PERMISSION_MAP.platform_admin).toEqual([...PERMISSION_KEYS]);
  });
});
