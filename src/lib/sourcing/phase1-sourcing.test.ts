import { describe, expect, it } from "vitest";
import {
  classifyEmailType,
  extractEmailsFromText,
  isJunkEmail,
} from "@/lib/sourcing/email-extract";
import { resolveCompanyDedupe } from "@/lib/sourcing/company-dedupe";

describe("email extraction", () => {
  it("extracts valid emails and drops junk", () => {
    const text = `
      Contact us at info@acmeclinic.com or bob.smith@acmeclinic.com
      Ignore noreply@acmeclinic.com and example@example.com
      Also skip logo@cdn.com/foo.png and user@sentry.io
    `;
    const emails = extractEmailsFromText(text);
    expect(emails).toContain("info@acmeclinic.com");
    expect(emails).toContain("bob.smith@acmeclinic.com");
    expect(emails).not.toContain("noreply@acmeclinic.com");
    expect(emails).not.toContain("example@example.com");
    expect(emails.some((e) => e.includes("sentry"))).toBe(false);
  });

  it("classifies generic vs personal", () => {
    expect(classifyEmailType("info@clinic.com")).toBe("GENERIC");
    expect(classifyEmailType("sales@clinic.com")).toBe("GENERIC");
    expect(classifyEmailType("jane.doe@clinic.com")).toBe("PERSONAL");
  });

  it("flags junk locals", () => {
    expect(isJunkEmail("noreply@x.com")).toBe(true);
    expect(isJunkEmail("hello@realbiz.com")).toBe(false);
  });
});

describe("company dedupe", () => {
  it("prefers place_id over domain", () => {
    expect(
      resolveCompanyDedupe({
        byPlaceId: { id: "a" },
        byDomain: { id: "b" },
      })
    ).toEqual({ kind: "place_id", companyId: "a" });
  });

  it("falls back to domain then none", () => {
    expect(
      resolveCompanyDedupe({ byPlaceId: null, byDomain: { id: "b" } })
    ).toEqual({ kind: "domain", companyId: "b" });
    expect(resolveCompanyDedupe({ byPlaceId: null, byDomain: null })).toEqual({
      kind: "none",
    });
  });
});
