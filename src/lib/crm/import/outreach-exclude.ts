import type { CrmImportRelationship } from "@/lib/crm/import/types";
import { isCustomerRelationship } from "@/lib/crm/import/normalize";

/** Company/contact metadata flags set by CSV import (and similar). */
export type OutreachExcludeMeta = {
  outreachExcluded?: boolean;
  customerType?: string;
  relationship?: string;
  doNotContact?: boolean;
};

export function isCustomerTypeValue(
  value: string | null | undefined
): value is Exclude<CrmImportRelationship, "" | "prospect"> {
  const v = (value || "").toLowerCase();
  return v === "client" || v === "past_client" || v === "partner";
}

/**
 * Clients / past_client / partner / DNC — never audited, enrolled, or emailed.
 */
export function isOutreachExcluded(input: {
  companyMetadata?: unknown;
  contactMetadata?: unknown;
  contactStatus?: string | null;
}): boolean {
  const company = asMeta(input.companyMetadata);
  const contact = asMeta(input.contactMetadata);

  if (company.outreachExcluded || contact.outreachExcluded) return true;
  if (contact.doNotContact) return true;
  if (isCustomerTypeValue(company.customerType || company.relationship)) {
    return true;
  }
  if (isCustomerTypeValue(contact.relationship)) return true;
  if (
    input.contactStatus === "UNSUBSCRIBED" ||
    input.contactStatus === "BOUNCED"
  ) {
    return true;
  }
  return false;
}

export function customerTypeFromRelationship(
  rel: CrmImportRelationship,
  dnc: boolean
): {
  customerType: string;
  relationship: string;
  outreachExcluded: boolean;
} {
  const isCustomer = isCustomerRelationship(rel);
  return {
    customerType: isCustomer ? rel || "client" : rel || "prospect",
    relationship: rel || "prospect",
    outreachExcluded: isCustomer || dnc,
  };
}

function asMeta(raw: unknown): OutreachExcludeMeta {
  if (!raw || typeof raw !== "object") return {};
  return raw as OutreachExcludeMeta;
}
