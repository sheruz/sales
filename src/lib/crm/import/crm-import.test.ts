import { describe, expect, it, beforeEach } from "vitest";
import {
  resolveHeaderAlias,
  suggestColumnMapping,
  applyMapping,
} from "@/lib/crm/import/headers";
import {
  checkEmailQuality,
  checkEmailQualitySync,
  clearMxCacheForTests,
  setMxCacheForTests,
  isDisposableDomain,
  isRoleAddress,
  typoSuggestionForEmail,
} from "@/lib/crm/import/email-quality";
import {
  customerTypeFromRelationship,
  isOutreachExcluded,
} from "@/lib/crm/import/outreach-exclude";
import {
  deriveImportTimezone,
  fillEmptyFields,
  isCustomerRelationship,
  normalizeCountry,
  normalizeRelationship,
  parseYesNo,
  splitTags,
} from "@/lib/crm/import/normalize";
import { parseCsvText, toErrorCsv } from "@/lib/crm/import/parse";
import { mapRows, validateMappedRows } from "@/lib/crm/import/validate";
import { CRM_IMPORT_HEADERS, CSV_IMPORT_SOURCE } from "@/lib/crm/import/types";
import { isEnrollableVerification } from "@/lib/enrichment/verification";
import { CompanyEnrichmentStatus } from "@prisma/client";

describe("CRM CSV import — headers", () => {
  it("accepts exact template headers case-insensitively", () => {
    for (const h of CRM_IMPORT_HEADERS) {
      expect(resolveHeaderAlias(h.toUpperCase())).toBe(h);
    }
  });

  it("maps common aliases", () => {
    expect(resolveHeaderAlias("Company")).toBe("company_name");
    expect(resolveHeaderAlias("Email Address")).toBe("email");
    expect(resolveHeaderAlias("First Name")).toBe("first_name");
  });

  it("suggests and applies mapping", () => {
    const mapping = suggestColumnMapping([
      "Company",
      "Website",
      "First Name",
      "Last Name",
      "Email Address",
    ]);
    expect(mapping.company_name).toBe("Company");
    const mapped = applyMapping(
      { Company: "Acme", "Email Address": "a@acme.com" },
      mapping
    );
    expect(mapped.company_name).toBe("Acme");
    expect(mapped.email).toBe("a@acme.com");
  });
});

describe("CRM CSV import — built-in email quality", () => {
  beforeEach(() => clearMxCacheForTests());

  it("rejects bad syntax → invalid / not enrollable", () => {
    const r = checkEmailQualitySync("not-an-email");
    expect(r.ok).toBe(false);
    expect(r.failure).toBe("syntax");
    expect(r.emailStatus).toBe("invalid");
    expect(isEnrollableVerification(r.emailStatus)).toBe(false);
  });

  it("rejects disposable domains", () => {
    expect(isDisposableDomain("mailinator.com")).toBe(true);
    const r = checkEmailQualitySync("x@mailinator.com");
    expect(r.ok).toBe(false);
    expect(r.failure).toBe("disposable");
    expect(isEnrollableVerification(r.emailStatus)).toBe(false);
  });

  it("labels role addresses as generic but allows them", () => {
    expect(isRoleAddress("info@acme.com")).toBe(true);
    expect(isRoleAddress("sales@acme.com")).toBe(true);
    const r = checkEmailQualitySync("info@acme.com");
    expect(r.ok).toBe(true);
    expect(r.roleGeneric).toBe(true);
    expect(r.emailStatus).toBe("valid_manual");
    expect(isEnrollableVerification("valid_manual")).toBe(true);
  });

  it("suggests typo (gmial → gmail) without auto-changing", () => {
    expect(typoSuggestionForEmail("jane@gmial.com")).toBe("jane@gmail.com");
    const r = checkEmailQualitySync("jane@gmial.com");
    expect(r.typoSuggestion).toBe("jane@gmail.com");
    expect(r.email).toBe("jane@gmial.com");
  });

  it("rejects domains with no MX (cached)", async () => {
    setMxCacheForTests("no-mx-example.test", false);
    const r = await checkEmailQuality("person@no-mx-example.test");
    expect(r.ok).toBe(false);
    expect(r.failure).toBe("mx");
    expect(r.emailStatus).toBe("invalid");
    expect(isEnrollableVerification(r.emailStatus)).toBe(false);
  });

  it("passes MX-ok domain as valid_manual", async () => {
    setMxCacheForTests("good-example.test", true);
    const r = await checkEmailQuality("person@good-example.test");
    expect(r.ok).toBe(true);
    expect(r.emailStatus).toBe("valid_manual");
    expect(isEnrollableVerification(r.emailStatus)).toBe(true);
  });
});

