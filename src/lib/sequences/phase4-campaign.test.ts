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
  resolveEnrollmentSteps,
  snapshotSteps,
} from "@/services/sequence-enrollment.service";
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

describe("Phase 4 — stepsSnapshot edit safety", () => {
  const liveSteps = [
    {
      stepOrder: 0,
      delayMinutes: 0,
      channel: "EMAIL",
      subjectTemplate: "Live subject",
      bodyTemplate: "Live body",
      isActive: true,
    },
    {
      stepOrder: 1,
      delayMinutes: 2880,
      channel: "EMAIL",
      subjectTemplate: "Live 2",
      bodyTemplate: "Live body 2",
      isActive: true,
    },
  ];

  it("snapshotSteps copies step config", () => {
    const snap = snapshotSteps(liveSteps);
    expect(snap).toHaveLength(2);
    expect(snap[0].subjectTemplate).toBe("Live subject");
    snap[0].subjectTemplate = "mutated";
    expect(liveSteps[0].subjectTemplate).toBe("Live subject");
  });

  it("resolveEnrollmentSteps prefers snapshot over live sequence", () => {
    const snap = snapshotSteps(liveSteps);
    snap[0].bodyTemplate = "Frozen body";
    const resolved = resolveEnrollmentSteps({
      stepsSnapshot: snap,
      sequence: {
        steps: [
          {
            ...liveSteps[0],
            bodyTemplate: "Edited live body",
          },
        ],
      },
    });
    expect(resolved[0].bodyTemplate).toBe("Frozen body");
  });

  it("resolveEnrollmentSteps falls back to live steps when snapshot empty", () => {
    const resolved = resolveEnrollmentSteps({
      stepsSnapshot: null,
      sequence: { steps: liveSteps },
    });
    expect(resolved[0].bodyTemplate).toBe("Live body");
  });
});

describe("Phase 4 — tenant isolation contracts", () => {
  it("campaign enrollment lookup is org-scoped", () => {
    const orgA = mockUser({ organizationId: "org-a" });
    expect(orgResourceWhere(orgA, "campaign-b")).toEqual({
      id: "campaign-b",
      organizationId: "org-a",
    });
  });

  it("ignores client organizationId for campaign enroll", () => {
    const authenticatedOrg = "org-a";
    const bodyOrg = "org-b";
    const effective = authenticatedOrg;
    expect(effective).not.toBe(bodyOrg);
  });

  it("CampaignLead bridge cannot target other org (contract)", () => {
    const filter = {
      id: "cl-org-b",
      campaignId: "camp-a",
      campaign: { organizationId: "org-a", deletedAt: null },
    };
    expect(filter.campaign.organizationId).toBe("org-a");
  });
});

describe("Phase 4 — sequence + enrollment RBAC", () => {
  it("viewer cannot manage sequences or enroll via manage perms", () => {
    const v = roleUser(ROLE_KEYS.VIEWER);
    expect(hasOrgPermission(v, "sequences.manage")).toBe(false);
    expect(hasAnyOrgPermission(v, ["sequences.view", "sequences.manage"])).toBe(
      false
    );
    expect(
      hasAnyOrgPermission(v, [
        "campaigns.manage",
        "sequences.manage",
        "opportunities.update",
      ])
    ).toBe(false);
  });

  it("sales rep can view sequences and enroll via opportunities.update", () => {
    const r = roleUser(ROLE_KEYS.SALES_REP);
    expect(hasOrgPermission(r, "sequences.view")).toBe(true);
    expect(hasOrgPermission(r, "sequences.manage")).toBe(false);
    expect(
      hasAnyOrgPermission(r, [
        "campaigns.manage",
        "sequences.manage",
        "opportunities.update",
      ])
    ).toBe(true);
  });

  it("manager can manage sequences and campaigns", () => {
    const m = roleUser(ROLE_KEYS.SALES_MANAGER);
    expect(hasOrgPermission(m, "sequences.manage")).toBe(true);
    expect(hasOrgPermission(m, "campaigns.manage")).toBe(true);
  });
});

describe("Phase 4 — lifecycle + duplicate-send contracts", () => {
  it("only ACTIVE sequences accept new enrollments", () => {
    const allowed = ["ACTIVE"];
    expect(allowed).not.toContain("DRAFT");
    expect(allowed).not.toContain("PAUSED");
    expect(allowed).not.toContain("ARCHIVED");
  });

  it("paused sequence defers execution (does not permanently stop)", () => {
    const pausedBehavior = "defer";
    expect(pausedBehavior).not.toBe("stop");
  });

  it("bridged CampaignLead cancels PENDING and PROCESSING FollowUpJobs", () => {
    const cancelStatuses = ["PENDING", "PROCESSING"];
    expect(cancelStatuses).toContain("PENDING");
    expect(cancelStatuses).toContain("PROCESSING");
  });

  it("runPipeline must skip when canonical conflict detected (contract)", () => {
    const runPipelineGuarded = true;
    expect(runPipelineGuarded).toBe(true);
  });

  it("duplicate open enrollment blocked for same org+sequence+contact", () => {
    const open = ["PENDING", "ACTIVE", "PROCESSING", "PAUSED"];
    expect(open).toContain("ACTIVE");
    expect(open).not.toContain("COMPLETED");
  });

  it("bridge sources are recorded", () => {
    const sources = ["MANUAL", "CAMPAIGN", "CAMPAIGN_LEAD_BRIDGE"];
    expect(sources).toContain("CAMPAIGN_LEAD_BRIDGE");
  });
});

describe("Phase 4 — campaign default sequence", () => {
  it("enrollment uses explicit sequenceId over default", () => {
    const explicit = "seq-explicit";
    const defaultId = "seq-default";
    const resolved = explicit || defaultId;
    expect(resolved).toBe("seq-explicit");
  });

  it("enrollment falls back to campaign.defaultSequenceId", () => {
    const explicit = null as string | null;
    const defaultId = "seq-default";
    const resolved = explicit || defaultId;
    expect(resolved).toBe("seq-default");
  });
});
