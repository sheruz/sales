import { applyMapping } from "@/lib/crm/import/headers";
import { checkEmailQualitySync } from "@/lib/crm/import/email-quality";
import {
  normalizeCountry,
  normalizeRelationship,
} from "@/lib/crm/import/normalize";
import type {
  ColumnMapping,
  MappedCrmRow,
  RowIssue,
  ValidationReport,
} from "@/lib/crm/import/types";
import { extractDomain, normalizeDomain } from "@/services/company.service";
import { normalizeEmail } from "@/services/contact.service";

export function mapRows(
  rawRows: Record<string, string>[],
  mapping: ColumnMapping
): MappedCrmRow[] {
  return rawRows.map((raw, i) => ({
    ...applyMapping(raw, mapping),
    _rowNumber: i + 1,
  }));
}

export function validateMappedRows(
  rows: MappedCrmRow[],
  existing: {
    domains: Set<string>;
    companyKeys: Set<string>;
    emails: Set<string>;
    contactKeys: Set<string>;
  }
): ValidationReport {
  const issues: RowIssue[] = [];
  const fatalRows: number[] = [];
  let missingCompanyName = 0;
  let badEmails = 0;
  let duplicatesInFile = 0;
  let existingCompanies = 0;
  let existingContacts = 0;
  let typoSuggestions = 0;

  const seenDomains = new Set<string>();
  const seenCompanyKeys = new Set<string>();
  const seenEmails = new Set<string>();
  const seenContactKeys = new Set<string>();

  for (const row of rows) {
    const n = row._rowNumber;
    const companyName = row.company_name.trim();
    const email = normalizeEmail(row.email);

    if (row.email.trim()) {
      const q = checkEmailQualitySync(row.email);
      if (!q.ok) {
        badEmails++;
        issues.push({
          row: n,
          field: "email",
          code: `email_${q.failure ?? "invalid"}`,
          message: q.message ?? `Invalid email: ${row.email}`,
          typoSuggestion: q.typoSuggestion ?? undefined,
        });
      } else if (q.typoSuggestion) {
        typoSuggestions++;
        issues.push({
          row: n,
          field: "email",
          code: "email_typo_suggestion",
          message: `Possible typo — did you mean ${q.typoSuggestion}? (not auto-changed)`,
          typoSuggestion: q.typoSuggestion,
        });
      } else if (q.roleGeneric) {
        issues.push({
          row: n,
          field: "email",
          code: "email_role_generic",
          message: `Role/generic address labeled: ${q.email}`,
        });
      }
    }
    if (row.company_email.trim()) {
      const q = checkEmailQualitySync(row.company_email);
      if (!q.ok) {
        badEmails++;
        issues.push({
          row: n,
          field: "company_email",
          code: `email_${q.failure ?? "invalid"}`,
          message: q.message ?? `Invalid company_email: ${row.company_email}`,
          typoSuggestion: q.typoSuggestion ?? undefined,
        });
      }
    }

    if (!companyName) {
      missingCompanyName++;
      issues.push({
        row: n,
        field: "company_name",
        code: "missing_company_name",
        message: "company_name is required",
      });
      fatalRows.push(n);
      continue;
    }

    const domain =
      normalizeDomain(row.website) || extractDomain(row.website) || null;
    const country = normalizeCountry(row.country) || "";
    const companyKey = `${companyName.toLowerCase()}|${country.toLowerCase()}`;

    let fileDupCompany = false;
    if (domain) {
      if (seenDomains.has(domain)) fileDupCompany = true;
      else seenDomains.add(domain);
    } else if (seenCompanyKeys.has(companyKey)) {
      fileDupCompany = true;
    } else {
      seenCompanyKeys.add(companyKey);
    }

    if (fileDupCompany) {
      duplicatesInFile++;
      issues.push({
        row: n,
        code: "duplicate_in_file_company",
        message: domain
          ? `Duplicate company domain in file: ${domain}`
          : `Duplicate company name+country in file: ${companyName}`,
      });
    }

    const companyExists =
      (domain && existing.domains.has(domain)) ||
      existing.companyKeys.has(companyKey);
    if (companyExists) {
      existingCompanies++;
      issues.push({
        row: n,
        code: "existing_company",
        message: domain
          ? `Company already exists for domain ${domain}`
          : `Company already exists: ${companyName}`,
      });
    }

    const first = row.first_name.trim();
    const last = row.last_name.trim();
    const hasPerson = Boolean(first || last || email);
    if (hasPerson && (!first || !last)) {
      issues.push({
        row: n,
        field: "first_name",
        code: "incomplete_contact",
        message: "Contact needs both first_name and last_name (or omit person)",
      });
    }

    if (email) {
      if (seenEmails.has(email)) {
        duplicatesInFile++;
        issues.push({
          row: n,
          field: "email",
          code: "duplicate_in_file_email",
          message: `Duplicate email in file: ${email}`,
        });
      } else {
        seenEmails.add(email);
      }
      if (existing.emails.has(email)) {
        existingContacts++;
        issues.push({
          row: n,
          field: "email",
          code: "existing_contact",
          message: `Contact already exists for email ${email}`,
        });
      }
    } else if (first && last) {
      const ck = `${first.toLowerCase()}|${last.toLowerCase()}|${companyName.toLowerCase()}`;
      if (seenContactKeys.has(ck)) {
        duplicatesInFile++;
        issues.push({
          row: n,
          code: "duplicate_in_file_contact",
          message: `Duplicate contact name+company in file: ${first} ${last}`,
        });
      } else {
        seenContactKeys.add(ck);
      }
    }

    const rel = normalizeRelationship(row.relationship);
    if (row.relationship.trim() && !rel) {
      issues.push({
        row: n,
        field: "relationship",
        code: "unknown_relationship",
        message: `Unrecognized relationship "${row.relationship}" — treated as prospect`,
      });
    }
  }

  return {
    totalRows: rows.length,
    missingCompanyName,
    badEmails,
    duplicatesInFile,
    existingCompanies,
    existingContacts,
    typoSuggestions,
    issues,
    fatalRows: [...new Set(fatalRows)],
  };
}
