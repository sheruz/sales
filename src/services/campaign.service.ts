import prisma from "@/lib/db/prisma";
import { NotFoundError } from "@/lib/api/response";
import type { CreateCampaignInput, UpdateCampaignInput } from "@/lib/validations/automation";
import { DEFAULT_FOLLOW_UP_STEPS } from "@/lib/constants/automation";

export class CampaignService {
  async list() {
    return prisma.campaign.findMany({
      where: { deletedAt: null },
      include: {
        service: { select: { id: true, name: true } },
        _count: { select: { leads: true, campaignLeads: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async getById(id: string) {
    const campaign = await prisma.campaign.findFirst({
      where: { id, deletedAt: null },
      include: {
        service: true,
        followUpSequence: true,
        _count: { select: { leads: true, campaignLeads: true } },
      },
    });
    if (!campaign) throw new NotFoundError("Campaign not found");
    return campaign;
  }

  async create(input: CreateCampaignInput) {
    const campaign = await prisma.campaign.create({
      data: {
        name: input.name,
        description: input.description,
        targetAudience: input.targetAudience,
        targetCountries: input.targetCountries,
        targetIndustries: input.targetIndustries,
        serviceId: input.serviceId,
        aiInstructions: input.aiInstructions,
        dailyOutreachLimit: input.dailyOutreachLimit,
        status: input.status,
      },
      include: { service: { select: { id: true, name: true } } },
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

  async update(id: string, input: UpdateCampaignInput) {
    await this.getById(id);
    return prisma.campaign.update({
      where: { id },
      data: input,
      include: { service: { select: { id: true, name: true } } },
    });
  }

  async delete(id: string) {
    await this.getById(id);
    return prisma.campaign.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async getStats(id: string) {
    const campaign = await this.getById(id);
    const [totalLeads, automatedLeads, repliedLeads, hotLeads] = await Promise.all([
      prisma.lead.count({ where: { campaignId: id, deletedAt: null } }),
      prisma.lead.count({
        where: {
          campaignId: id,
          deletedAt: null,
          automationStatus: { not: "IDLE" },
        },
      }),
      prisma.lead.count({
        where: { campaignId: id, deletedAt: null, status: { in: ["REPLIED", "INTERESTED", "MEETING"] } },
      }),
      prisma.lead.count({
        where: { campaignId: id, deletedAt: null, scoreCategory: "HOT" },
      }),
    ]);

    return { campaign, stats: { totalLeads, automatedLeads, repliedLeads, hotLeads } };
  }
}

export const campaignService = new CampaignService();
