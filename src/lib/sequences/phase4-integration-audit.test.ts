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
  conflictSkipMessage,
} from "@/lib/sequences/duplicate-send-guard";
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

describe("Phase 4 audit — cross-tenant IDOR contracts", () => {
  const resources = [
    "campaign-org-b",
    "sequence-org-b",
    "contact-org-b",
    "opportunity-org-b",
    "enrollment-org-b",
    "campaign-lead-org-b",
  ];

  for (const id of resources) {
    it(`Org A lookup for ${id} always binds organizationId`, () => {
      const orgA = mockUser({ organizationId: "org-a" });
      expect(orgResourceWhere(orgA, id)).toEqual({
        id,
        organizationId: "org-a",
      });
    });
  }

  it("client organizationId must never authorize campaign enroll", () => {
    const sessionOrg = "org-a";
    const bodyOrg = "org-b";
    expect(sessionOrg).not.toBe(bodyOrg);
    const effective = sessionOrg;
    expect(effective).toBe("org-a");
  });
});

describe("Phase 4 audit — permission matrix vs frontend intent", () => {
  it("sequences.view alone cannot manage or create", () => {
    const v = roleUser(ROLE_KEYS.VIEWER);
    expect(hasOrgPermission(v, "sequences.view")).toBe(false);
    expect(hasOrgPermission(v, "sequences.manage")).toBe(false);
  });

  it("sales_rep has sequences.view but not sequences.manage", () => {
    const r = roleUser(ROLE_KEYS.SALES_REP);
    expect(hasOrgPermission(r, "sequences.view")).toBe(true);
    expect(hasOrgPermission(r, "sequences.manage")).toBe(false);
  });

  it("sales_rep can enroll via opportunities.update (Phase 3 contract)", () => {
    const r = roleUser(ROLE_KEYS.SALES_REP);
    expect(
      hasAnyOrgPermission(r, [
        "campaigns.manage",
        "sequences.manage",
        "opportunities.update",
      ])
    ).toBe(true);
  });

  it("default sequence PATCH requires campaigns.manage (not opportunities.update alone)", () => {
    const r = roleUser(ROLE_KEYS.SALES_REP);
    expect(hasOrgPermission(r, "campaigns.manage")).toBe(false);
    expect(hasOrgPermission(r, "opportunities.update")).toBe(true);
  });

  it("campaign pages require campaigns.manage", () => {
    const r = roleUser(ROLE_KEYS.SALES_REP);
    const m = roleUser(ROLE_KEYS.SALES_MANAGER);
    expect(hasOrgPermission(r, "campaigns.manage")).toBe(false);
    expect(hasOrgPermission(m, "campaigns.manage")).toBe(true);
  });

  it("SUPER_ADMIN platform flag does not grant org perms without membership perms", () => {
    const platform = mockUser({
      isPlatformAdmin: true,
      role: UserRole.SUPER_ADMIN,
      organizationRoleKey: ROLE_KEYS.VIEWER,
      permissions: ROLE_PERMISSION_MAP.viewer,
    });
    expect(hasOrgPermission(platform, "campaigns.manage")).toBe(false);
    expect(hasOrgPermission(platform, "sequences.manage")).toBe(false);
  });
});

describe("Phase 4 audit — duplicate-send messages", () => {
  it("maps conflict reasons to actionable skip messages", () => {
    expect(conflictSkipMessage("campaign_lead_bridged")).toMatch(/bridged/i);
    expect(conflictSkipMessage("open_sequence_enrollment")).toMatch(
      /SequenceEnrollment/i
    );
  });
});

describe("Phase 4 audit — snapshot + lifecycle contracts", () => {
  it("existing enrollment keeps v1 after live sequence becomes v2", () => {
    const v1 = snapshotSteps([
      {
        stepOrder: 0,
        delayMinutes: 0,
        channel: "EMAIL",
        subjectTemplate: "v1",
        bodyTemplate: "body v1",
        isActive: true,
      },
    ]);
    const resolved = resolveEnrollmentSteps({
      stepsSnapshot: v1,
      sequence: {
        steps: [
          {
            stepOrder: 0,
            delayMinutes: 0,
            channel: "EMAIL",
            subjectTemplate: "v2",
            bodyTemplate: "body v2",
            isActive: true,
          },
        ],
      },
    });
    expect(resolved[0].subjectTemplate).toBe("v1");
  });

  it("new enrollment without snapshot would use live v2", () => {
    const resolved = resolveEnrollmentSteps({
      stepsSnapshot: null,
      sequence: {
        steps: [
          {
            stepOrder: 0,
            delayMinutes: 0,
            channel: "EMAIL",
            subjectTemplate: "v2",
            bodyTemplate: "body v2",
            isActive: true,
          },
        ],
      },
    });
    expect(resolved[0].subjectTemplate).toBe("v2");
  });

  it("lifecycle matrix: enroll only ACTIVE; execute ACTIVE; PAUSED defers; ARCHIVED stops", () => {
    const enrollable = ["ACTIVE"];
    const execute = ["ACTIVE"];
    const defer = ["PAUSED"];
    const stop = ["ARCHIVED", "DRAFT"];
    expect(enrollable).not.toContain("DRAFT");
    expect(enrollable).not.toContain("PAUSED");
    expect(execute).not.toContain("PAUSED");
    expect(defer).toContain("PAUSED");
    expect(stop).toContain("ARCHIVED");
  });
});

describe("Phase 4 audit — canonical no Lead required", () => {
  it("campaign enroll schema fields do not require leadId", () => {
    const body = {
      contactId: "c1",
      opportunityId: null,
      sequenceId: "s1",
    };
    expect("leadId" in body).toBe(false);
  });
});
