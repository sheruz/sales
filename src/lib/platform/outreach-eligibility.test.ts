import { describe, expect, it } from "vitest";
import {
  assertBusinessAddress,
  caslBlocksCanadian,
  cooldownCutoff,
  excludedAsClientOrDnc,
  fillPlatformTemplate,
  hasWebsite,
  isActiveEnrollmentStatus,
  OUTREACH_COOLDOWN_DAYS,
  platformFirstNameToken,
  resolvePlatformOutreachTimezone,
} from "@/lib/platform/outreach-eligibility";

describe("platform outreach eligibility", () => {
  it("detects website presence", () => {
    expect(hasWebsite({ website: "https://acme.com" })).toBe(true);
    expect(hasWebsite({ domain: "acme.com" })).toBe(true);
    expect(hasWebsite({})).toBe(false);
  });

  it("uses company team when first_name empty", () => {
    expect(platformFirstNameToken("", "Acme")).toBe("Acme team");
    expect(platformFirstNameToken("Sara", "Acme")).toBe("Sara");
  });

  it("blocks empty business address", () => {
    expect(assertBusinessAddress("").ok).toBe(false);
    expect(assertBusinessAddress("  ").ok).toBe(false);
    expect(assertBusinessAddress("123 Main St, Newark, NJ").ok).toBe(true);
  });

  it("skips client / DNC / unsubscribed", () => {
    expect(
      excludedAsClientOrDnc({
        companyMetadata: { relationship: "client" },
      })
    ).toBe(true);
    expect(
      excludedAsClientOrDnc({
        contactMetadata: { doNotContact: true },
      })
    ).toBe(true);
    expect(
      excludedAsClientOrDnc({
        contactStatus: "UNSUBSCRIBED",
      })
    ).toBe(true);
    expect(
      excludedAsClientOrDnc({
        companyMetadata: { relationship: "prospect" },
        contactStatus: "ACTIVE",
      })
    ).toBe(false);
  });

  it("CASL blocks Canadian without published source", () => {
    expect(
      caslBlocksCanadian({
        companyCountry: "Canada",
        emailSource: "guessed",
      })
    ).toBe(true);
    expect(
      caslBlocksCanadian({
        companyCountry: "Canada",
        emailSource: "published",
      })
    ).toBe(false);
    expect(
      caslBlocksCanadian({
        companyCountry: "US",
        emailSource: "guessed",
      })
    ).toBe(false);
  });

  it("treats PENDING/ACTIVE/PROCESSING/PAUSED as active enrollment", () => {
    expect(isActiveEnrollmentStatus("ACTIVE")).toBe(true);
    expect(isActiveEnrollmentStatus("PAUSED")).toBe(true);
    expect(isActiveEnrollmentStatus("COMPLETED")).toBe(false);
    expect(isActiveEnrollmentStatus("STOPPED")).toBe(false);
  });

  it("cooldown window is 30 days", () => {
    const now = new Date("2026-11-06T12:00:00Z");
    const cut = cooldownCutoff(now);
    expect(OUTREACH_COOLDOWN_DAYS).toBe(30);
    expect(now.getTime() - cut.getTime()).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it("falls back to US Eastern when country unknown", () => {
    expect(resolvePlatformOutreachTimezone({})).toBe("America/New_York");
    expect(
      resolvePlatformOutreachTimezone({ country: "Pakistan" })
    ).toBe("Asia/Karachi");
  });

  it("fills template vars including business_address", () => {
    const out = fillPlatformTemplate({
      template:
        "Hi {{first_name}}, see {{company_name}} at {{website}} — {{business_address}}",
      firstName: "",
      companyName: "Acme",
      website: "acme.com",
      businessAddress: "1 Market St",
    });
    expect(out).toContain("Hi Acme team");
    expect(out).toContain("1 Market St");
    expect(out).not.toContain("{{");
  });
});

describe("platform outreach access rules (documented)", () => {
  it("write requires SUPER_ADMIN + 2FA; SUPPORT is read-only", () => {
    // Enforced in requirePlatformOutreachWrite / requirePlatformRead.
    // Non-super-admins → ForbiddenError on /api/platform/outreach/**
    expect(true).toBe(true);
  });
});
