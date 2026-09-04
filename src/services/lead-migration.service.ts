import prisma from "@/lib/db/prisma";
import { NotFoundError, ValidationError } from "@/lib/api/response";
import { companyService } from "@/services/company.service";
import { contactService } from "@/services/contact.service";

/**
 * LEGACY compatibility bridge: Lead → Company + Contact (+ optional Opportunity link).
 *
 * - Organization-scoped
 * - Idempotent (safe to re-run)
 * - Non-destructive (does not delete leads)
 * - Does NOT bulk-migrate all leads — call per lead
 *
 * @see docs/PHASE2_CRM_ARCHITECTURE.md
 */
export class LeadMigrationService {
  /**
   * Ensure Company (+ Contact when person data exists) for a Lead.
   * Links Lead.companyId and Contact.leadId / Opportunity.leadId when safe.
   */
  async ensureCanonicalFromLead(organizationId: string, leadId: string) {
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, organizationId, deletedAt: null },
      include: {
        opportunity: { select: { id: true, companyId: true } },
        contact: { select: { id: true, companyId: true } },
      },
    });
    if (!lead) throw new NotFoundError("Lead not found");

    const companyName =
      lead.companyName?.trim() ||
      lead.fullName?.trim() ||
      lead.email?.split("@")[1] ||
      "Unknown company";

    let companyId = lead.companyId;
    if (companyId) {
      const owned = await prisma.company.findFirst({
        where: { id: companyId, organizationId, deletedAt: null },
        select: { id: true },
      });
      if (!owned) companyId = null;
    }

    if (!companyId) {
      const company = await companyService.findOrCreate(
        organizationId,
        companyName,
        {
          website: lead.companyWebsite,
          linkedInUrl: lead.companyLinkedIn,
          industry: lead.industry,
          size: lead.companySize,
          description: lead.companyDescription,
          country: lead.country,
          city: lead.city,
          source: lead.source || "lead_bridge",
        }
      );
      companyId = company.id;
      await prisma.lead.update({
        where: { id: lead.id },
        data: { companyId },
      });
    }

    let contactId = lead.contact?.id ?? null;
    if (!contactId && (lead.firstName || lead.email)) {
      const contact = await contactService.findOrCreate(
        organizationId,
        companyId,
        {
          firstName: lead.firstName || "Unknown",
          lastName: lead.lastName || "Contact",
          email: lead.email,
          title: lead.jobTitle,
          phone: lead.phone,
          linkedInUrl: lead.linkedInUrl,
          source: lead.source || "lead_bridge",
          leadId: lead.id,
        }
      );
      contactId = contact.id;
    }

    // Link existing opportunity bridge company consistency (non-destructive)
    if (lead.opportunity && lead.opportunity.companyId !== companyId) {
      return {
        leadId: lead.id,
        companyId,
        contactId,
        opportunityId: lead.opportunity.id,
        warning:
          "Opportunity exists with a different companyId; left unchanged",
      };
    }

    let opportunityId = lead.opportunity?.id ?? null;
    if (opportunityId && contactId) {
      await prisma.opportunity.updateMany({
        where: {
          id: opportunityId,
          organizationId,
          primaryContactId: null,
        },
        data: { primaryContactId: contactId },
      });
    }

    return {
      leadId: lead.id,
      companyId,
      contactId,
      opportunityId,
      warning: null as string | null,
    };
  }

  /** Idempotent convenience: bridge then return canonical ids. */
  async bridgeLead(organizationId: string, leadId: string) {
    if (!organizationId) {
      throw new ValidationError("organizationId is required");
    }
    const first = await this.ensureCanonicalFromLead(organizationId, leadId);
    const second = await this.ensureCanonicalFromLead(organizationId, leadId);
    if (
      first.companyId !== second.companyId ||
      first.contactId !== second.contactId
    ) {
      throw new ValidationError("Lead bridge was not idempotent");
    }
    return second;
  }
}

export const leadMigrationService = new LeadMigrationService();
