import prisma from "@/lib/db/prisma";
import { SequenceEnrollmentStatus } from "@prisma/client";

const OPEN_ENROLLMENT: SequenceEnrollmentStatus[] = [
  SequenceEnrollmentStatus.PENDING,
  SequenceEnrollmentStatus.ACTIVE,
  SequenceEnrollmentStatus.PROCESSING,
  SequenceEnrollmentStatus.PAUSED,
];

export type LegacyCanonicalConflict = {
  blocked: boolean;
  reason: "campaign_lead_bridged" | "open_sequence_enrollment" | null;
};

/**
 * Phase 4 duplicate-send protection.
 * Legacy automation must not send when canonical sequence path is active
 * for the same lead (or the same person via Contact.leadId / matching email).
 */
export async function detectLegacyCanonicalConflict(
  organizationId: string,
  leadId: string,
  leadEmail?: string | null
): Promise<LegacyCanonicalConflict> {
  const bridgedCl = await prisma.campaignLead.findFirst({
    where: {
      leadId,
      bridgedAt: { not: null },
      campaign: { organizationId, deletedAt: null },
    },
    select: { id: true },
  });
  if (bridgedCl) {
    return { blocked: true, reason: "campaign_lead_bridged" };
  }

  const openByLead = await prisma.sequenceEnrollment.findFirst({
    where: {
      organizationId,
      leadId,
      status: { in: OPEN_ENROLLMENT },
    },
    select: { id: true },
  });
  if (openByLead) {
    return { blocked: true, reason: "open_sequence_enrollment" };
  }

  // Contact bridged from this Lead (Contact.leadId)
  const contactViaLead = await prisma.contact.findFirst({
    where: { organizationId, leadId },
    select: { id: true },
  });
  if (contactViaLead) {
    const openByContact = await prisma.sequenceEnrollment.findFirst({
      where: {
        organizationId,
        contactId: contactViaLead.id,
        status: { in: OPEN_ENROLLMENT },
      },
      select: { id: true },
    });
    if (openByContact) {
      return { blocked: true, reason: "open_sequence_enrollment" };
    }
  }

  // Same-person match via normalized email within org (Contact enroll without leadId)
  const email = leadEmail?.trim().toLowerCase();
  if (email) {
    const contactsByEmail = await prisma.contact.findMany({
      where: {
        organizationId,
        OR: [{ email: { equals: email, mode: "insensitive" } }, { normalizedEmail: email }],
      },
      select: { id: true },
      take: 10,
    });
    if (contactsByEmail.length) {
      const openByEmail = await prisma.sequenceEnrollment.findFirst({
        where: {
          organizationId,
          contactId: { in: contactsByEmail.map((c) => c.id) },
          status: { in: OPEN_ENROLLMENT },
        },
        select: { id: true },
      });
      if (openByEmail) {
        return { blocked: true, reason: "open_sequence_enrollment" };
      }
    }
  }

  return { blocked: false, reason: null };
}

export function conflictSkipMessage(reason: LegacyCanonicalConflict["reason"]) {
  if (reason === "campaign_lead_bridged") {
    return "Skipped: CampaignLead bridged to SequenceEnrollment";
  }
  if (reason === "open_sequence_enrollment") {
    return "Skipped: open SequenceEnrollment exists for lead/contact";
  }
  return "Skipped: canonical enrollment active";
}
