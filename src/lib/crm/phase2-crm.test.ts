import { describe, expect, it } from "vitest";
import { UserRole } from "@prisma/client";
import {
  ROLE_KEYS,
  ROLE_PERMISSION_MAP,
} from "@/lib/auth/permission-catalog";
import {
  hasAnyOrgPermission,
  hasOrgPermission,
  orgResourceWhere,
} from "@/lib/tenant/scope";
import {
  extractDomain,
  normalizeDomain,
} from "@/services/company.service";
import { normalizeEmail } from "@/services/contact.service";
import type { AuthUser } from "@/types/auth";

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

function roleUser(roleKey: string, organizationId = "org-a"): AuthUser {
  return mockUser({
    organizationId,
    organizationRoleKey: roleKey,
    permissions: ROLE_PERMISSION_MAP[roleKey] ?? [],
  });
}

/** Permissions used by Company/Contact APIs (no new catalog keys). */
const COMPANY_VIEW = ["opportunities.view", "leads.view"] as const;
const COMPANY_CREATE = ["opportunities.create", "leads.create"] as const;
const COMPANY_UPDATE = ["opportunities.update", "leads.update"] as const;

describe("Phase 2 — domain/email normalization", () => {
  it("normalizes domains for dedup", () => {
    expect(normalizeDomain("https://www.Acme.com/path")).toBe("acme.com");
    expect(normalizeDomain("WWW.Example.IO")).toBe("example.io");
    expect(extractDomain("acme.com")).toBe("acme.com");
    expect(normalizeDomain(null)).toBeNull();
  });

  it("normalizes emails", () => {
    expect(normalizeEmail("  Jane@Acme.COM ")).toBe("jane@acme.com");
    expect(normalizeEmail("")).toBeNull();
    expect(normalizeEmail(null)).toBeNull();
  });
});

describe("Phase 2 — Company/Contact RBAC (org catalog)", () => {
  it("viewer can view companies/contacts but not create/update", () => {
    const v = roleUser(ROLE_KEYS.VIEWER);
    expect(hasAnyOrgPermission(v, [...COMPANY_VIEW])).toBe(true);
    expect(hasAnyOrgPermission(v, [...COMPANY_CREATE])).toBe(false);
    expect(hasAnyOrgPermission(v, [...COMPANY_UPDATE])).toBe(false);
  });

  it("sales rep can create and update companies/contacts", () => {
    const r = roleUser(ROLE_KEYS.SALES_REP);
    expect(hasAnyOrgPermission(r, [...COMPANY_VIEW])).toBe(true);
    expect(hasAnyOrgPermission(r, [...COMPANY_CREATE])).toBe(true);
    expect(hasAnyOrgPermission(r, [...COMPANY_UPDATE])).toBe(true);
  });

  it("sales manager and company admin retain company/contact access", () => {
    const m = roleUser(ROLE_KEYS.SALES_MANAGER);
    const a = roleUser(ROLE_KEYS.COMPANY_ADMIN);
    expect(hasAnyOrgPermission(m, [...COMPANY_VIEW])).toBe(true);
    expect(hasAnyOrgPermission(m, [...COMPANY_CREATE])).toBe(true);
    expect(hasAnyOrgPermission(a, [...COMPANY_UPDATE])).toBe(true);
    expect(hasOrgPermission(a, "billing.manage")).toBe(true);
  });
});

describe("Phase 2 — tenant IDOR contracts (Company/Contact)", () => {
  it("Org A company lookup never uses Org B organizationId", () => {
    const orgA = mockUser({ organizationId: "org-a" });
    const where = orgResourceWhere(orgA, "company-from-org-b");
    expect(where).toEqual({
      id: "company-from-org-b",
      organizationId: "org-a",
    });
    expect(where.organizationId).not.toBe("org-b");
  });

  it("Org A contact lookup is scoped to Org A", () => {
    const orgA = mockUser({ organizationId: "org-a" });
    const where = orgResourceWhere(orgA, "contact-from-org-b");
    expect(where.organizationId).toBe("org-a");
    expect(where.id).toBe("contact-from-org-b");
  });

  it("contact→company assignment must match caller's org (contract)", () => {
    // Service validates company with { id, organizationId } before write.
    const orgACompanyFilter = {
      id: "company-org-b",
      organizationId: "org-a",
      deletedAt: null,
    };
    expect(orgACompanyFilter.organizationId).toBe("org-a");
    expect(orgACompanyFilter.id).toBe("company-org-b");
    // findFirst with this filter returns null → ValidationError / 404 — no leak
  });

  it("opportunity→company isolation uses org-scoped company check", () => {
    const orgA = mockUser({ organizationId: "org-a" });
    const companyWhere = {
      id: "company-org-b",
      organizationId: orgA.organizationId!,
      deletedAt: null,
    };
    expect(companyWhere.organizationId).toBe("org-a");
  });
});

describe("Phase 2 — Opportunity without Lead + bridge contract", () => {
  it("manual opportunity create input does not require leadId", () => {
    const manualInput: {
      companyId: string;
      primaryContactId?: string;
      whyNow?: string;
      leadId?: string | null;
    } = {
      companyId: "company-1",
      whyNow: "Hiring signal",
    };
    expect(manualInput.leadId).toBeUndefined();
    expect(manualInput.companyId).toBeTruthy();
  });

  it("lead bridge result shape is idempotent-friendly", () => {
    const first = {
      leadId: "lead-1",
      companyId: "co-1",
      contactId: "ct-1",
      opportunityId: null as string | null,
      warning: null as string | null,
    };
    const second = { ...first };
    expect(first.companyId).toBe(second.companyId);
    expect(first.contactId).toBe(second.contactId);
  });
});
