import prisma from "@/lib/db/prisma";
import {
  BrainDocumentStatus,
  BrainDocumentType,
  CatalogItemStatus,
  type Prisma,
} from "@prisma/client";
import { NotFoundError, ValidationError } from "@/lib/api/response";

export type BusinessProfileInput = {
  companyName: string;
  description?: string | null;
  website?: string | null;
  industry?: string | null;
  locations?: string[];
  targetMarkets?: string[];
  companySize?: string | null;
  yearsInBusiness?: number | null;
  positioning?: string | null;
  valueProposition?: string | null;
  competitiveAdvantages?: string[];
  metadata?: unknown;
};

export type BrainDocumentInput = {
  type: BrainDocumentType;
  title: string;
  content: string;
  sourceType?: string | null;
  sourceUrl?: string | null;
  status?: BrainDocumentStatus;
};

/** Concise, safe context for AI — no private chain-of-thought. */
export type BusinessBrainContext = {
  organizationId: string;
  profile: {
    companyName: string;
    description: string | null;
    industry: string | null;
    website: string | null;
    locations: string[];
    targetMarkets: string[];
    companySize: string | null;
    positioning: string | null;
    valueProposition: string | null;
    competitiveAdvantages: string[];
  } | null;
  services: Array<{
    id: string;
    name: string;
    description: string;
    category: string | null;
    idealCustomer: string | null;
    problemsSolved: string[];
    technologies: string[];
    minBudget: string | null;
    maxBudget: string | null;
    currency: string;
  }>;
  icps: Array<{
    id: string;
    name: string;
    description: string | null;
    industries: string[];
    countries: string[];
    regions: string[];
    companySizes: string[];
    jobSignals: string[];
    buyingSignals: string[];
    decisionMakerTitles: string[];
    exclusions: string[];
    priority: number;
  }>;
  activeGoals: Array<{
    id: string;
    name: string;
    targetRevenue: string;
    currency: string;
    targetDeals: number | null;
    averageDealValue: string | null;
    startDate: string | null;
    endDate: string | null;
    targetRegions: string[];
    targetIndustries: string[];
    targetServices: string[];
    preferredChannels: string[];
  }>;
  documents: Array<{
    id: string;
    type: BrainDocumentType;
    title: string;
    summary: string;
  }>;
};

