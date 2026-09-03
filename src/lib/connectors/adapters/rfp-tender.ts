import { SignalType, SourceConnectorType } from "@prisma/client";
import { aiComplete, parseAIJson } from "@/lib/ai/provider";
import { extractDomain } from "@/services/company.service";
import type {
  ConnectorFetchContext,
  NormalizedSignalRecord,
  SourceConnectorAdapter,
} from "@/lib/connectors/types";

interface RfpRaw {
  companyName: string;
  companyWebsite?: string;
  country?: string;
  title: string;
  description?: string;
  deadline?: string;
  evidenceUrl?: string;
  type?: "RFP" | "TENDER";
  confidence?: number;
}

/**
 * RFP/Tender connector — only for publicly posted / customer-licensed sources.
 * Default provider uses AI summaries of public tenders; no paywalled scrape.
 */
export const rfpTenderConnector: SourceConnectorAdapter = {
  type: SourceConnectorType.RFP_TENDER,
  provider: "ai_public_rfp",
  displayName: "RFP / Tender Connector",
  description:
    "Ingests publicly available RFP/tender notices where licensing and terms permit. Does not scrape restricted portals.",

  async validate(ctx) {
    if (!ctx.userId) return { ok: false, message: "User required" };
    const acknowledged = Boolean(
      ctx.configuration.complianceAcknowledged ?? ctx.params?.complianceAcknowledged
    );
    if (!acknowledged) {
      return {
        ok: false,
        message:
          "Set configuration.complianceAcknowledged=true to confirm only permitted public sources are used",
      };
    }
    return { ok: true };
  },

  async fetch(ctx: ConnectorFetchContext) {
    const count = Number(ctx.params?.count ?? 3);
    const focus = (ctx.params?.focus as string) || "software development RFPs";

    const result = await aiComplete({
      feature: "rfp_tender_signals",
      userId: ctx.userId,
      jsonMode: true,
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content:
            "Return JSON array of PUBLIC RFP/tender notices only (no private bids). Fields: companyName, companyWebsite, country, title, description, deadline, evidenceUrl, type (RFP|TENDER), confidence.",
        },
        {
          role: "user",
          content: `Up to ${count} public notices related to: ${focus}`,
        },
      ],
    });

    const rows = parseAIJson<RfpRaw[]>(result.content);
    return { rawRecords: Array.isArray(rows) ? rows : [] };
  },

  normalize(raw): NormalizedSignalRecord | null {
    const p = raw as RfpRaw;
    if (!p?.companyName || !p?.title) return null;
    const signalType =
      p.type === "TENDER" ? SignalType.TENDER : SignalType.RFP;

    return {
      signalType,
      title: p.title,
      description: p.description,
      evidenceUrl: p.evidenceUrl,
      confidence: Math.min(90, Math.max(40, p.confidence ?? 55)),
      occurredAt: p.deadline || null,
      externalId: p.evidenceUrl || `${p.companyName}:${p.title}`,
      company: {
        name: p.companyName,
        website: p.companyWebsite,
        domain: extractDomain(p.companyWebsite),
        country: p.country,
      },
      whyNow: `Open ${p.type || "RFP"}: ${p.title}`,
      likelyProblem: p.description || p.title,
      recommendedAction: "Qualify fit and prepare compliant response outreach",
      rawData: { rfp: p },
    };
  },
};
