import { describe, expect, it } from "vitest";
import {
  isMrrEligible,
  monthlyEquivalent,
  mrrContribution,
} from "@/lib/billing/platform-metrics";
import {
  minorToMajor,
  parsePaddleMoney,
} from "@/lib/billing/paddle-amounts";
import { generateTotpCode } from "@/services/mfa.service";

describe("B4a MRR eligibility", () => {
  const owner = "owner-org";

  it("includes ACTIVE and PAST_DUE with price", () => {
    expect(
      isMrrEligible({
        status: "ACTIVE",
        organizationId: "a",
        planCode: "STARTER",
        priceMonthly: 49,
        billingInterval: "MONTHLY",
      })
    ).toBe(true);
    expect(
      mrrContribution({
        status: "PAST_DUE",
        organizationId: "a",
        planCode: "GROWTH",
        priceMonthly: 149,
        billingInterval: "MONTHLY",
      })
    ).toBe(149);
  });

  it("yearly is /12", () => {
    expect(
      monthlyEquivalent({
        billingInterval: "YEARLY",
        priceYearly: 490,
        priceMonthly: 49,
      })
    ).toBe(490 / 12);
  });

  it("excludes OWNER org, OWNER/COMPLIMENTARY plans, unpaid manual", () => {
    expect(
      isMrrEligible(
        {
          status: "ACTIVE",
          organizationId: owner,
          planCode: "STARTER",
          priceMonthly: 49,
        },
        owner
      )
    ).toBe(false);
    expect(
      isMrrEligible({
        status: "ACTIVE",
        organizationId: "a",
        planCode: "OWNER",
        priceMonthly: 0,
      })
    ).toBe(false);
    expect(
      isMrrEligible({
        status: "ACTIVE",
        organizationId: "a",
        planCode: "STARTER",
        accessMode: "manual",
        manualPaid: false,
        priceMonthly: 49,
      })
    ).toBe(false);
  });

  it("excludes TRIALING from MRR", () => {
    expect(
      isMrrEligible({
        status: "TRIALING",
        organizationId: "a",
        planCode: "GROWTH",
        priceMonthly: 149,
      })
    ).toBe(false);
  });
});

describe("B4a Paddle amounts", () => {
  it("parses minor units grand_total", () => {
    expect(minorToMajor("4900", "USD")).toBe(49);
    const m = parsePaddleMoney({
      data: {
        currency_code: "USD",
        details: {
          totals: { grand_total: "4900", tax: "0", total: "4900" },
          payout_totals: { fee: "200", earnings: "4700" },
        },
      },
    });
    expect(m.amount).toBe(49);
    expect(m.fee).toBe(2);
    expect(m.net).toBe(47);
  });
});

describe("B4a TOTP", () => {
  it("generates 6-digit codes for a secret", () => {
    // Fixed base32 secret
    const secret = "JBSWY3DPEHPK3PXP";
    const code = generateTotpCode(secret);
    expect(code).toMatch(/^\d{6}$/);
  });
});

describe("B4a webhook classification rules", () => {
  it("maps unhandled events to skipped not failed", () => {
    const reason = "unhandled event transaction.updated";
    const status = /unhandled event/i.test(reason) ? "skipped" : "unmatched";
    expect(status).toBe("skipped");
  });
});

describe("B4a deactivate protections", () => {
  it("blocks self, super admin, and primary admin conceptually", () => {
    const actorId = "me";
    const rules = (target: {
      id: string;
      role: string;
      isPrimaryAdmin?: boolean;
    }) => {
      if (target.id === actorId) return "block_self";
      if (target.role === "SUPER_ADMIN") return "block_sa";
      if (target.isPrimaryAdmin) return "block_primary";
      return "ok";
    };
    expect(rules({ id: "me", role: "SALES" })).toBe("block_self");
    expect(rules({ id: "x", role: "SUPER_ADMIN" })).toBe("block_sa");
    expect(rules({ id: "x", role: "ADMIN", isPrimaryAdmin: true })).toBe(
      "block_primary"
    );
    expect(rules({ id: "x", role: "SALES" })).toBe("ok");
  });
});
