import {
  CRM_IMPORT_HEADERS,
  type ColumnMapping,
  type CrmImportHeader,
} from "@/lib/crm/import/types";

/** Normalize header for matching: lowercase, strip non-alnum. */
export function normalizeHeaderKey(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/[\s\-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

/**
 * Common aliases → canonical field.
 * Matching is case-insensitive via normalizeHeaderKey.
 */
export const HEADER_ALIASES: Record<string, CrmImportHeader> = {
  company_name: "company_name",
  company: "company_name",
  companyname: "company_name",
  organization: "company_name",
  organisation: "company_name",
  account: "company_name",
  account_name: "company_name",
  name: "company_name", // only used when no person name cols — see suggestMapping

  website: "website",
  url: "website",
  web: "website",
  company_website: "website",
  companywebsite: "website",
  domain: "website",
  company_domain: "website",

  company_email: "company_email",
  companyemail: "company_email",
  org_email: "company_email",

  company_phone: "company_phone",
  companyphone: "company_phone",
  company_tel: "company_phone",

  address: "address",
  street: "address",
  street_address: "address",

  city: "city",
  town: "city",

  state_province: "state_province",
  state: "state_province",
  province: "state_province",
  region: "state_province",

  country: "country",

  industry: "industry",
  sector: "industry",

  employee_count: "employee_count",
  employees: "employee_count",
  employeecount: "employee_count",
  company_size: "employee_count",
  headcount: "employee_count",

  company_linkedin_url: "company_linkedin_url",
  company_linkedin: "company_linkedin_url",
  companylinkedin: "company_linkedin_url",

  first_name: "first_name",
  firstname: "first_name",
  first: "first_name",
  given_name: "first_name",

  last_name: "last_name",
  lastname: "last_name",
  last: "last_name",
  surname: "last_name",
  family_name: "last_name",

  title: "title",
  job_title: "title",
  jobtitle: "title",
  position: "title",
  role: "title",

  email: "email",
  email_address: "email",
  emailaddress: "email",
  contact_email: "email",
  work_email: "email",
  e_mail: "email",

  phone: "phone",
  mobile: "phone",
  cell: "phone",
  telephone: "phone",
  contact_phone: "phone",

  linkedin_url: "linkedin_url",
  linkedin: "linkedin_url",
  linked_in: "linkedin_url",
  profile_url: "linkedin_url",

  relationship: "relationship",
  type: "relationship",
  account_type: "relationship",
  customer_type: "relationship",

  do_not_contact: "do_not_contact",
  donotcontact: "do_not_contact",
  dnc: "do_not_contact",
  do_not_email: "do_not_contact",

  tags: "tags",
  label: "tags",
  labels: "tags",

  notes: "notes",
  note: "notes",
  comments: "notes",

  source: "source",
  lead_source: "source",

  owner_email: "owner_email",
  owner: "owner_email",
  owner_email_address: "owner_email",
  assigned_to: "owner_email",
};

export function resolveHeaderAlias(rawHeader: string): CrmImportHeader | null {
  const key = normalizeHeaderKey(rawHeader);
  if ((CRM_IMPORT_HEADERS as readonly string[]).includes(key)) {
    return key as CrmImportHeader;
  }
  return HEADER_ALIASES[key] ?? null;
}

/** Suggest mapping from file headers → canonical fields. */
export function suggestColumnMapping(fileHeaders: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const usedCanonical = new Set<CrmImportHeader>();
  const hasPersonName = fileHeaders.some((h) => {
    const a = resolveHeaderAlias(h);
    return a === "first_name" || a === "last_name";
  });

  for (const h of fileHeaders) {
    const key = normalizeHeaderKey(h);
    let canonical = resolveHeaderAlias(h);
    // Bare "name" → company_name only when no first/last columns
    if (
      (key === "name" || key === "full_name" || key === "fullname") &&
      hasPersonName
    ) {
      canonical = null;
    }
    if (!canonical || usedCanonical.has(canonical)) continue;
    mapping[canonical] = h;
    usedCanonical.add(canonical);
  }
  return mapping;
}

export function applyMapping(
  raw: Record<string, string>,
  mapping: ColumnMapping
): Record<CrmImportHeader, string> {
  const out = {} as Record<CrmImportHeader, string>;
  for (const field of CRM_IMPORT_HEADERS) {
    const src = mapping[field];
    out[field] = src ? (raw[src] ?? "").trim() : "";
  }
  return out;
}
