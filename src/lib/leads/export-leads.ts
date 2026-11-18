import { CRM_IMPORT_HEADERS } from "@/lib/crm/import/types";
import { ValidationError } from "@/lib/api/response";

/** Company-admin lead export is org membership, never platform super-admin. */
export type LeadExportActor = {
  organizationRoleKey: string | null;
  platformRole: string | null;
  isPlatformAdmin: boolean;
  role: string;
};

export function canCompanyAdminExportLeads(user: LeadExportActor): boolean {
  if (user.isPlatformAdmin || user.platformRole === "SUPER_ADMIN") return false;
  if (user.organizationRoleKey === "company_admin") return true;
  if (!user.organizationRoleKey && user.role === "ADMIN") return true;
  return false;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Inclusive calendar dates interpreted as UTC midnights. */
export function parseLeadExportRange(from: string, to: string): {
  gte: Date;
  lt: Date;
} {
  if (!ISO_DATE.test(from) || !ISO_DATE.test(to)) {
    throw new ValidationError("Use start and end dates in YYYY-MM-DD format");
  }
  const gte = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  if (Number.isNaN(gte.getTime()) || Number.isNaN(end.getTime())) {
    throw new ValidationError("Invalid date");
  }
  const lt = new Date(end);
  lt.setUTCDate(lt.getUTCDate() + 1);
  if (gte >= lt) {
    throw new ValidationError("Start date must be on or before the end date");
  }
  return { gte, lt };
}

export const LEAD_EXPORT_COLUMNS = ["created_at", ...CRM_IMPORT_HEADERS] as const;

export type LeadExportColumn = (typeof LEAD_EXPORT_COLUMNS)[number];

export type LeadExportSource = {
  createdAt: Date;
  firstName: string;
  lastName: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  linkedInUrl: string | null;
  source: string | null;
  status: string;
  company: {
    name: string;
    website: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    industry: string | null;
    employeeCount: number | null;
    linkedInUrl: string | null;
    source: string | null;
    emails: { email: string }[];
  };
};

export function leadExportRow(
  contact: LeadExportSource
): Record<LeadExportColumn, string> {
  return {
    created_at: contact.createdAt.toISOString(),
    company_name: contact.company.name,
    website: contact.company.website ?? "",
    company_email: contact.company.emails[0]?.email ?? "",
    company_phone: contact.company.phone ?? "",
    address: contact.company.address ?? "",
    city: contact.company.city ?? "",
    state_province: contact.company.state ?? "",
    country: contact.company.country ?? "",
    industry: contact.company.industry ?? "",
    employee_count:
      contact.company.employeeCount != null
        ? String(contact.company.employeeCount)
        : "",
    company_linkedin_url: contact.company.linkedInUrl ?? "",
    first_name: contact.firstName,
    last_name: contact.lastName,
    title: contact.title ?? "",
    email: contact.email ?? "",
    phone: contact.phone ?? "",
    linkedin_url: contact.linkedInUrl ?? "",
    relationship: "",
    do_not_contact: contact.status === "UNSUBSCRIBED" ? "yes" : "",
    tags: "",
    notes: "",
    source: contact.source ?? contact.company.source ?? "",
    owner_email: "",
  };
}