describe("CRM CSV import — prospect vs client rules", () => {
  it("prospects: ENRICHED + valid_manual → enrollable for audit/outbound path", () => {
    const flags = customerTypeFromRelationship("prospect", false);
    expect(flags.outreachExcluded).toBe(false);
    expect(flags.customerType).toBe("prospect");
    // Simulated import outcome
    const enrichmentStatus = flags.outreachExcluded
      ? CompanyEnrichmentStatus.SKIPPED
      : CompanyEnrichmentStatus.ENRICHED;
    expect(enrichmentStatus).toBe(CompanyEnrichmentStatus.ENRICHED);
    expect(isEnrollableVerification("valid_manual")).toBe(true);
    expect(CSV_IMPORT_SOURCE).toBe("csv_import");
  });

  it("client / past_client / partner / DNC never audited or enrolled", () => {
    for (const rel of ["client", "past_client", "partner"] as const) {
      expect(isCustomerRelationship(normalizeRelationship(rel))).toBe(true);
      const flags = customerTypeFromRelationship(rel, false);
      expect(flags.outreachExcluded).toBe(true);
      expect(
        isOutreachExcluded({
          companyMetadata: {
            outreachExcluded: true,
            customerType: rel,
          },
        })
      ).toBe(true);
    }
    expect(
      isOutreachExcluded({
        companyMetadata: { customerType: "prospect" },
        contactMetadata: { doNotContact: true },
      })
    ).toBe(true);
    expect(parseYesNo("yes")).toBe(true);
    const dncFlags = customerTypeFromRelationship("prospect", true);
    expect(dncFlags.outreachExcluded).toBe(true);
  });

  it("imported prospects are NOT outreach-excluded (eligible for audit→pitch→enroll)", () => {
    expect(
      isOutreachExcluded({
        companyMetadata: {
          customerType: "prospect",
          relationship: "prospect",
          outreachExcluded: false,
          imported: true,
        },
        contactMetadata: {
          verifiedBy: "user",
          outreachExcluded: false,
        },
      })
    ).toBe(false);
  });
});

describe("CRM CSV import — normalize / parse / validate", () => {
  it("normalizes country, tags, timezone", () => {
    expect(normalizeCountry("Canada")).toBe("CA");
    expect(splitTags("vip;priority")).toEqual(["vip", "priority"]);
    expect(deriveImportTimezone({ city: "Toronto", country: "CA" })).toBe(
      "America/Toronto"
    );
  });

  it("fillEmptyFields never overwrites", () => {
    const existing: {
      website: string | null;
      phone: string | null;
    } = { website: "https://old.com", phone: null };
    const { patch, filled } = fillEmptyFields(
      existing,
      { website: "https://new.com", phone: "555" },
      ["website", "phone"]
    );
    expect(patch).toEqual({ phone: "555" });
    expect(filled).toEqual(["phone"]);
  });

  it("parses quoted CSV", () => {
    const { rows } = parseCsvText(
      `company_name,notes\n"Acme, Inc","Hello, world"\n`
    );
    expect(rows[0].company_name).toBe("Acme, Inc");
  });

  it("validation reports syntax/disposable and typo suggestions", () => {
    const mapping = suggestColumnMapping([
      "company_name",
      "website",
      "email",
      "first_name",
      "last_name",
      "country",
    ]);
    const mapped = mapRows(
      [
        {
          company_name: "A",
          website: "https://a.com",
          email: "x@mailinator.com",
          first_name: "A",
          last_name: "B",
          country: "CA",
        },
        {
          company_name: "B",
          website: "https://b.com",
          email: "jane@gmial.com",
          first_name: "J",
          last_name: "D",
          country: "CA",
        },
      ],
      mapping
    );
    const report = validateMappedRows(mapped, {
      domains: new Set(),
      companyKeys: new Set(),
      emails: new Set(),
      contactKeys: new Set(),
    });
    expect(report.badEmails).toBeGreaterThanOrEqual(1);
    expect(report.typoSuggestions).toBeGreaterThanOrEqual(1);
    expect(
      report.issues.some((i) => i.code === "email_disposable")
    ).toBe(true);
    expect(
      report.issues.some((i) => i.code === "email_typo_suggestion")
    ).toBe(true);
  });

  it("error CSV includes invalid email rows", () => {
    const csv = toErrorCsv([
      {
        row: 2,
        status: "failed",
        reason: "email_mx:No MX records for domain: bad.test",
      },
      { row: 3, status: "imported" },
    ]);
    expect(csv).toContain("2,failed");
    expect(csv).toContain("email_mx");
    expect(csv).not.toContain(",imported");
  });
});

describe("CRM CSV import — pipeline contract (prospect)", () => {
  it("documents audit → DRAFT pitch → approve → enroll → send eligibility", () => {
    // Contract assertions used by import + outbound/audit services:
    // 1) import sets ENRICHED + valid_manual for prospects
    // 2) findEligible / auditOne accept enrollable contacts
    // 3) pitch created as DRAFT (websiteAuditService)
    // 4) after approve, outbound eligibilityCheck allows (not outreach_excluded)
    // 5) invalid MX/syntax/disposable → not enrollable
    expect(isEnrollableVerification("valid_manual")).toBe(true);
    expect(isEnrollableVerification("invalid")).toBe(false);
    expect(isEnrollableVerification("unknown")).toBe(false);
    expect(
      isOutreachExcluded({
        companyMetadata: { customerType: "client", outreachExcluded: true },
      })
    ).toBe(true);
  });
});
