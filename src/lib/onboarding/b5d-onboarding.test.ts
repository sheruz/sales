import { describe, expect, it } from "vitest";
import {
  ONBOARDING_STEPS,
  isOnboardingStep,
  nextStep,
} from "@/lib/onboarding/steps";
import { ICP_TEMPLATES, getIcpTemplate } from "@/lib/onboarding/icp-templates";

describe("B5d onboarding steps", () => {
  it("has 8 ordered steps ending in start_autopilot", () => {
    expect(ONBOARDING_STEPS).toHaveLength(8);
    expect(ONBOARDING_STEPS[0]).toBe("business_profile");
    expect(ONBOARDING_STEPS[ONBOARDING_STEPS.length - 1]).toBe(
      "start_autopilot"
    );
  });

  it("nextStep advances and ends at null", () => {
    expect(nextStep("business_profile")).toBe("services_case_studies");
    expect(nextStep("start_autopilot")).toBeNull();
    expect(isOnboardingStep("review")).toBe(true);
    expect(isOnboardingStep("nope")).toBe(false);
  });
});

describe("B5d ICP templates", () => {
  it("includes niche templates from the B5 list", () => {
    const ids = ICP_TEMPLATES.map((t) => t.id).sort();
    expect(ids).toEqual(
      [
        "clinics",
        "construction",
        "generic",
        "property_management",
        "trucking",
      ].sort()
    );
    expect(getIcpTemplate("trucking")?.decisionMakerTitles.length).toBeGreaterThan(
      0
    );
  });
});

describe("B5d skip / resume contract", () => {
  it("skipped or completedAt means dismissed", () => {
    const dismissed = (row: { skipped: boolean; completedAt: Date | null }) =>
      Boolean(row.skipped || row.completedAt);
    expect(dismissed({ skipped: true, completedAt: null })).toBe(true);
    expect(dismissed({ skipped: false, completedAt: new Date() })).toBe(true);
    expect(dismissed({ skipped: false, completedAt: null })).toBe(false);
  });
});
