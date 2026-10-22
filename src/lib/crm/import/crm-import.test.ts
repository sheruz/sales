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
import {
  contactDisplayName,
  emailMatchesCompanyDomain,
  firstNameForGreeting,
  resolveImportContact,
} from "@/lib/crm/import/contact-from-row";
import { CRM_IMPORT_HEADERS, CSV_IMPORT_SOURCE } from "@/lib/crm/import/types";
import { isEnrollableVerification } from "@/lib/enrichment/verification";
import {
  buildSequenceTemplateVars,
  renderSequenceTemplate,
} from "@/lib/sequences/runtime";
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

describe("CRM CSV import — email-only contacts", () => {
  it("creates contact from email with empty names — role → General inbox", () => {
    const r = resolveImportContact({
      email: "info@acme.com",
      firstName: "",
      lastName: "",
      website: "https://acme.com",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.contact.isGeneralInbox).toBe(true);
    expect(r.contact.fullName).toBe("General inbox");
    expect(r.contact.title).toBe("General inbox");
    expect(contactDisplayName(r.contact)).toBe("General inbox");
  });

  it("creates contact from email with empty names — personal local → display email", () => {
    const r = resolveImportContact({
      email: "jane@acme.com",
      firstName: "",
      lastName: "",
      website: "https://www.acme.com",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.contact.isGeneralInbox).toBe(false);
    expect(r.contact.fullName).toBe("jane@acme.com");
    expect(r.contact.firstName).toBe("");
    expect(firstNameForGreeting(r.contact)).toBe("");
  });

  it("title General inbox forces General inbox display", () => {
    const r = resolveImportContact({
      email: "jane@acme.com",
      firstName: "Jane",
      lastName: "Doe",
      title: "General inbox",
      website: "acme.com",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.contact.fullName).toBe("General inbox");
    expect(r.contact.isGeneralInbox).toBe(true);
  });

  it("company_email (non-blocked) → General inbox when email empty", () => {
    const r = resolveImportContact({
      email: "",
      companyEmail: "hello@studio.example",
      website: "https://studio.example",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.contact.emailSource).toBe("company_email");
    expect(r.contact.isGeneralInbox).toBe(true);
    expect(r.contact.email).toBe("hello@studio.example");
  });

  it("company_email careers/jobs/hr blocked — no contact", () => {
    for (const local of ["careers", "jobs", "hr", "talent", "hiring", "press", "privacy", "helpdesk"]) {
      const r = resolveImportContact({
        email: "",
        companyEmail: `${local}@acme.com`,
        website: "https://acme.com",
      });
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.code).toBe("company_email_blocked");
    }
  });

  it("rejects email when domain does not match company website", () => {
    const r = resolveImportContact({
      email: "jane@gmail.com",
      website: "https://acme.com",
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe("domain_mismatch");
  });

  it("rejects when no company website to verify domain", () => {
    const r = resolveImportContact({
      email: "jane@acme.com",
      website: "",
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe("no_company_domain");
  });

  it("{{first_name}} falls back to there for General inbox / empty", () => {
    const vars = buildSequenceTemplateVars({
      contact: {
        firstName: "General",
        lastName: "inbox",
        fullName: "General inbox",
        title: "General inbox",
        email: "info@acme.com",
      },
      company: { name: "Acme" },
    });
    expect(vars.first_name).toBe("");
    expect(
      renderSequenceTemplate("Hi {{first_name}}, welcome to {{company_name}}", vars)
    ).toBe("Hi there, welcome to Acme");
  });

  it("validation flags domain_mismatch in report", () => {
    const mapping = suggestColumnMapping([
      "company_name",
      "website",
      "email",
    ]);
    const mapped = mapRows(
      [
        {
          company_name: "Acme",
          website: "https://acme.com",
          email: "x@other.com",
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
    expect(report.issues.some((i) => i.code === "domain_mismatch")).toBe(true);
  });

  it("emailMatchesCompanyDomain allows same host", () => {
    expect(emailMatchesCompanyDomain("a@acme.com", "https://www.acme.com")).toBe(
      true
    );
    expect(emailMatchesCompanyDomain("a@mail.acme.com", "acme.com")).toBe(true);
    expect(emailMatchesCompanyDomain("a@gmail.com", "acme.com")).toBe(false);
  });
});

