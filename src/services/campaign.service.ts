import prisma from "@/lib/db/prisma";
import { SequenceEnrollmentSource } from "@prisma/client";
import { NotFoundError, ValidationError } from "@/lib/api/response";
import type { CreateCampaignInput, UpdateCampaignInput } from "@/lib/validations/automation";
import { DEFAULT_FOLLOW_UP_STEPS } from "@/lib/constants/automation";
import { sequenceEnrollmentService } from "@/services/sequence-enrollment.service";

export class CampaignService {
  async list(organizationId: string) {
    return prisma.campaign.findMany({
      where: { organizationId, deletedAt: null },
      include: {
        service: { select: { id: true, name: true } },
        defaultSequence: { select: { id: true, name: true, status: true } },
        _count: {
          select: { leads: true, campaignLeads: true, sequenceEnrollments: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async getById(organizationId: string, id: string) {
    const campaign = await prisma.campaign.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        service: true,
        followUpSequence: true,
        defaultSequence: {
          select: { id: true, name: true, status: true, description: true },
        },
        campaignLeads: {
          orderBy: { addedAt: "desc" },
          take: 100,
          include: {
            lead: {
              select: {
                id: true,
                fullName: true,
                email: true,
                companyName: true,
                status: true,
                automationStatus: true,
              },
            },
            sequenceEnrollment: {
              select: {
                id: true,
                status: true,
                currentStepOrder: true,
                nextRunAt: true,
                stopReason: true,
              },
            },
          },
        },
        _count: {
          select: { leads: true, campaignLeads: true, sequenceEnrollments: true },
        },
      },
    });
    if (!campaign) throw new NotFoundError("Campaign not found");
    return campaign;
  }

  async create(organizationId: string, input: CreateCampaignInput) {
    if (input.defaultSequenceId) {
      await this.assertSequenceInOrg(organizationId, input.defaultSequenceId);
    }

    const campaign = await prisma.campaign.create({
      data: {
        organizationId,
        name: input.name,
        description: input.description,
        targetAudience: input.targetAudience,
        targetCountries: input.targetCountries,
        targetIndustries: input.targetIndustries,
        serviceId: input.serviceId,
        aiInstructions: input.aiInstructions,
        dailyOutreachLimit: input.dailyOutreachLimit,
        status: input.status,
        defaultSequenceId: input.defaultSequenceId ?? null,
      },
      include: {
        service: { select: { id: true, name: true } },
        defaultSequence: { select: { id: true, name: true, status: true } },
      },
    });

    await prisma.followUpSequence.create({
      data: {
        campaignId: campaign.id,
        name: `${campaign.name} Follow-up`,
        steps: DEFAULT_FOLLOW_UP_STEPS,
      },
    });

    return campaign;
  }

  async update(organizationId: string, id: string, input: UpdateCampaignInput) {
    await this.getById(organizationId, id);

    if (input.defaultSequenceId !== undefined && input.defaultSequenceId !== null) {
      await this.assertSequenceInOrg(organizationId, input.defaultSequenceId);
    }

    const { defaultSequenceId, ...rest } = input;
    const updated = await prisma.campaign.updateMany({
      where: { id, organizationId, deletedAt: null },
      data: {
        ...rest,
        ...(defaultSequenceId !== undefined
          ? { defaultSequenceId: defaultSequenceId || null }
          : {}),
      },
    });
    if (updated.count === 0) throw new NotFoundError("Campaign not found");
    return prisma.campaign.findFirstOrThrow({
      where: { id, organizationId },
      include: {
        service: { select: { id: true, name: true } },
        defaultSequence: { select: { id: true, name: true, status: true } },
      },
    });
  }

  async delete(organizationId: string, id: string) {
    await this.getById(organizationId, id);
    return prisma.campaign.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async getStats(organizationId: string, id: string) {
    const campaign = await this.getById(organizationId, id);
    const [totalLeads, automatedLeads, repliedLeads, hotLeads, canonicalEnrollments] =
      await Promise.all([
        prisma.lead.count({
          where: { organizationId, campaignId: id, deletedAt: null },
        }),
        prisma.lead.count({
          where: {
            organizationId,
            campaignId: id,
            deletedAt: null,
            automationStatus: { not: "IDLE" },
          },
        }),
        prisma.lead.count({
          where: {
            organizationId,
            campaignId: id,
            deletedAt: null,
            status: { in: ["REPLIED", "INTERESTED", "MEETING"] },
          },
        }),
        prisma.lead.count({
          where: {
            organizationId,
            campaignId: id,
            deletedAt: null,
            scoreCategory: "HOT",
          },
        }),
        prisma.sequenceEnrollment.count({
          where: { organizationId, campaignId: id },
        }),
      ]);

    return {
      campaign,
      stats: {
        totalLeads,
        automatedLeads,
        repliedLeads,
        hotLeads,
        canonicalEnrollments,
      },
    };
  }

  /**
   * Canonical campaign enrollment — Contact required, Opportunity optional.
   * Uses campaign.defaultSequenceId when sequenceId omitted.
   */
  async enrollContact(
    organizationId: string,
    campaignId: string,
    input: {
      contactId: string;
      opportunityId?: string | null;
      sequenceId?: string | null;
      enrolledById?: string | null;
    }
  ) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId, deletedAt: null },
      select: { id: true, defaultSequenceId: true },
    });
    if (!campaign) throw new NotFoundError("Campaign not found");

    const sequenceId = input.sequenceId || campaign.defaultSequenceId;
    if (!sequenceId) {
      throw new ValidationError(
        "sequenceId required — or set a default sequence on the campaign"
      );
    }

    return sequenceEnrollmentService.enroll(organizationId, {
      sequenceId,
      contactId: input.contactId,
      opportunityId: input.opportunityId,
      campaignId,
      source: SequenceEnrollmentSource.CAMPAIGN,
      enrolledById: input.enrolledById,
      startImmediately: true,
    });
  }

  private async assertSequenceInOrg(organizationId: string, sequenceId: string) {
    const sequence = await prisma.outreachSequence.findFirst({
      where: { id: sequenceId, organizationId },
      select: { id: true },
    });
    if (!sequence) {
      throw new ValidationError("Sequence not found in your organization");
    }
  }
}

export const campaignService = new CampaignService();
