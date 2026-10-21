/** Canonical CRM Companies/Contacts CSV columns (docs/import-template.csv). */
export const CRM_IMPORT_HEADERS = [
  "company_name",
  "website",
  "company_email",
  "company_phone",
  "address",
  "city",
  "state_province",
  "country",
  "industry",
  "employee_count",
  "company_linkedin_url",
  "first_name",
  "last_name",
  "title",
  "email",
  "phone",
  "linkedin_url",
  "relationship",
  "do_not_contact",
  "tags",
  "notes",
  "source",
  "owner_email",
] as const;

export type CrmImportHeader = (typeof CRM_IMPORT_HEADERS)[number];

export type CrmImportRelationship =
  | "client"
  | "past_client"
  | "partner"
  | "prospect"
  | "";

export type MappedCrmRow = Record<CrmImportHeader, string> & {
  /** 1-based CSV row number (header = 0) */
  _rowNumber: number;
};

export type ColumnMapping = Partial<Record<CrmImportHeader, string>>;

export type RowIssue = {
  row: number;
  field?: string;
  code: string;
  message: string;
  typoSuggestion?: string;
};

export type ValidationReport = {
  totalRows: number;
  missingCompanyName: number;
  badEmails: number;
  duplicatesInFile: number;
  existingCompanies: number;
  existingContacts: number;
  typoSuggestions: number;
  issues: RowIssue[];
  /** Row numbers that would be skipped as fatal */
  fatalRows: number[];
};

export type ImportRowResult = {
  row: number;
  status: "imported" | "updated" | "skipped" | "failed";
  reason?: string;
  companyId?: string;
  contactId?: string;
  companyAction?: "created" | "updated" | "unchanged";
  contactAction?: "created" | "updated" | "unchanged" | "none";
  fieldsFilled?: string[];
  suppressed?: boolean;
  wonOpportunity?: boolean;
  emailStatus?: string;
  roleGeneric?: boolean;
  typoSuggestion?: string;
  queuedAudit?: boolean;
};

export type ImportSummary = {
  imported: number;
  updated: number;
  skipped: number;
  failed: number;
  companiesCreated: number;
  companiesUpdated: number;
  contactsCreated: number;
  contactsUpdated: number;
  suppressionsAdded: number;
  wonOpportunities: number;
  auditsQueued: number;
  emailChecks: {
    validManual: number;
    invalid: number;
    roleGeneric: number;
    typoSuggestions: number;
  };
  changes: Array<{ row: number; entity: string; fields: string[] }>;
  results: ImportRowResult[];
};

export const CSV_IMPORT_SOURCE = "csv_import";
