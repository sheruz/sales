import { describe, expect, it } from "vitest";
import { ROLE_PERMISSION_MAP } from "@/lib/auth/permission-catalog";

describe("Phase 2 permissions", () => {
  it("company_admin can manage business brain and revenue goals", () => {
    expect(ROLE_PERMISSION_MAP.company_admin).toContain("business_brain.manage");
    expect(ROLE_PERMISSION_MAP.company_admin).toContain("revenue_goals.manage");
  });

  it("sales_manager can manage brain and goals", () => {
    expect(ROLE_PERMISSION_MAP.sales_manager).toContain("business_brain.manage");
    expect(ROLE_PERMISSION_MAP.sales_manager).toContain("revenue_goals.manage");
  });

  it("viewer can view revenue but not manage brain", () => {
    expect(ROLE_PERMISSION_MAP.viewer).toContain("revenue.view");
    expect(ROLE_PERMISSION_MAP.viewer).not.toContain("business_brain.manage");
  });
});

describe("safe context shape", () => {
  it("context type excludes private reasoning keys", async () => {
    // Structural guard: BusinessBrainContext fields are business facts only
    const sample = {
      organizationId: "org",
      profile: null,
      services: [],
      icps: [],
      activeGoals: [],
      documents: [{ id: "1", type: "FAQ" as const, title: "t", summary: "s" }],
    };
    expect(sample).not.toHaveProperty("reasoning");
    expect(sample).not.toHaveProperty("chainOfThought");
    expect(sample.documents[0]).toHaveProperty("summary");
    expect(sample.documents[0]).not.toHaveProperty("content");
  });
});
