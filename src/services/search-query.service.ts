import prisma from "@/lib/db/prisma";
import { SearchQueryStatus } from "@prisma/client";
import { NotFoundError, ValidationError } from "@/lib/api/response";
import { aiComplete, parseAIJson } from "@/lib/ai/provider";
import { icpService } from "@/services/icp.service";
import { businessBrainService } from "@/services/business-brain.service";

export class SearchQueryService {
  async list(organizationId: string) {
    return prisma.searchQuery.findMany({
      where: { organizationId },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    });
  }

  async create(
    organizationId: string,
    input: { query: string; country?: string; city?: string }
  ) {
    const query = input.query.trim();
    if (query.length < 3) throw new ValidationError("Query too short");
    return prisma.searchQuery.create({
      data: {
        organizationId,
        query,
        country: input.country?.trim() || null,
        city: input.city?.trim() || null,
        status: SearchQueryStatus.ACTIVE,
      },
    });
  }

  async update(
    organizationId: string,
    id: string,
    input: Partial<{
      query: string;
      country: string | null;
      city: string | null;
      status: SearchQueryStatus;
    }>
  ) {
    const existing = await prisma.searchQuery.findFirst({
      where: { id, organizationId },
    });
    if (!existing) throw new NotFoundError("Search query not found");

    return prisma.searchQuery.update({
      where: { id },
      data: {
        query: input.query?.trim(),
        country:
          input.country === undefined ? undefined : input.country?.trim() || null,
        city: input.city === undefined ? undefined : input.city?.trim() || null,
        status: input.status,
        ...(input.status === SearchQueryStatus.ACTIVE
          ? { pageToken: existing.pageToken }
          : {}),
      },
    });
  }

  async remove(organizationId: string, id: string) {
    const existing = await prisma.searchQuery.findFirst({
      where: { id, organizationId },
    });
    if (!existing) throw new NotFoundError("Search query not found");
    await prisma.searchQuery.delete({ where: { id } });
  }

  /**
   * Claude generates draft queries from ICP + Business Brain.
   * Creates them as ACTIVE so user can pause/edit before enabling sourcing.
   */
  async generateFromIcp(
    organizationId: string,
    userId: string,
    options?: { maxQueries?: number }
  ) {
    const maxQueries = Math.min(30, Math.max(3, options?.maxQueries ?? 12));
    const [icps, profile] = await Promise.all([
      icpService.list(organizationId, false),
      businessBrainService.getProfile(organizationId).catch(() => null),
    ]);

    if (!icps.length) {
      throw new ValidationError(
        "Define at least one active ICP before generating search queries."
      );
    }

    const icpSummary = icps.map((i) => ({
      name: i.name,
      industries: i.industries,
      countries: i.countries,
      regions: i.regions,
      companySizes: i.companySizes,
      jobSignals: i.jobSignals,
    }));

    const result = await aiComplete({
      organizationId,
      userId,
      feature: "sourcing_query_generation",
      operation: "generate_places_queries",
      temperature: 0.4,
      maxTokens: 1200,
      messages: [
        {
          role: "system",
          content:
            "You generate Google Places text-search queries for B2B lead sourcing. Return JSON only: {\"queries\":[{\"query\":\"real estate agency in Dallas\",\"country\":\"USA\",\"city\":\"Dallas\"}]}. Use business type × city/country. No markdown.",
        },
        {
          role: "user",
          content: JSON.stringify({
            maxQueries,
            company:
              profile && "companyName" in (profile as object)
                ? profile
                : profile,
            icps: icpSummary,
          }),
        },
      ],
    });

    const parsed = parseAIJson<{
      queries?: Array<{ query?: string; country?: string; city?: string }>;
    }>(result.content);

    const drafts = (parsed.queries ?? [])
      .map((q) => ({
        query: (q.query || "").trim(),
        country: q.country?.trim() || null,
        city: q.city?.trim() || null,
      }))
      .filter((q) => q.query.length >= 3)
      .slice(0, maxQueries);

    if (!drafts.length) {
      throw new ValidationError("AI returned no usable search queries");
    }

    const created = [];
    for (const d of drafts) {
      const row = await prisma.searchQuery.create({
        data: {
          organizationId,
          query: d.query,
          country: d.country,
          city: d.city,
          status: SearchQueryStatus.PAUSED,
        },
      });
      created.push(row);
    }
    return created;
  }
}

export const searchQueryService = new SearchQueryService();
