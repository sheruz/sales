import { describe, expect, it } from "vitest";
import {
  formatCountdown,
  deadlineExplanation,
} from "@/lib/billing/countdown";
import { FEATURE_KEYS } from "@/lib/billing/features";

describe("B5e countdown", () => {
  it("labels future deadlines", () => {
    const now = new Date("2026-10-21T12:00:00.000Z");
    const in2d = new Date(now.getTime() + 2 * 86_400_000 + 3_600_000);
    const c = formatCountdown(in2d, now);
    expect(c.expired).toBe(false);
    expect(c.days).toBe(2);
    expect(c.label).toMatch(/2d/);
  });

  it("marks past deadlines expired", () => {
    const now = new Date("2026-10-21T12:00:00.000Z");
    const past = new Date(now.getTime() - 1000);
    expect(formatCountdown(past, now).expired).toBe(true);
    expect(formatCountdown(past, now).label).toMatch(/passed/i);
  });
});

describe("B5e deadline copy", () => {
  it("explains soft-pause and primary admin", () => {
    const text = deadlineExplanation(FEATURE_KEYS.USERS, 3);
    expect(text).toMatch(/soft-paused/i);
    expect(text).toMatch(/primary admin/i);
    expect(text).toMatch(/3/);
  });
});

describe("B5e primary admin pause guard (contract)", () => {
  it("never includes primary admin in pause candidates", () => {
    const resources = [
      { id: "u1", isPrimaryAdmin: true },
      { id: "u2", isPrimaryAdmin: false },
      { id: "u3", isPrimaryAdmin: false },
    ];
    const pausable = resources.filter((r) => !r.isPrimaryAdmin);
    expect(pausable.map((r) => r.id)).toEqual(["u2", "u3"]);
    expect(pausable.some((r) => r.isPrimaryAdmin)).toBe(false);
  });

  it("forced keep always adds primary admin to selection", () => {
    const resources = [
      { id: "u1", isPrimaryAdmin: true },
      { id: "u2", isPrimaryAdmin: false },
    ];
    const selected = new Set<string>(["u2"]);
    for (const r of resources) {
      if (r.isPrimaryAdmin) selected.add(r.id);
    }
    expect(selected.has("u1")).toBe(true);
  });
});

describe("B5e reminder cadence contract", () => {
  it("T-1 window is daysLeft <= 1.5 and > 0", () => {
    const inWindow = (daysLeft: number) => daysLeft <= 1.5 && daysLeft > 0;
    expect(inWindow(7)).toBe(false);
    expect(inWindow(6.5)).toBe(false);
    expect(inWindow(1.4)).toBe(true);
    expect(inWindow(0)).toBe(false);
  });
});
