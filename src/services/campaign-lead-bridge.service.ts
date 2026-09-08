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
export type BridgePreviewItem = {
  campaignLeadId: string;
  leadId: string;
  leadEmail: string | null;
  leadName: string;
  alreadyBridged: boolean;
  enrollmentId: string | null;
  canBridge: boolean;
  blockers: string[];
  pendingFollowUpJobs: number;
  processingFollowUpJobs: number;
};

export type BridgePreviewResult = {
  campaignId: string;
  sequenceId: string | null;
  sequenceStatus: string | null;
  totals: {
    campaignLeads: number;
    alreadyBridged: number;
    bridgeable: number;
    blocked: number;
    pendingFollowUpJobs: number;
  };
  items: BridgePreviewItem[];
  notes: string[];
};

/**
 * Phase 4 — CampaignLead → canonical Company/Contact + SequenceEnrollment bridge.
 * Non-destructive, idempotent, on-demand. Does not delete CampaignLead/Lead/FollowUpJob.
 */
export class CampaignLeadBridgeService {
  /**
   * Preview bridge cutover for a campaign. Read-only — no mutations.
   */
  async previewBridge(
    organizationId: string,
    campaignId: string,
    options: { sequenceId?: string | null; limit?: number } = {}
  ): Promise<BridgePreviewResult> {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId, deletedAt: null },
      select: {
        id: true,
        defaultSequenceId: true,
        defaultSequence: { select: { id: true, status: true } },
      },
    });
    if (!campaign) throw new NotFoundError("Campaign not found");

    const sequenceId =
      options.sequenceId || campaign.defaultSequenceId || null;
    let sequenceStatus: string | null = null;
    if (sequenceId) {
      const sequence = await prisma.outreachSequence.findFirst({
        where: { id: sequenceId, organizationId },
        select: { id: true, status: true },
      });
      if (!sequence) {
        throw new ValidationError("Sequence not found in your organization");
      }
      sequenceStatus = sequence.status;
    }

    const limit = Math.min(200, Math.max(1, options.limit ?? 100));
    const campaignLeads = await prisma.campaignLead.findMany({
      where: { campaignId },
      take: limit,
      orderBy: { addedAt: "desc" },
      include: {
        lead: {
          select: {
            id: true,
            fullName: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        sequenceEnrollment: { select: { id: true } },
      },
    });

    const leadIds = campaignLeads.map((cl) => cl.leadId);
    const followUpCounts =
      leadIds.length === 0
        ? []
        : await prisma.followUpJob.groupBy({
            by: ["leadId", "status"],
            where: {
              organizationId,
              leadId: { in: leadIds },
              status: {
                in: [FollowUpJobStatus.PENDING, FollowUpJobStatus.PROCESSING],
              },
            },
            _count: { _all: true },
          });

    const pendingByLead = new Map<string, number>();
    const processingByLead = new Map<string, number>();
    for (const row of followUpCounts) {
      if (row.status === FollowUpJobStatus.PENDING) {
        pendingByLead.set(row.leadId, row._count._all);
      } else if (row.status === FollowUpJobStatus.PROCESSING) {
        processingByLead.set(row.leadId, row._count._all);
      }
    }

    const items: BridgePreviewItem[] = campaignLeads.map((cl) => {
      const blockers: string[] = [];
      const alreadyBridged = Boolean(cl.sequenceEnrollment || cl.bridgedAt);
      if (alreadyBridged) {
        // still report as already bridged — not bridgeable again
      } else {
        if (!sequenceId) {
          blockers.push(
            "No sequence — set campaign.defaultSequenceId or pass sequenceId"
          );
        } else if (sequenceStatus !== OutreachSequenceStatus.ACTIVE) {
          blockers.push("Sequence must be ACTIVE");
        }
        const hasIdentity =
          Boolean(cl.lead.email?.trim()) ||
          Boolean(cl.lead.fullName?.trim()) ||
          Boolean(cl.lead.firstName?.trim()) ||
          Boolean(cl.lead.lastName?.trim());
        if (!hasIdentity) {
          blockers.push("Lead needs name or email for Contact bridge");
        }
      }

      const pending = pendingByLead.get(cl.leadId) ?? 0;
      const processing = processingByLead.get(cl.leadId) ?? 0;

      return {
        campaignLeadId: cl.id,
        leadId: cl.leadId,
        leadEmail: cl.lead.email,
        leadName: cl.lead.fullName,
        alreadyBridged,
        enrollmentId: cl.sequenceEnrollment?.id ?? null,
        canBridge: !alreadyBridged && blockers.length === 0,
        blockers,
        pendingFollowUpJobs: pending,
        processingFollowUpJobs: processing,
      };
    });

    const totals = {
      campaignLeads: items.length,
      alreadyBridged: items.filter((i) => i.alreadyBridged).length,
      bridgeable: items.filter((i) => i.canBridge).length,
      blocked: items.filter((i) => !i.alreadyBridged && !i.canBridge).length,
      pendingFollowUpJobs: items.reduce(
        (s, i) => s + i.pendingFollowUpJobs + i.processingFollowUpJobs,
        0
      ),
    };

    return {
      campaignId,
      sequenceId,
      sequenceStatus,
      totals,
      items,
      notes: [
        "Preview only — no CampaignLead, Lead, or FollowUpJob rows are mutated.",
        "Bridge remains on-demand (one CampaignLead at a time). No bulk auto-migrate.",
        "Bridging a lead cancels that lead's PENDING/PROCESSING FollowUpJobs first.",
      ],
    };
  }

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

    // Cancel pending/processing legacy follow-ups BEFORE creating enrollment (duplicate-send protection)
    const cancelled = await prisma.followUpJob.updateMany({
      where: {
        organizationId,
        leadId: campaignLead.leadId,
        status: {
          in: [FollowUpJobStatus.PENDING, FollowUpJobStatus.PROCESSING],
        },
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
