import prisma from "@/lib/db/prisma";
import { CatalogItemStatus } from "@prisma/client";
import { NotFoundError, ValidationError } from "@/lib/api/response";

export type IcpInput = {
  name: string;
  description?: string | null;
  industries?: string[];
  countries?: string[];
  regions?: string[];
  companySizes?: string[];
  revenueRanges?: string[];
  technologies?: string[];
  fundingStages?: string[];
  fundingMin?: number | null;
  fundingMax?: number | null;
  jobSignals?: string[];
  buyingSignals?: string[];
  decisionMakerTitles?: string[];
  exclusions?: string[];
  priority?: number;
  status?: CatalogItemStatus;
};

export class IcpService {
  async list(organizationId: string, includeInactive = false) {
    return prisma.icp.findMany({
      where: {
        organizationId,
        ...(includeInactive ? {} : { status: CatalogItemStatus.ACTIVE }),
      },
      orderBy: [{ priority: "desc" }, { name: "asc" }],
    });
  }

  async getById(organizationId: string, id: string) {
    const icp = await prisma.icp.findFirst({ where: { id, organizationId } });
    if (!icp) throw new NotFoundError("ICP not found");
    return icp;
  }

  async create(organizationId: string, input: IcpInput) {
    if (!input.name.trim()) throw new ValidationError("Name is required");
    return prisma.icp.create({
      data: {
        organizationId,
        name: input.name.trim(),
        description: input.description,
        industries: input.industries ?? [],
        countries: input.countries ?? [],
        regions: input.regions ?? [],
        companySizes: input.companySizes ?? [],
        revenueRanges: input.revenueRanges ?? [],
        technologies: input.technologies ?? [],
        fundingStages: input.fundingStages ?? [],
        fundingMin: input.fundingMin,
        fundingMax: input.fundingMax,
        jobSignals: input.jobSignals ?? [],
        buyingSignals: input.buyingSignals ?? [],
        decisionMakerTitles: input.decisionMakerTitles ?? [],
        exclusions: input.exclusions ?? [],
        priority: input.priority ?? 0,
        status: input.status ?? CatalogItemStatus.ACTIVE,
      },
    });
  }

  async update(organizationId: string, id: string, input: Partial<IcpInput>) {
    await this.getById(organizationId, id);
    return prisma.icp.update({
      where: { id },
      data: {
        name: input.name?.trim(),
        description: input.description,
        industries: input.industries,
        countries: input.countries,
        regions: input.regions,
        companySizes: input.companySizes,
        revenueRanges: input.revenueRanges,
        technologies: input.technologies,
        fundingStages: input.fundingStages,
        fundingMin: input.fundingMin,
        fundingMax: input.fundingMax,
        jobSignals: input.jobSignals,
        buyingSignals: input.buyingSignals,
        decisionMakerTitles: input.decisionMakerTitles,
        exclusions: input.exclusions,
        priority: input.priority,
        status: input.status,
      },
    });
  }

  async delete(organizationId: string, id: string) {
    await this.getById(organizationId, id);
    return prisma.icp.update({
      where: { id },
      data: { status: CatalogItemStatus.INACTIVE },
    });
  }
}

export const icpService = new IcpService();
