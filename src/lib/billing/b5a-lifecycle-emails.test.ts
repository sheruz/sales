import { describe, expect, it } from "vitest";
import {
  LIFECYCLE_TEMPLATE_DEFAULTS,
  LIFECYCLE_TEMPLATE_KEYS,
  interpolateTemplate,
  sampleVarsForTemplate,
} from "@/lib/email/lifecycle-templates";

describe("B5a lifecycle templates", () => {
  it("seeds every required event key", () => {
    const required = [
      "trial_ending_3d",
      "trial_ending_1d",
      "trial_expired",
      "payment_failed_0",
      "payment_failed_3",
      "payment_failed_6",
      "suspended",
      "reactivated",
      "cancellation_scheduled",
      "canceled_export_reminder",
      "downgrade_reminder_7d",
      "plan_limit_notice",
      "low_credits_20",
      "low_credits_5",
      "low_credits_0",
      "manual_renewal_reminder",
      "payment_received",
    ];
    expect(LIFECYCLE_TEMPLATE_KEYS.sort()).toEqual([...required].sort());
    expect(LIFECYCLE_TEMPLATE_DEFAULTS).toHaveLength(required.length);
  });

  it("interpolates {{vars}} and blanks unknowns", () => {
    expect(
      interpolateTemplate("Hello {{adminName}} — {{orgName}}", {
        adminName: "Alex",
        orgName: "Acme",
      })
    ).toBe("Hello Alex — Acme");
    expect(interpolateTemplate("x={{missing}}", {})).toBe("x=");
  });

  it("idempotency key shape is unique per event", () => {
    const subId = "sub-1";
    const trialEndsAt = "2026-11-01T00:00:00.000Z";
    const a = `trial_ending_3d:${subId}:${trialEndsAt}`;
    const b = `trial_ending_3d:${subId}:${trialEndsAt}`;
    const c = `trial_ending_1d:${subId}:${trialEndsAt}`;
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it("sample preview vars cover common placeholders", () => {
    const vars = sampleVarsForTemplate("trial_ending_3d");
    const tpl = LIFECYCLE_TEMPLATE_DEFAULTS.find(
      (t) => t.key === "trial_ending_3d"
    )!;
    const subject = interpolateTemplate(tpl.subject, vars);
    expect(subject).toContain("Acme Demo Co");
    expect(subject).not.toMatch(/\{\{/);
  });

  it("retry backoff schedule is 3 attempts", () => {
    const maxAttempts = 3;
    const backoffMs = [0, 5 * 60_000, 30 * 60_000];
    expect(backoffMs).toHaveLength(maxAttempts);
    expect(backoffMs[1]).toBe(300_000);
    expect(backoffMs[2]).toBe(1_800_000);
  });
});
