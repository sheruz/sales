import prisma from "@/lib/db/prisma";
import { RevenueGoalStatus, type Prisma } from "@prisma/client";
import { NotFoundError, ValidationError } from "@/lib/api/response";
import { aiComplete, parseAIJson } from "@/lib/ai/provider";
import { businessBrainService } from "@/services/business-brain.service";

export type RevenueGoalInput = {
  name: string;
  targetRevenue: number;
  currency?: string;
  targetDeals?: number | null;
  averageDealValue?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  targetRegions?: string[];
  targetIndustries?: string[];
  targetCompanySizes?: string[];
  targetServices?: string[];
  preferredChannels?: string[];
  strategyDraft?: unknown;
  sourcePrompt?: string | null;
  status?: RevenueGoalStatus;
};

/** Structured strategy from natural language — editable before activation */
export type ParsedRevenueStrategy = {
  name: string;
  targetRevenue: number;
  currency: string;
  timeframe: { startDate: string | null; endDate: string | null; label: string };
  estimatedDealCount: number | null;
  averageDealValue: number | null;
  icp: {
    name: string;
    industries: string[];
    regions: string[];
    countries: string[];
    companySizes: string[];
    decisionMakerTitles: string[];
  };
  service: string | null;
  signals: string[];
  channels: string[];
  summary: string;
};

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export class RevenueGoalService {
  async list(organizationId: string) {
    return prisma.revenueGoal.findMany({
      where: { organizationId },
      orderBy: [{ status: "asc" }, { endDate: "asc" }],
    });
  }

  async getById(organizationId: string, id: string) {
    const goal = await prisma.revenueGoal.findFirst({
      where: { id, organizationId },
    });
    if (!goal) throw new NotFoundError("Revenue goal not found");
    return goal;
  }

  async create(organizationId: string, input: RevenueGoalInput) {
    if (!input.name.trim()) throw new ValidationError("Name is required");
    if (!(input.targetRevenue > 0)) {
      throw new ValidationError("Target revenue must be positive");
    }

    return prisma.revenueGoal.create({
      data: {
        organizationId,
        name: input.name.trim(),
        targetRevenue: input.targetRevenue,
        currency: input.currency ?? "USD",
        targetDeals: input.targetDeals,
        averageDealValue: input.averageDealValue,
        startDate: parseDate(input.startDate),
        endDate: parseDate(input.endDate),
        targetRegions: input.targetRegions ?? [],
        targetIndustries: input.targetIndustries ?? [],
        targetCompanySizes: input.targetCompanySizes ?? [],
        targetServices: input.targetServices ?? [],
        preferredChannels: input.preferredChannels ?? [],
        strategyDraft: input.strategyDraft as Prisma.InputJsonValue | undefined,
        sourcePrompt: input.sourcePrompt,
        status: input.status ?? RevenueGoalStatus.DRAFT,
      },
    });
  }

  async update(
    organizationId: string,
    id: string,
    input: Partial<RevenueGoalInput>
  ) {
    await this.getById(organizationId, id);
    return prisma.revenueGoal.update({
      where: { id },
      data: {
        name: input.name?.trim(),
        targetRevenue: input.targetRevenue,
        currency: input.currency,
        targetDeals: input.targetDeals,
        averageDealValue: input.averageDealValue,
        startDate:
          input.startDate === undefined ? undefined : parseDate(input.startDate),
        endDate:
          input.endDate === undefined ? undefined : parseDate(input.endDate),
        targetRegions: input.targetRegions,
        targetIndustries: input.targetIndustries,
        targetCompanySizes: input.targetCompanySizes,
        targetServices: input.targetServices,
        preferredChannels: input.preferredChannels,
        strategyDraft: input.strategyDraft as Prisma.InputJsonValue | undefined,
        sourcePrompt: input.sourcePrompt,
        status: input.status,
      },
    });
  }

  async activate(organizationId: string, id: string) {
    return this.update(organizationId, id, { status: RevenueGoalStatus.ACTIVE });
  }

  async delete(organizationId: string, id: string) {
    await this.getById(organizationId, id);
    return prisma.revenueGoal.update({
      where: { id },
      data: { status: RevenueGoalStatus.CANCELLED },
    });
  }

  /**
   * Parse natural language into an editable strategy draft.
   * Returns structured fields only — no private reasoning.
   */
  async parseGoalPrompt(
    organizationId: string,
    userId: string,
    prompt: string
  ): Promise<ParsedRevenueStrategy> {
    const text = prompt.trim();
    if (text.length < 10) {
      throw new ValidationError("Describe your revenue goal in more detail");
    }

    const context = await businessBrainService.getSafeContext(organizationId);
    const today = new Date().toISOString().slice(0, 10);

    const result = await aiComplete({
      feature: "revenue_goal_parse",
      userId,
      jsonMode: true,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: `You convert sales revenue goals into structured JSON for a B2B SaaS platform.
Return ONLY valid JSON with this shape:
{
  "name": string,
  "targetRevenue": number,
  "currency": string,
  "timeframe": { "startDate": "YYYY-MM-DD"|null, "endDate": "YYYY-MM-DD"|null, "label": string },
  "estimatedDealCount": number|null,
  "averageDealValue": number|null,
  "icp": {
    "name": string,
    "industries": string[],
    "regions": string[],
    "countries": string[],
    "companySizes": string[],
    "decisionMakerTitles": string[]
  },
  "service": string|null,
  "signals": string[],
  "channels": string[],
  "summary": string
}
Rules:
- Prefer the organization's existing services and ICPs when they fit.
- Do not invent private chain-of-thought; summary must be concise business language.
- Use today's date ${today} when resolving relative timeframes (this quarter, this year, next 90 days).
- currency defaults to USD if unspecified.`,
        },
        {
          role: "user",
          content: JSON.stringify({
            prompt: text,
            businessProfile: context.profile,
            services: context.services.map((s) => s.name),
            icps: context.icps.map((i) => ({
              name: i.name,
              industries: i.industries,
              countries: i.countries,
            })),
            activeGoals: context.activeGoals.map((g) => g.name),
          }),
        },
      ],
    });

    const parsed = parseAIJson<ParsedRevenueStrategy>(result.content);

    if (!parsed.targetRevenue || parsed.targetRevenue <= 0) {
      throw new ValidationError("AI could not determine a target revenue amount");
    }

    return {
      name: parsed.name || "Revenue goal",
      targetRevenue: Number(parsed.targetRevenue),
      currency: parsed.currency || "USD",
      timeframe: {
        startDate: parsed.timeframe?.startDate ?? null,
        endDate: parsed.timeframe?.endDate ?? null,
        label: parsed.timeframe?.label || "Custom",
      },
      estimatedDealCount: parsed.estimatedDealCount ?? null,
      averageDealValue: parsed.averageDealValue ?? null,
      icp: {
        name: parsed.icp?.name || "Target ICP",
        industries: parsed.icp?.industries ?? [],
        regions: parsed.icp?.regions ?? [],
        countries: parsed.icp?.countries ?? [],
        companySizes: parsed.icp?.companySizes ?? [],
        decisionMakerTitles: parsed.icp?.decisionMakerTitles ?? [],
      },
      service: parsed.service ?? null,
      signals: parsed.signals ?? [],
      channels: parsed.channels ?? [],
      summary: parsed.summary || text.slice(0, 280),
    };
  }

  /** Create draft goal (+ optional draft ICP) from parsed strategy */
  async createFromStrategy(
    organizationId: string,
    userId: string,
    strategy: ParsedRevenueStrategy,
    sourcePrompt: string,
    options?: { createIcp?: boolean; activate?: boolean }
  ) {
    void userId;
    let createdIcpId: string | null = null;

    if (options?.createIcp && strategy.icp.name) {
      const { icpService } = await import("@/services/icp.service");
      const icp = await icpService.create(organizationId, {
        name: strategy.icp.name,
        description: strategy.summary,
        industries: strategy.icp.industries,
        countries: strategy.icp.countries,
        regions: strategy.icp.regions,
        companySizes: strategy.icp.companySizes,
        decisionMakerTitles: strategy.icp.decisionMakerTitles,
        buyingSignals: strategy.signals,
        jobSignals: strategy.signals,
      });
      createdIcpId = icp.id;
    }

    const goal = await this.create(organizationId, {
      name: strategy.name,
      targetRevenue: strategy.targetRevenue,
      currency: strategy.currency,
      targetDeals: strategy.estimatedDealCount,
      averageDealValue: strategy.averageDealValue,
      startDate: strategy.timeframe.startDate,
      endDate: strategy.timeframe.endDate,
      targetRegions: [
        ...new Set([...strategy.icp.regions, ...strategy.icp.countries]),
      ],
      targetIndustries: strategy.icp.industries,
      targetCompanySizes: strategy.icp.companySizes,
      targetServices: strategy.service ? [strategy.service] : [],
      preferredChannels: strategy.channels,
      strategyDraft: { ...strategy, createdIcpId },
      sourcePrompt,
      status: options?.activate
        ? RevenueGoalStatus.ACTIVE
        : RevenueGoalStatus.DRAFT,
    });

    return { goal, createdIcpId, strategy };
  }
}

export const revenueGoalService = new RevenueGoalService();
