import { describe, expect, it } from "vitest";
import {
  isCountryAllowed,
  DEFAULT_COUNTRY_ALLOW_LIST,
} from "@/lib/outbound/country-allowlist";
import {
  appendComplianceFooter,
  countHttpLinks,
  buildListUnsubscribeHeaders,
} from "@/lib/outbound/compliance";
import { effectiveDailyLimit } from "@/services/mailbox-pool.service";
import {
  createUnsubscribeToken,
  verifyUnsubscribeToken,
} from "@/services/unsubscribe.service";
import { isValidIanaTimezone } from "@/lib/outbound/timezone";
import {
  renderSequenceTemplateDetailed,
  REQUIRED_PITCH_VARS,
} from "@/lib/sequences/runtime";

describe("country allow-list", () => {
  it("allows US aliases by default", () => {
    expect(isCountryAllowed("United States", DEFAULT_COUNTRY_ALLOW_LIST)).toBe(
      true
    );
    expect(isCountryAllowed("US", DEFAULT_COUNTRY_ALLOW_LIST)).toBe(true);
    expect(isCountryAllowed("Canada", DEFAULT_COUNTRY_ALLOW_LIST)).toBe(false);
    expect(isCountryAllowed("UK", DEFAULT_COUNTRY_ALLOW_LIST)).toBe(false);
  });
});

describe("compliance", () => {
  it("appends unsubscribe + address footer", () => {
    const out = appendComplianceFooter("Hello", {
      businessName: "Acme Co",
      physicalAddress: "1 Main St, Austin, TX",
      unsubscribeUrl: "https://example.com/unsubscribe?token=x",
    });
    expect(out).toContain("unsubscribe");
    expect(out).toContain("Acme Co");
    expect(out).toContain("1 Main St");
  });

  it("counts http links", () => {
    expect(countHttpLinks("no links")).toBe(0);
    expect(countHttpLinks("see https://a.com and https://b.com")).toBe(2);
  });

  it("builds list-unsubscribe headers", () => {
    const h = buildListUnsubscribeHeaders({
      unsubscribeUrl: "https://x.com/u",
      mailtoEmail: "me@x.com",
    });
    expect(h["List-Unsubscribe"]).toContain("https://x.com/u");
    expect(h["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
  });
});

describe("mailbox ramp", () => {
  it("ramps 5 + 3/day up to cap", () => {
    expect(
      effectiveDailyLimit({
        dailyCap: 30,
        rampStart: 5,
        rampIncrement: 3,
        rampDay: 0,
        rampStartedAt: new Date(),
      })
    ).toBe(5);
    expect(
      effectiveDailyLimit({
        dailyCap: 30,
        rampStart: 5,
        rampIncrement: 3,
        rampDay: 10,
        rampStartedAt: new Date(),
      })
    ).toBe(30);
  });
});

describe("unsubscribe token", () => {
  it("round-trips", () => {
    const token = createUnsubscribeToken({
      organizationId: "org-1",
      email: "Person@Example.COM",
    });
    const parsed = verifyUnsubscribeToken(token);
    expect(parsed).toEqual({
      organizationId: "org-1",
      email: "person@example.com",
    });
  });
});

describe("timezone validation", () => {
  it("accepts IANA zones", () => {
    expect(isValidIanaTimezone("America/Chicago")).toBe(true);
    expect(isValidIanaTimezone("Not/AZone")).toBe(false);
    expect(isValidIanaTimezone(null)).toBe(false);
  });
});

describe("autopilot hard-refuse missing vars", () => {
  it("flags missing required pitch vars", () => {
    const r = renderSequenceTemplateDetailed(
      "Hi {{first_name}} — {{personalized_first_line}} {{short_pitch}}",
      { first_name: "Sam" },
      REQUIRED_PITCH_VARS
    );
    expect(r.missingRequired).toEqual(
      expect.arrayContaining(["personalized_first_line", "short_pitch"])
    );
  });
});
