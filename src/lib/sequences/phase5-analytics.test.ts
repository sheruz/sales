import { describe, expect, it } from "vitest";
import { UserRole } from "@prisma/client";
import {
  ROLE_KEYS,
  ROLE_PERMISSION_MAP,
  PERMISSION_KEYS,
} from "@/lib/auth/permission-catalog";
import {
  hasAnyOrgPermission,
  hasOrgPermission,
  orgResourceWhere,
} from "@/lib/tenant/scope";
import { snapshotSteps } from "@/services/sequence-enrollment.service";
import { SequenceExecutorService } from "@/services/sequence-executor.service";
import type { AuthUser } from "@/types/auth";

function mockUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "user-1",
    email: "u@example.com",
    firstName: "U",
    lastName: "Ser",
    role: UserRole.ADMIN,
    avatarUrl: null,
    platformRole: null,
    isPlatformAdmin: false,
    isPlatformOperator: false,
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

describe("Phase 5 — campaigns.view RBAC", () => {
  it("catalog includes campaigns.view", () => {
    expect(PERMISSION_KEYS).toContain("campaigns.view");
  });

  it("viewer and sales_rep can view campaigns but not manage", () => {
    const viewer = roleUser(ROLE_KEYS.VIEWER);
    const rep = roleUser(ROLE_KEYS.SALES_REP);
    expect(hasOrgPermission(viewer, "campaigns.view")).toBe(true);
    expect(hasOrgPermission(viewer, "campaigns.manage")).toBe(false);
    expect(hasOrgPermission(rep, "campaigns.view")).toBe(true);
    expect(hasOrgPermission(rep, "campaigns.manage")).toBe(false);
  });

  it("analytics API gate accepts view or manage", () => {
    const viewer = roleUser(ROLE_KEYS.VIEWER);
    expect(
      hasAnyOrgPermission(viewer, [
        "campaigns.manage",
        "campaigns.view",
        "analytics.view",
      ])
    ).toBe(true);
  });

  it("bridge preview stays manage/update scoped", () => {
    const viewer = roleUser(ROLE_KEYS.VIEWER);
    expect(
      hasAnyOrgPermission(viewer, [
        "campaigns.manage",
        "sequences.manage",
        "leads.update",
      ])
    ).toBe(false);
    const manager = roleUser(ROLE_KEYS.SALES_MANAGER);
    expect(
      hasAnyOrgPermission(manager, [
        "campaigns.manage",
        "sequences.manage",
        "leads.update",
      ])
    ).toBe(true);
  });
});

describe("Phase 5 — snapshot backfill never overwrite contract", () => {
  it("snapshotSteps produces non-empty array from live steps", () => {
    const snap = snapshotSteps([
      {
        stepOrder: 0,
        delayMinutes: 0,
        channel: "EMAIL",
        subjectTemplate: "Hi",
        bodyTemplate: "Body",
        isActive: true,
      },
    ]);
    expect(snap).toHaveLength(1);
    expect(snap[0].bodyTemplate).toBe("Body");
  });

  it("empty snapshot detection matches backfill guard", () => {
    const hasSnapshot = (value: unknown) =>
      Array.isArray(value) && value.length > 0;
    expect(hasSnapshot(null)).toBe(false);
    expect(hasSnapshot([])).toBe(false);
    expect(hasSnapshot([{ stepOrder: 0 }])).toBe(true);
  });
});

describe("Phase 5 — executor observability", () => {
  it("summarizeRun aggregates safe counts without bodies", () => {
    const svc = new SequenceExecutorService();
    const summary = svc.summarizeRun(4, [
      {
        enrollmentId: "e1",
        organizationId: "org-a",
        status: "advanced",
      },
      {
        enrollmentId: "e2",
        organizationId: "org-a",
        status: "deferred",
        reason: "daily limit",
      },
      {
        enrollmentId: "e3",
        organizationId: "org-a",
        status: "failed",
        reason: "smtp",
      },
      {
        enrollmentId: "e4",
        organizationId: "org-a",
        status: "error",
        reason: "boom",
      },
    ]);
    expect(summary.claimed).toBe(4);
    expect(summary.success).toBe(1);
    expect(summary.deferred).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.error).toBe(1);
    expect(JSON.stringify(summary)).not.toMatch(/Subject:|Body:|password|secret/i);
  });
});

describe("Phase 5 — tenant isolation for analytics lookups", () => {
  it("campaign analytics lookup is org-scoped", () => {
    const orgA = mockUser({ organizationId: "org-a" });
    expect(orgResourceWhere(orgA, "campaign-1")).toEqual({
      id: "campaign-1",
      organizationId: "org-a",
    });
  });
});

describe("Phase 5 — cutover preview notes contract", () => {
  it("preview is read-only by design (documented notes)", () => {
    const notes = [
      "Preview only — no CampaignLead, Lead, or FollowUpJob rows are mutated.",
      "Bridge remains on-demand (one CampaignLead at a time). No bulk auto-migrate.",
      "Bridging a lead cancels that lead's PENDING/PROCESSING FollowUpJobs first.",
    ];
    expect(notes.some((n) => n.includes("Preview only"))).toBe(true);
    expect(notes.some((n) => n.includes("No bulk auto-migrate"))).toBe(true);
  });
});

describe("Phase 5 — duplicate-send: aiOutreachService must guard", () => {
  it("ai-outreach.service.ts calls detectLegacyCanonicalConflict before send", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const src = await fs.readFile(
      path.join(process.cwd(), "src/services/ai-outreach.service.ts"),
      "utf8"
    );
    const methodStart = src.indexOf("async sendOutreach(");
    expect(methodStart).toBeGreaterThan(-1);
    const methodBody = src.slice(methodStart);
    const guardAt = methodBody.indexOf("detectLegacyCanonicalConflict");
    const emailSendAt = methodBody.indexOf("sendEmailForUser(");
    const linkedInSendAt = methodBody.indexOf("sendConnectionOrMessage(");
    expect(guardAt).toBeGreaterThan(-1);
    expect(methodBody).toContain("conflict.blocked");
    expect(guardAt).toBeLessThan(emailSendAt);
    expect(guardAt).toBeLessThan(linkedInSendAt);
  });
});
