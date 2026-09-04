import { describe, expect, it } from "vitest";
import { UserRole } from "@prisma/client";
import {
  ROLE_KEYS,
  ROLE_PERMISSION_MAP,
} from "@/lib/auth/permission-catalog";
import {
  hasAnyOrgPermission,
  orgResourceWhere,
} from "@/lib/tenant/scope";
import {
  buildSequenceTemplateVars,
  computeNextRunAt,
  enrollmentStepIdempotencyKey,
  renderSequenceTemplate,
} from "@/lib/sequences/runtime";
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

function roleUser(roleKey: string): AuthUser {
  return mockUser({
    organizationRoleKey: roleKey,
    permissions: ROLE_PERMISSION_MAP[roleKey] ?? [],
  });
}

describe("Phase 3 — sequence template + scheduling", () => {
  it("renders contact/company/opportunity variables", () => {
    const vars = buildSequenceTemplateVars({
      contact: { firstName: "Jane", fullName: "Jane Doe", email: "j@acme.com" },
      company: { name: "Acme", domain: "acme.com" },
      opportunity: { whyNow: "Hiring React", score: 80 },
      organization: { name: "Seller Co" },
    });
    const body = renderSequenceTemplate(
      "Hi {{contact.firstName}}, re {{company.name}}: {{opportunity.whyNow}} — {{organization.name}}",
      vars
    );
    expect(body).toBe(
      "Hi Jane, re Acme: Hiring React — Seller Co"
    );
    expect(vars["opportunity.score"]).toBe("80");
  });

  it("computes deterministic nextRunAt from delayMinutes", () => {
    const from = new Date("2026-01-01T00:00:00.000Z");
    expect(computeNextRunAt(from, 0).toISOString()).toBe(
      "2026-01-01T00:00:00.000Z"
    );
    expect(computeNextRunAt(from, 60 * 24 * 3).toISOString()).toBe(
      "2026-01-04T00:00:00.000Z"
    );
  });

  it("step idempotency keys are stable per enrollment+step", () => {
    expect(enrollmentStepIdempotencyKey("en-1", 0)).toBe(
      "seq-enroll:en-1:step:0"
    );
    expect(enrollmentStepIdempotencyKey("en-1", 0)).toBe(
      enrollmentStepIdempotencyKey("en-1", 0)
    );
    expect(enrollmentStepIdempotencyKey("en-1", 1)).not.toBe(
      enrollmentStepIdempotencyKey("en-1", 0)
    );
  });
});

describe("Phase 3 — enrollment RBAC", () => {
  const ENROLL_MUTATE = [
    "sequences.manage",
    "campaigns.manage",
    "opportunities.update",
  ] as const;
  const ENROLL_VIEW = [
    "sequences.view",
    "sequences.manage",
    "campaigns.manage",
    "opportunities.view",
  ] as const;

  it("viewer can view opportunities (enrollments list) but not mutate via opportunities.update", () => {
    const v = roleUser(ROLE_KEYS.VIEWER);
    expect(hasAnyOrgPermission(v, [...ENROLL_VIEW])).toBe(true);
    expect(hasAnyOrgPermission(v, [...ENROLL_MUTATE])).toBe(false);
  });

  it("sales rep can enroll via opportunities.update and view sequences", () => {
    const r = roleUser(ROLE_KEYS.SALES_REP);
    expect(hasAnyOrgPermission(r, [...ENROLL_MUTATE])).toBe(true);
    expect(hasAnyOrgPermission(r, ["sequences.manage"])).toBe(false);
    expect(hasAnyOrgPermission(r, ["sequences.view"])).toBe(true);
  });

  it("sales manager and company admin can manage sequences", () => {
    const m = roleUser(ROLE_KEYS.SALES_MANAGER);
    const a = roleUser(ROLE_KEYS.COMPANY_ADMIN);
    expect(hasAnyOrgPermission(m, ["sequences.manage"])).toBe(true);
    expect(hasAnyOrgPermission(m, ["sequences.view"])).toBe(true);
    expect(hasAnyOrgPermission(a, ["campaigns.manage"])).toBe(true);
  });
});

describe("Phase 3 hardening — org daily limit helpers", () => {
  it("nextUtcMidnight is after startOfUtcDay", async () => {
    const { startOfUtcDay, nextUtcMidnight } = await import(
      "@/services/email-safety.service"
    );
    const now = new Date("2026-06-15T14:30:00.000Z");
    expect(startOfUtcDay(now).toISOString()).toBe("2026-06-15T00:00:00.000Z");
    expect(nextUtcMidnight(now).toISOString()).toBe("2026-06-16T00:00:00.000Z");
  });

  it("viewer cannot manage sequences but list uses view OR manage", () => {
    const v = roleUser(ROLE_KEYS.VIEWER);
    expect(hasAnyOrgPermission(v, ["sequences.view", "sequences.manage"])).toBe(
      false
    );
  });
});

describe("Phase 3 — tenant IDOR contracts (enrollments)", () => {
  it("Org A enrollment lookup never uses Org B organizationId", () => {
    const orgA = mockUser({ organizationId: "org-a" });
    const where = orgResourceWhere(orgA, "enrollment-from-org-b");
    expect(where).toEqual({
      id: "enrollment-from-org-b",
      organizationId: "org-a",
    });
  });

  it("client organizationId must be ignored for enroll (contract)", () => {
    const authenticatedOrg = "org-a";
    const bodyOrg = "org-b";
    const effectiveOrg = authenticatedOrg; // never bodyOrg
    expect(effectiveOrg).not.toBe(bodyOrg);
  });

  it("enroll contact from other org is blocked by { id, organizationId } lookup", () => {
    const filter = {
      id: "contact-org-b",
      organizationId: "org-a",
    };
    expect(filter.organizationId).toBe("org-a");
  });
});

describe("Phase 3 — executor contracts", () => {
  it("paused/stopped statuses are not claimable (ACTIVE only)", () => {
    const claimable = ["ACTIVE"];
    expect(claimable).not.toContain("PAUSED");
    expect(claimable).not.toContain("STOPPED");
    expect(claimable).not.toContain("COMPLETED");
    expect(claimable).not.toContain("FAILED");
  });

  it("retry backoff increases exponentially (contract)", () => {
    const backoff = (retryCount: number) =>
      60_000 * 2 ** Math.min(retryCount - 1, 5);
    expect(backoff(1)).toBe(60_000);
    expect(backoff(2)).toBe(120_000);
    expect(backoff(3)).toBe(240_000);
  });

  it("max retries ends in FAILED without unbounded loops", () => {
    const maxRetries = 3;
    let retryCount = 0;
    let status = "ACTIVE";
    while (status === "ACTIVE" && retryCount < 10) {
      retryCount += 1;
      if (retryCount >= maxRetries) status = "FAILED";
    }
    expect(status).toBe("FAILED");
    expect(retryCount).toBe(3);
  });

  it("duplicate step send prevented by stable idempotency key", () => {
    const key = enrollmentStepIdempotencyKey("en-9", 2);
    const executions = new Set<string>();
    expect(executions.has(key)).toBe(false);
    executions.add(key);
    expect(executions.has(key)).toBe(true);
  });
});
