import prisma from "@/lib/db/prisma";
import {
  FollowUpJobStatus,
  OutreachSequenceStatus,
  SequenceEnrollmentSource,
} from "@prisma/client";
import { NotFoundError, ValidationError } from "@/lib/api/response";
import { leadMigrationService } from "@/services/lead-migration.service";
import { sequenceEnrollmentService } from "@/services/sequence-enrollment.service";

/**
 * Phase 4 — CampaignLead → canonical Company/Contact + SequenceEnrollment bridge.
 * Non-destructive, idempotent, on-demand. Does not delete CampaignLead/Lead/FollowUpJob.
 */
export class CampaignLeadBridgeService {
  /**
   * Bridge a CampaignLead into canonical enrollment.
   * Cancels PENDING FollowUpJobs for that lead to prevent duplicate sends.
   */
  async bridgeCampaignLead(
    organizationId: string,
    campaignId: string,
    campaignLeadId: string,
    input: {
      sequenceId?: string | null;
      enrolledById?: string | null;
      opportunityId?: string | null;
    } = {}
  ) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId, deletedAt: null },
      include: {
        defaultSequence: { select: { id: true, status: true } },
      },
    });
    if (!campaign) throw new NotFoundError("Campaign not found");

    const campaignLead = await prisma.campaignLead.findFirst({
      where: {
        id: campaignLeadId,
        campaignId,
        campaign: { organizationId, deletedAt: null },
      },
      include: {
        lead: true,
        sequenceEnrollment: true,
      },
    });
    if (!campaignLead) throw new NotFoundError("CampaignLead not found");

    // Idempotent: already bridged
    if (campaignLead.sequenceEnrollment) {
      return {
        alreadyBridged: true as const,
        campaignLeadId: campaignLead.id,
        leadId: campaignLead.leadId,
        enrollmentId: campaignLead.sequenceEnrollment.id,
        companyId: null as string | null,
        contactId: campaignLead.sequenceEnrollment.contactId,
        followUpsCancelled: 0,
      };
    }
    if (campaignLead.bridgedAt) {
      const existing = await prisma.sequenceEnrollment.findFirst({
        where: {
          organizationId,
          campaignLeadId: campaignLead.id,
        },
      });
      if (existing) {
        return {
          alreadyBridged: true as const,
          campaignLeadId: campaignLead.id,
          leadId: campaignLead.leadId,
          enrollmentId: existing.id,
          companyId: null as string | null,
          contactId: existing.contactId,
          followUpsCancelled: 0,
        };
      }
    }

    const sequenceId =
      input.sequenceId || campaign.defaultSequenceId || null;
    if (!sequenceId) {
      throw new ValidationError(
        "No sequence available — set campaign.defaultSequenceId or pass sequenceId"
      );
    }

    const sequence = await prisma.outreachSequence.findFirst({
      where: { id: sequenceId, organizationId },
    });
    if (!sequence) {
      throw new ValidationError("Sequence not found in your organization");
    }
    if (sequence.status !== OutreachSequenceStatus.ACTIVE) {
      throw new ValidationError(
        "Sequence must be ACTIVE to bridge CampaignLead into enrollment"
      );
    }

    // Lead → Company + Contact (idempotent)
    const bridged = await leadMigrationService.ensureCanonicalFromLead(
      organizationId,
      campaignLead.leadId
    );
    if (!bridged.contactId) {
      throw new ValidationError(
        "Lead bridge did not produce a Contact — ensure the lead has a name or email"
      );
    }

    // Cancel pending legacy follow-ups BEFORE creating enrollment (duplicate-send protection)
    const cancelled = await prisma.followUpJob.updateMany({
      where: {
        organizationId,
        leadId: campaignLead.leadId,
        status: FollowUpJobStatus.PENDING,
      },
      data: {
        status: FollowUpJobStatus.CANCELLED,
        completedAt: new Date(),
        lastError: "Cancelled: CampaignLead bridged to SequenceEnrollment",
      },
    });

    const enrollment = await sequenceEnrollmentService.enroll(organizationId, {
      sequenceId,
      contactId: bridged.contactId,
      opportunityId: input.opportunityId ?? bridged.opportunityId ?? null,
      campaignId,
      leadId: campaignLead.leadId,
      campaignLeadId: campaignLead.id,
      source: SequenceEnrollmentSource.CAMPAIGN_LEAD_BRIDGE,
      enrolledById: input.enrolledById,
      startImmediately: true,
    });

    await prisma.campaignLead.update({
      where: { id: campaignLead.id },
      data: { bridgedAt: new Date() },
    });

    return {
      alreadyBridged: false as const,
      campaignLeadId: campaignLead.id,
      leadId: campaignLead.leadId,
      enrollmentId: enrollment.id,
      companyId: bridged.companyId,
      contactId: bridged.contactId,
      followUpsCancelled: cancelled.count,
    };
  }
}

export const campaignLeadBridgeService = new CampaignLeadBridgeService();
