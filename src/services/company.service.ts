import prisma from "@/lib/db/prisma";
import { CompanyStatus, type Prisma } from "@prisma/client";
import { NotFoundError } from "@/lib/api/response";
import type { CreateCompanyInput } from "@/lib/validations/lead";

export function extractDomain(website?: string | null): string | null {
  if (!website?.trim()) return null;
  try {
    const raw = website.includes("://") ? website : `https://${website}`;
    const host = new URL(raw).hostname.replace(/^www\./, "").toLowerCase();
    return host || null;
  } catch {
    return null;
  }
}

export type CompanyWriteInput = CreateCompanyInput & {
  domain?: string | null;
  state?: string | null;
  employeeCount?: number | null;
  employeeRange?: string | null;
  revenueRange?: string | null;
  foundedYear?: number | null;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  technologies?: string[];
  fundingTotal?: number | null;
  lastFundingDate?: string | null;
  status?: CompanyStatus;
  source?: string | null;
  metadata?: unknown;
};

export class CompanyService {
  async list(organizationId: string, search?: string) {
    return prisma.company.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" as const } },
                { domain: { contains: search, mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
      orderBy: { name: "asc" },
      take: 50,
    });
  }

  async getById(organizationId: string, id: string) {
    const company = await prisma.company.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        leads: {
          where: { deletedAt: null, organizationId },
          take: 10,
          orderBy: { createdAt: "desc" },
        },
        contacts: { take: 20, orderBy: { createdAt: "desc" } },
        signals: { take: 20, orderBy: { detectedAt: "desc" } },
        opportunities: { take: 10, orderBy: { updatedAt: "desc" } },
      },
    });
    if (!company) throw new NotFoundError("Company not found");
    return company;
  }

  async create(organizationId: string, input: CompanyWriteInput) {
    const domain =
      input.domain?.trim().toLowerCase() || extractDomain(input.website);

    return prisma.company.create({
      data: {
        organizationId,
        name: input.name,
        domain,
        website: input.website || null,
        linkedInUrl: input.linkedInUrl || null,
        industry: input.industry || null,
        size: input.size || input.employeeRange || null,
        employeeRange: input.employeeRange || input.size || null,
        employeeCount: input.employeeCount,
        description: input.description || null,
        country: input.country || null,
        state: input.state || null,
        city: input.city || null,
        revenueRange: input.revenueRange,
        foundedYear: input.foundedYear,
        instagramUrl: input.instagramUrl,
        facebookUrl: input.facebookUrl,
        technologies: input.technologies ?? [],
        fundingTotal: input.fundingTotal,
        lastFundingDate: input.lastFundingDate
          ? new Date(input.lastFundingDate)
          : null,
        status: input.status ?? CompanyStatus.ACTIVE,
        source: input.source,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async findOrCreate(
    organizationId: string,
    name: string,
    data?: Partial<CompanyWriteInput>
  ) {
    const domain =
      data?.domain?.trim().toLowerCase() || extractDomain(data?.website);

    if (domain) {
      const byDomain = await prisma.company.findFirst({
        where: { organizationId, domain, deletedAt: null },
      });
      if (byDomain) {
        return prisma.company.update({
          where: { id: byDomain.id },
          data: {
            industry: data?.industry ?? undefined,
            description: data?.description ?? undefined,
            website: data?.website ?? undefined,
            linkedInUrl: data?.linkedInUrl ?? undefined,
            country: data?.country ?? undefined,
            city: data?.city ?? undefined,
            size: data?.size ?? data?.employeeRange ?? undefined,
            employeeRange: data?.employeeRange ?? data?.size ?? undefined,
          },
        });
      }
    }

    const existing = await prisma.company.findFirst({
      where: {
        organizationId,
        name: { equals: name, mode: "insensitive" },
        deletedAt: null,
      },
    });
    if (existing) {
      if (domain && !existing.domain) {
        try {
          return await prisma.company.update({
            where: { id: existing.id },
            data: { domain, website: data?.website ?? existing.website },
          });
        } catch {
          return existing;
        }
      }
      return existing;
    }

    return this.create(organizationId, {
      name,
      website: data?.website,
      linkedInUrl: data?.linkedInUrl,
      industry: data?.industry,
      size: data?.size,
      description: data?.description,
      country: data?.country,
      city: data?.city,
      domain,
      employeeRange: data?.employeeRange,
      source: data?.source ?? "system",
      ...data,
    });
  }
}

export const companyService = new CompanyService();
