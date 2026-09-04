import { SignalType, SourceConnectorType } from "@prisma/client";
import { extractDomain } from "@/services/company.service";
import type {
  ConnectorFetchContext,
  NormalizedSignalRecord,
  SourceConnectorAdapter,
} from "@/lib/connectors/types";
import {
  asRecord,
  hasOfficialCreds,
  num,
  recordsFromParams,
  str,
} from "@/lib/connectors/adapters/shared";

/**
 * Website visitors — customer pixel/webhook or licensed reverse-IP / intent providers.
 * Only where legally and technically permitted (consent + contract).
 */
export const websiteVisitorsConnector: SourceConnectorAdapter = {
  type: SourceConnectorType.WEBSITE_VISITORS,
  provider: "visitor_webhook",
  displayName: "Website Visitors (Pixel / Licensed Reveal)",
  description:
    "Capture visitor company, page, frequency, and intent from your first-party pixel/webhook or a licensed identity provider. Requires lawful basis (consent/contract).",

  async validate(ctx) {
    if (recordsFromParams(ctx)) return { ok: true };
    if (hasOfficialCreds(ctx.credentials, ["webhookSecret", "apiKey"])) {
      return { ok: true };
    }
    return {
      ok: false,
      message:
        "Provide webhookSecret/apiKey for ingest, or params.events/records from a licensed visitor provider.",
    };
  },

  async fetch(ctx: ConnectorFetchContext) {
    const fromParams = recordsFromParams(ctx);
    if (fromParams) {
      return {
        rawRecords: fromParams,
        metadata: { mode: "pixel_or_licensed_events" },
      };
    }
    return {
      rawRecords: [],
      metadata: {
        note: "Push visitor events via /api/webhooks/website-visitors or pass params.events on run.",
      },
    };
  },

  normalize(raw): NormalizedSignalRecord | null {
    const r = asRecord(raw);
    if (!r) return null;

    const companyName = str(
      r.companyName ||
        r.company_name ||
        r.company ||
        (r.company as Record<string, unknown> | undefined)?.name
    );
    const domain = str(
      r.domain ||
        r.companyDomain ||
        (r.company as Record<string, unknown> | undefined)?.domain
    );
    if (!companyName && !domain) return null;

    const name = companyName || domain;
    const page = str(r.page || r.pageUrl || r.path || r.url);
    const visits = num(r.frequency || r.visitCount || r.visits, 1);
    const title =
      str(r.title) ||
      (page
        ? `Website visit: ${page} (${visits}x)`
        : `Website visitor: ${name}`);

    return {
      signalType: SignalType.WEBSITE_VISIT,
      title,
      description:
        str(r.description) ||
        [
          page ? `Page: ${page}` : null,
          `Frequency: ${visits}`,
          str(r.intent || r.intentSignal)
            ? `Intent: ${str(r.intent || r.intentSignal)}`
            : null,
        ]
          .filter(Boolean)
          .join(" · ") || null,
      evidenceUrl: page || str(r.evidenceUrl) || null,
      confidence: Number(r.confidence ?? Math.min(90, 55 + visits * 5)),
      occurredAt: (r.occurredAt || r.timestamp || r.lastSeenAt) as
        | string
        | Date
        | null
        | undefined,
      externalId:
        str(r.externalId || r.visitorId || r.sessionId) ||
        `${domain || name}:${page}:${visits}`,
      company: {
        name,
        domain: domain || extractDomain(str(r.website)) || null,
        website: str(r.website) || (domain ? `https://${domain}` : null),
        industry: str(r.industry) || null,
        country: str(r.country) || null,
      },
      whyNow:
        str(r.whyNow) ||
        `Anonymous/identified website visit intent for ${name}${page ? ` on ${page}` : ""}`,
      likelyProblem: str(r.likelyProblem || r.intent) || null,
      recommendedAction:
        str(r.recommendedAction) ||
        "Follow up on high-intent pages and map to ICP services",
      leadScore: (() => {
        const n = num(r.leadScore || r.intentScore, NaN);
        return Number.isFinite(n) ? n : null;
      })(),
      rawData: { website_visitor: r },
    };
  },
};
