import { SignalType, SourceConnectorType } from "@prisma/client";
import { aiComplete, parseAIJson } from "@/lib/ai/provider";
import { extractDomain } from "@/services/company.service";
import type {
  ConnectorFetchContext,
  NormalizedSignalRecord,
  SourceConnectorAdapter,
} from "@/lib/connectors/types";

interface FundingRaw {
  companyName: string;
  companyWebsite?: string;
  industry?: string;
  country?: string;
  fundingRound: string;
  amount?: number;
  currency?: string;
  date?: string;
  investors?: string[];
  summary?: string;
  evidenceUrl?: string;
  confidence?: number;
}

export const fundingSignalConnector: SourceConnectorAdapter = {
  type: SourceConnectorType.FUNDING,
  provider: "ai_public_funding",
  displayName: "Funding Signal Connector",
  description:
    "Surfaces public funding-round signals (round, amount, date, investors) where information is publicly discussable.",

  async validate(ctx) {
    if (!ctx.userId) return { ok: false, message: "User required" };
    return { ok: true };
  },

  async fetch(ctx: ConnectorFetchContext) {
    const count = Number(ctx.params?.count ?? 5);
    const focus =
      (ctx.params?.focus as string) ||
      (ctx.configuration.focus as string) ||
      "B2B software startups";

    const result = await aiComplete({
      feature: "funding_signal_discovery",
      userId: ctx.userId,
      jsonMode: true,
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content:
            "Return a JSON array of recent PUBLIC funding signals only. Do not invent private data. Fields: companyName, companyWebsite, industry, country, fundingRound, amount, currency, date, investors[], summary, evidenceUrl, confidence.",
        },
        {
          role: "user",
          content: `Find up to ${count} plausible public funding signals relevant to: ${focus}. Prefer well-known public announcements.`,
        },
      ],
    });

    const rows = parseAIJson<FundingRaw[]>(result.content);
    return { rawRecords: Array.isArray(rows) ? rows : [], metadata: { focus } };
  },

  normalize(raw): NormalizedSignalRecord | null {
    const p = raw as FundingRaw;
    if (!p?.companyName || !p?.fundingRound) return null;
    const domain = extractDomain(p.companyWebsite);
    const title = `${p.fundingRound}${p.amount ? ` — ${p.currency || "USD"} ${p.amount}` : ""}`;

    return {
      signalType: SignalType.FUNDING,
      title,
      description: p.summary,
      evidenceUrl: p.evidenceUrl,
      evidenceText: (p.investors || []).join(", "),
      confidence: Math.min(90, Math.max(40, p.confidence ?? 55)),
      occurredAt: p.date || null,
      externalId: `${p.companyName}:${p.fundingRound}:${p.date || ""}`,
      company: {
        name: p.companyName,
        website: p.companyWebsite,
        domain,
        industry: p.industry,
        country: p.country,
        description: p.summary,
      },
      whyNow: `Recent ${p.fundingRound} funding`,
      likelyProblem: "Growth capital often drives hiring and vendor spend",
      recommendedAction: "Map decision makers and align offer to post-funding priorities",
      estimatedValue: p.amount ? Math.round(p.amount * 0.02) : null,
      rawData: {
        funding: {
          round: p.fundingRound,
          amount: p.amount,
          date: p.date,
          investors: p.investors ?? [],
        },
      },
    };
  },
};