function summarizeContent(content: string, max = 400): string {
  const cleaned = content.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1)}…`;
}

export class BusinessBrainService {
  async getProfile(organizationId: string) {
    return prisma.businessProfile.findUnique({ where: { organizationId } });
  }

  async upsertProfile(organizationId: string, input: BusinessProfileInput) {
    if (!input.companyName?.trim()) {
      throw new ValidationError("Company name is required");
    }

    return prisma.businessProfile.upsert({
      where: { organizationId },
      create: {
        organizationId,
        companyName: input.companyName.trim(),
        description: input.description,
        website: input.website,
        industry: input.industry,
        locations: input.locations ?? [],
        targetMarkets: input.targetMarkets ?? [],
        companySize: input.companySize,
        yearsInBusiness: input.yearsInBusiness,
        positioning: input.positioning,
        valueProposition: input.valueProposition,
        competitiveAdvantages: input.competitiveAdvantages ?? [],
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
      },
      update: {
        companyName: input.companyName.trim(),
        description: input.description,
        website: input.website,
        industry: input.industry,
        locations: input.locations,
        targetMarkets: input.targetMarkets,
        companySize: input.companySize,
        yearsInBusiness: input.yearsInBusiness,
        positioning: input.positioning,
        valueProposition: input.valueProposition,
        competitiveAdvantages: input.competitiveAdvantages,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async listDocuments(organizationId: string) {
    return prisma.businessBrainDocument.findMany({
      where: { organizationId },
      include: {
        versions: { orderBy: { version: "desc" }, take: 1 },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  async createDocument(
    organizationId: string,
    userId: string,
    input: BrainDocumentInput
  ) {
    const content = input.content.trim();
    if (!content) throw new ValidationError("Content is required");

    return prisma.$transaction(async (tx) => {
      const doc = await tx.businessBrainDocument.create({
        data: {
          organizationId,
          type: input.type,
          title: input.title.trim(),
          content,
          sourceType: input.sourceType ?? "manual",
          sourceUrl: input.sourceUrl,
          status: input.status ?? BrainDocumentStatus.ACTIVE,
          createdById: userId,
        },
      });

      await tx.businessBrainVersion.create({
        data: {
          documentId: doc.id,
          version: 1,
          content,
          generatedSummary: summarizeContent(content),
          createdById: userId,
        },
      });

      return doc;
    });
  }

  async updateDocument(
    organizationId: string,
    documentId: string,
    userId: string,
    input: Partial<BrainDocumentInput>
  ) {
    const doc = await prisma.businessBrainDocument.findFirst({
      where: { id: documentId, organizationId },
      include: { versions: { orderBy: { version: "desc" }, take: 1 } },
    });
    if (!doc) throw new NotFoundError("Document not found");

    const nextContent = input.content?.trim() ?? doc.content;
    const nextVersion = (doc.versions[0]?.version ?? 0) + 1;
    const contentChanged = input.content !== undefined && input.content.trim() !== doc.content;

    return prisma.$transaction(async (tx) => {
      const updated = await tx.businessBrainDocument.update({
        where: { id: documentId },
        data: {
          type: input.type,
          title: input.title?.trim(),
          content: nextContent,
          sourceType: input.sourceType,
          sourceUrl: input.sourceUrl,
          status: input.status,
        },
      });

      if (contentChanged) {
        await tx.businessBrainVersion.create({
          data: {
            documentId,
            version: nextVersion,
            content: nextContent,
            generatedSummary: summarizeContent(nextContent),
            createdById: userId,
          },
        });
      }

      return updated;
    });
  }

  async deleteDocument(organizationId: string, documentId: string) {
    const doc = await prisma.businessBrainDocument.findFirst({
      where: { id: documentId, organizationId },
    });
    if (!doc) throw new NotFoundError("Document not found");
    await prisma.businessBrainDocument.delete({ where: { id: documentId } });
  }

  /**
   * Safe retrieval for opportunity AI — concise business facts only.
   * Never includes private model reasoning or raw prompt chains.
   */
  async getSafeContext(organizationId: string): Promise<BusinessBrainContext> {
    const [profile, services, icps, goals, documents] = await Promise.all([
      prisma.businessProfile.findUnique({ where: { organizationId } }),
      prisma.service.findMany({
        where: {
          organizationId,
          OR: [{ isActive: true }, { status: CatalogItemStatus.ACTIVE }],
        },
        orderBy: { name: "asc" },
      }),
      prisma.icp.findMany({
        where: { organizationId, status: CatalogItemStatus.ACTIVE },
        orderBy: [{ priority: "desc" }, { name: "asc" }],
      }),
      prisma.revenueGoal.findMany({
        where: { organizationId, status: "ACTIVE" },
        orderBy: { endDate: "asc" },
      }),
      prisma.businessBrainDocument.findMany({
        where: { organizationId, status: BrainDocumentStatus.ACTIVE },
        include: {
          versions: { orderBy: { version: "desc" }, take: 1 },
        },
        orderBy: { updatedAt: "desc" },
        take: 25,
      }),
    ]);

    return {
      organizationId,
      profile: profile
        ? {
            companyName: profile.companyName,
            description: profile.description,
            industry: profile.industry,
            website: profile.website,
            locations: profile.locations,
            targetMarkets: profile.targetMarkets,
            companySize: profile.companySize,
            positioning: profile.positioning,
            valueProposition: profile.valueProposition,
            competitiveAdvantages: profile.competitiveAdvantages,
          }
        : null,
      services: services.map((s) => ({
        id: s.id,
        name: s.name,
        description: summarizeContent(s.description, 300),
        category: s.category,
        idealCustomer: s.idealCustomer ?? s.targetClientType,
        problemsSolved: s.problemsSolved,
        technologies: s.technologies,
        minBudget: s.minBudget?.toString() ?? null,
        maxBudget: s.maxBudget?.toString() ?? null,
        currency: s.currency,
      })),
      icps: icps.map((i) => ({
        id: i.id,
        name: i.name,
        description: i.description,
        industries: i.industries,
        countries: i.countries,
        regions: i.regions,
        companySizes: i.companySizes,
        jobSignals: i.jobSignals,
        buyingSignals: i.buyingSignals,
        decisionMakerTitles: i.decisionMakerTitles,
        exclusions: i.exclusions,
        priority: i.priority,
      })),
      activeGoals: goals.map((g) => ({
        id: g.id,
        name: g.name,
        targetRevenue: g.targetRevenue.toString(),
        currency: g.currency,
        targetDeals: g.targetDeals,
        averageDealValue: g.averageDealValue?.toString() ?? null,
        startDate: g.startDate?.toISOString().slice(0, 10) ?? null,
        endDate: g.endDate?.toISOString().slice(0, 10) ?? null,
        targetRegions: g.targetRegions,
        targetIndustries: g.targetIndustries,
        targetServices: g.targetServices,
        preferredChannels: g.preferredChannels,
      })),
      documents: documents.map((d) => ({
        id: d.id,
        type: d.type,
        title: d.title,
        summary:
          d.versions[0]?.generatedSummary ?? summarizeContent(d.content, 280),
      })),
    };
  }
}

export const businessBrainService = new BusinessBrainService();
