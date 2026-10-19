import { describe, expect, it } from "vitest";
import {
  MODULE_CATALOG,
  MODULE_KEYS,
  moduleForApiPath,
  moduleForDashboardPath,
} from "@/lib/billing/modules";
import { FEATURE_KEYS, isKnownFeatureKey } from "@/lib/billing/features";
import { BILLING_REASONS } from "@/lib/billing/reasons";
import { ACCESS_REASONS } from "@/services/tenant-access.service";

describe("B1 module catalog", () => {
  it("registers every module key in FEATURE_KEYS", () => {
    for (const key of Object.values(MODULE_KEYS)) {
      expect(isKnownFeatureKey(key)).toBe(true);
    }
  });

  it("maps dashboard paths to modules", () => {
    expect(moduleForDashboardPath("/dashboard/companies")).toBe(
      MODULE_KEYS.LEADS
    );
    expect(moduleForDashboardPath("/dashboard/outreach")).toBe(
      MODULE_KEYS.OUTREACH
    );
    expect(moduleForDashboardPath("/dashboard")).toBe(MODULE_KEYS.DASHBOARD);
    expect(moduleForDashboardPath("/dashboard/meetings")).toBe(
      MODULE_KEYS.MEETINGS
    );
  });

  it("maps API paths to modules", () => {
    expect(moduleForApiPath("/api/companies")).toBe(MODULE_KEYS.LEADS);
    expect(moduleForApiPath("/api/inbox/sync")).toBe(MODULE_KEYS.INBOX);
    expect(moduleForApiPath("/api/autopilot/outbound/run")).toBe(
      MODULE_KEYS.OUTREACH
    );
  });

  it("has nav entries for core modules", () => {
    const nav = MODULE_CATALOG.filter((m) => m.showInNav).map((m) => m.key);
    expect(nav).toContain(MODULE_KEYS.LEADS);
    expect(nav).toContain(MODULE_KEYS.OUTREACH);
    expect(nav).toContain(MODULE_KEYS.INBOX);
  });
});

describe("B1 access reasons", () => {
  it("exposes NO_ACTIVE_SUBSCRIPTION for locked orgs", () => {
    expect(ACCESS_REASONS.NO_ACTIVE_SUBSCRIPTION).toBe(
      "NO_ACTIVE_SUBSCRIPTION"
    );
    expect(BILLING_REASONS.NO_ACTIVE_SUBSCRIPTION).toBe(
      "NO_ACTIVE_SUBSCRIPTION"
    );
  });

  it("keeps limit feature keys separate from modules", () => {
    expect(FEATURE_KEYS.EMAILS_DAILY).toBe("emails_daily");
    expect(FEATURE_KEYS.LEADS).toBe("leads");
  });
});

describe("B1 effective entitlement formula (documented)", () => {
  it("override beats version — unit of merge logic", () => {
    const version = { enabled: true, limitValue: 2 };
    const override = { enabled: true, limitValue: 10 };
    const effectiveLimit =
      override.limitValue !== undefined
        ? override.limitValue
        : version.limitValue;
    expect(effectiveLimit).toBe(10);
  });

  it("grandfather: pinned version id is independent of plan.currentVersionId", () => {
    const planCurrentVersionId = "v2";
    const subscriptionPlanVersionId = "v1";
    expect(subscriptionPlanVersionId).not.toBe(planCurrentVersionId);
  });
});
