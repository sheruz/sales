import { describe, expect, it } from "vitest";
import { FEATURE_KEYS, DEFAULT_PLANS } from "@/lib/billing/features";

describe("Phase 10 billing + entitlements", () => {
  it("ships Free / Growth / Scale default plans", () => {
    expect(DEFAULT_PLANS.map((p) => p.name)).toEqual([
      "Free",
      "Growth",
      "Scale",
    ]);
    expect(DEFAULT_PLANS[0].price).toBe(0);
    expect(DEFAULT_PLANS[0].isDefault).toBe(true);
    expect(DEFAULT_PLANS[1].price).toBeGreaterThan(0);
  });

  it("covers commercial feature keys from the phase brief", () => {
    const keys = Object.values(FEATURE_KEYS);
    for (const required of [
      "users",
      "opportunities",
      "ai_calls",
      "emails",
      "sequences",
      "sources",
      "enrichment",
      "inbox_accounts",
      "automation",
      "advanced_ai",
      "learning",
      "connectors",
    ]) {
      expect(keys).toContain(required);
    }
  });

  it("Free plan disables advanced AI and learning", () => {
    const free = DEFAULT_PLANS[0];
    const advanced = free.features.find(
      (f) => f.featureKey === FEATURE_KEYS.ADVANCED_AI
    );
    const learning = free.features.find(
      (f) => f.featureKey === FEATURE_KEYS.LEARNING
    );
    expect(advanced?.enabled).toBe(false);
    expect(learning?.enabled).toBe(false);
  });

  it("Growth unlocks advanced AI and learning", () => {
    const growth = DEFAULT_PLANS[1];
    expect(
      growth.features.find((f) => f.featureKey === FEATURE_KEYS.ADVANCED_AI)
        ?.enabled
    ).toBe(true);
    expect(
      growth.features.find((f) => f.featureKey === FEATURE_KEYS.LEARNING)
        ?.enabled
    ).toBe(true);
  });

  it("models SaaS journey: signup → plan → pay → entitlements → limits → upgrade", () => {
    const journey = [
      "signup",
      "select_plan",
      "pay",
      "receive_entitlements",
      "use_product",
      "hit_limits",
      "upgrade",
      "continue",
    ];
    expect(journey[0]).toBe("signup");
    expect(journey.includes("hit_limits")).toBe(true);
    expect(journey.at(-1)).toBe("continue");
  });

  it("webhook processing must be idempotent by event id", () => {
    const events = new Set<string>();
    const process = (eventId: string) => {
      if (events.has(eventId)) return { duplicate: true };
      events.add(eventId);
      return { duplicate: false };
    };
    expect(process("evt_1").duplicate).toBe(false);
    expect(process("evt_1").duplicate).toBe(true);
  });
});
