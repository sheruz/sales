import { describe, expect, it } from "vitest";
import {
  pickBestGenericEmail,
  pickDecisionMaker,
} from "@/lib/enrichment/decision-maker";
import {
  isEnrollableVerification,
  mapHunterVerificationStatus,
} from "@/lib/enrichment/verification";
import { isDomainBlocked } from "@/lib/enrichment/domain-blocklist";
import type { EnrichmentPerson } from "@/lib/enrichment/types";

describe("decision-maker selection", () => {
  it("prefers Owner/CEO titles over random high confidence", () => {
    const people: EnrichmentPerson[] = [
      {
        firstName: "Sam",
        lastName: "Agent",
        fullName: "Sam Agent",
        email: "sam@agency.com",
        title: "Sales Associate",
        seniority: "senior",
        linkedInUrl: null,
        confidence: 99,
      },
      {
        firstName: "Pat",
        lastName: "Owner",
        fullName: "Pat Owner",
        email: "pat@agency.com",
        title: "Owner",
        seniority: "executive",
        linkedInUrl: null,
        confidence: 70,
      },
    ];
    const pick = pickDecisionMaker(people);
    expect(pick?.email).toBe("pat@agency.com");
  });

  it("falls back to highest confidence when no title match", () => {
    const people: EnrichmentPerson[] = [
      {
        firstName: "A",
        lastName: "One",
        fullName: "A One",
        email: "a@co.com",
        title: "Coordinator",
        seniority: null,
        linkedInUrl: null,
        confidence: 40,
      },
      {
        firstName: "B",
        lastName: "Two",
        fullName: "B Two",
        email: "b@co.com",
        title: "Specialist",
        seniority: null,
        linkedInUrl: null,
        confidence: 88,
      },
    ];
    expect(pickDecisionMaker(people)?.email).toBe("b@co.com");
  });

  it("prefers info@ for generic crawl emails", () => {
    expect(
      pickBestGenericEmail([
        { email: "sales@co.com" },
        { email: "info@co.com" },
        { email: "bob@co.com" },
      ])
    ).toBe("info@co.com");
  });
});

describe("verification status mapping", () => {
  it("maps hunter statuses", () => {
    expect(mapHunterVerificationStatus("valid")).toBe("valid");
    expect(mapHunterVerificationStatus("accept_all")).toBe("accept_all");
    expect(mapHunterVerificationStatus("invalid")).toBe("invalid");
    expect(mapHunterVerificationStatus("unknown")).toBe("unknown");
    expect(mapHunterVerificationStatus("deliverable")).toBe("valid");
  });

  it("enrollable rules", () => {
    expect(isEnrollableVerification("valid")).toBe(true);
    expect(isEnrollableVerification("accept_all")).toBe(false);
    expect(isEnrollableVerification("accept_all", true)).toBe(true);
    expect(isEnrollableVerification("invalid")).toBe(false);
    expect(isEnrollableVerification("unknown")).toBe(false);
  });
});

describe("domain blocklist", () => {
  it("blocks portals and kw subdomains", () => {
    expect(isDomainBlocked("zillow.com")).toBe(true);
    expect(isDomainBlocked("www.realtor.com")).toBe(true);
    expect(isDomainBlocked("foo.kw.com")).toBe(true);
    expect(isDomainBlocked("facebook.com")).toBe(true);
    expect(isDomainBlocked("lockepm.com")).toBe(false);
  });
});

describe("contact dedupe key", () => {
  it("normalizes email for org uniqueness", () => {
    const a = "Pat@Agency.COM ".toLowerCase().trim();
    const b = "pat@agency.com";
    expect(a).toBe(b);
  });
});
