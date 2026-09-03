import { SignalType, SourceConnectorType } from "@prisma/client";
import { aiComplete, parseAIJson } from "@/lib/ai/provider";
import { extractDomain } from "@/services/company.service";
import type {
  ConnectorFetchContext,
  NormalizedSignalRecord,
  SourceConnectorAdapter,
} from "@/lib/connectors/types";

interface WebRaw {
  companyName: string;
  companyWebsite?: string;
  industry?: string;
  country?: string;
  changeType: string;
  title: string;
  summary: string;
  technologies?: string[];
  evidenceUrl?: string;
  confidence?: number;
}

export const webResearchConnector: SourceConnectorAdapter = {
  type: SourceConnectorType.WEB_RESEARCH,
  provider: "ai_web_research",
  displayName: "Web / Company Research Connector",
  description:
    "Detects public company changes: products, tech stack, expansion, and other relevant public information.",

  async validate(ctx) {
    if (!ctx.userId) return { ok: false, message: "User required" };
    return { ok: true };
  },

  async fetch(ctx: ConnectorFetchContext) {
    const count = Number(ctx.params?.count ?? 5);
    const companies =
      (ctx.params?.companies as string[]) ||
      (ctx.configuration.companies as string[]) ||
      [];
    const focus =
      companies.length > 0
        ? `these companies: ${companies.join(", ")}`
        : ((ctx.params?.focus as string) || "B2B SaaS companies expanding");

    const result = await aiComplete({
      feature: "web_research_signals",
      operation: "web_research_signals",
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      jsonMode: true,
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content:
            "Return JSON array of PUBLIC company-change signals only. Fields: companyName, companyWebsite, industry, country, changeType (product|technology|expansion|other), title, summary, technologies[], evidenceUrl, confidence.",
        },
        {
          role: "user",
          content: `Produce up to ${count} research signals for ${focus}.`,
        },
      ],
    });

    const rows = parseAIJson<WebRaw[]>(result.content);
    return { rawRecords: Array.isArray(rows) ? rows : [] };
  },

  normalize(raw): NormalizedSignalRecord | null {
    const p = raw as WebRaw;
    if (!p?.companyName || !p?.title) return null;
    const typeMap: Record<string, SignalType> = {
      product: SignalType.PRODUCT_LAUNCH,
      technology: SignalType.TECHNOLOGY_CHANGE,
      expansion: SignalType.EXPANSION,
      other: SignalType.WEBSITE_CHANGE,
    };
    const signalType =
      typeMap[(p.changeType || "other").toLowerCase()] || SignalType.NEWS;

    return {
      signalType,
      title: p.title,
      description: p.summary,
      evidenceUrl: p.evidenceUrl,
      confidence: Math.min(85, Math.max(35, p.confidence ?? 50)),
      externalId: `${p.companyName}:${p.title}`,
      company: {
        name: p.companyName,
        website: p.companyWebsite,
        domain: extractDomain(p.companyWebsite),
        industry: p.industry,
        country: p.country,
        description: p.summary,
        technologies: p.technologies ?? [],
      },
      whyNow: p.title,
      likelyProblem: p.summary,
      recommendedAction: "Review public change and tailor outreach",
      rawData: { web: p },
    };
  },
};
