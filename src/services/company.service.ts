import prisma from "@/lib/db/prisma";
import { CompanyStatus, type Prisma } from "@prisma/client";
import { NotFoundError, ValidationError } from "@/lib/api/response";

/** Normalize a website or bare host to lowercase domain without www. */
export function extractDomain(website?: string | null): string | null {
  if (!website?.trim()) return null;
  try {
    const raw = website.includes("://") ? website : `https://${website}`;
    const host = new URL(raw).hostname.replace(/^www\./, "").toLowerCase();
    return host || null;
  } catch {
    const cleaned = website
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0];
    return cleaned || null;
  }
}

export function normalizeDomain(domain?: string | null): string | null {
  if (!domain?.trim()) return null;
  return (
    extractDomain(domain) ||
    domain.trim().toLowerCase().replace(/^www\./, "")
  );
}

export type CompanyWriteInput = {
  name: string;
  website?: string | null;
  linkedInUrl?: string | null;
  industry?: string | null;
  size?: string | null;
  description?: string | null;
  country?: string | null;
  city?: string | null;
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

export type CompanyListQuery = {
  page?: number;
  limit?: number;
  search?: string;
  domain?: string;
};

export class CompanyService {
  async list(organizationId: string, query: CompanyListQuery = {}) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 25));
    const skip = (page - 1) * limit;
    const domainFilter = normalizeDomain(query.domain);

    const where: Prisma.CompanyWhereInput = {
      organizationId,
      deletedAt: null,
      ...(domainFilter
        ? {
            OR: [
              { domain: domainFilter },
              { normalizedDomain: domainFilter },
            ],
          }
        : {}),
      ...(query.search
        ? {
            AND: [
              {
                OR: [
                  { name: { contains: query.search, mode: "insensitive" } },
                  { domain: { contains: query.search, mode: "insensitive" } },
                  {
                    normalizedDomain: {
                      contains: query.search.toLowerCase(),
                      mode: "insensitive",
                    },
                  },
                ],
              },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.company.findMany({
        where,
        orderBy: { name: "asc" },
        skip,
        take: limit,
        include: {
          _count: {
            select: {
              contacts: true,
              opportunities: true,
              signals: true,
            },
          },
          signals: {
            orderBy: { detectedAt: "desc" },
            take: 1,
            select: { id: true, title: true, detectedAt: true },
          },
          opportunities: {
            orderBy: { updatedAt: "desc" },
            take: 1,
            select: { id: true, stage: true, updatedAt: true },
          },
        },
      }),
      prisma.company.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async getById(organizationId: string, id: string) {
    const company = await prisma.company.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        contacts: { orderBy: { createdAt: "desc" }, take: 50 },
        signals: { orderBy: { detectedAt: "desc" }, take: 30 },
        opportunities: {
          orderBy: { updatedAt: "desc" },
          take: 30,
          include: {
            primaryContact: {
              select: { id: true, fullName: true, email: true },
            },
          },
        },
        inboxConversations: {
          orderBy: { lastMessageAt: "desc" },
          take: 20,
        },
        deals: {
          where: { deletedAt: null },
          orderBy: { updatedAt: "desc" },
          take: 20,
        },
        meetings: { orderBy: { date: "desc" }, take: 20 },
        _count: {
          select: {
            contacts: true,
            signals: true,
            opportunities: true,
            deals: true,
          },
        },
      },
    });
    if (!company) throw new NotFoundError("Company not found");
    return company;
  }

  async create(organizationId: string, input: CompanyWriteInput) {
    const domain =
      normalizeDomain(input.domain) || extractDomain(input.website);

    return prisma.company.create({
      data: {
        organizationId,
        name: input.name.trim(),
        domain,
        normalizedDomain: domain,
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

  async update(
    organizationId: string,
    id: string,
    input: Partial<CompanyWriteInput>
  ) {
    const existing = await prisma.company.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!existing) throw new NotFoundError("Company not found");

    const domain =
      input.domain !== undefined
        ? normalizeDomain(input.domain) || extractDomain(input.website)
        : input.website !== undefined
          ? extractDomain(input.website) || existing.domain
          : undefined;

    try {
      return await prisma.company.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          ...(domain !== undefined
            ? { domain, normalizedDomain: domain }
            : {}),
          ...(input.website !== undefined
            ? { website: input.website || null }
            : {}),
          ...(input.industry !== undefined
            ? { industry: input.industry || null }
            : {}),
          ...(input.description !== undefined
            ? { description: input.description || null }
            : {}),
          ...(input.country !== undefined
            ? { country: input.country || null }
            : {}),
          ...(input.city !== undefined ? { city: input.city || null } : {}),
          ...(input.state !== undefined ? { state: input.state || null } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.source !== undefined ? { source: input.source } : {}),
          ...(input.linkedInUrl !== undefined
            ? { linkedInUrl: input.linkedInUrl || null }
            : {}),
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("Unique constraint") || msg.includes("unique")) {
        throw new ValidationError(
          "A company with this domain already exists in your organization"
        );
      }
      throw err;
    }
  }

  /**
   * Org-scoped find-or-create. Domain match preferred, then name.
   * Never trusts client organizationId — caller must pass membership org.
   */
  async findOrCreate(
    organizationId: string,
    name: string,
    data?: Partial<CompanyWriteInput>
  ) {
    const domain =
      normalizeDomain(data?.domain) || extractDomain(data?.website);

    if (domain) {
      const byDomain = await prisma.company.findFirst({
        where: {
          organizationId,
          deletedAt: null,
          OR: [{ domain }, { normalizedDomain: domain }],
        },
      });
      if (byDomain) {
        return prisma.company.update({
          where: { id: byDomain.id },
          data: {
            normalizedDomain: byDomain.normalizedDomain || domain,
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
            data: {
              domain,
              normalizedDomain: domain,
              website: data?.website ?? existing.website,
            },
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
