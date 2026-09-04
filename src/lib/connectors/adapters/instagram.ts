import { SignalType, SourceConnectorType } from "@prisma/client";
import { extractDomain } from "@/services/company.service";
import type {
  ConnectorFetchContext,
  NormalizedSignalRecord,
  SourceConnectorAdapter,
} from "@/lib/connectors/types";
import {
  asRecord,
  fetchJson,
  hasOfficialCreds,
  recordsFromParams,
  str,
} from "@/lib/connectors/adapters/shared";

/**
 * Instagram — Meta Graph Instagram Business Account API or licensed/customer data.
 */
export const instagramSignalConnector: SourceConnectorAdapter = {
  type: SourceConnectorType.INSTAGRAM,
  provider: "instagram_graph",
  displayName: "Instagram (Business Graph API)",
  description:
    "Business account media/engagement signals via Instagram Graph API (Meta) where access permits, or licensed/customer-provided records.",

  async validate(ctx) {
    if (recordsFromParams(ctx)) return { ok: true };
    if (hasOfficialCreds(ctx.credentials, ["accessToken"])) return { ok: true };
    return {
      ok: false,
      message:
        "Provide Instagram/Meta accessToken, or params.records from approved data.",
    };
  },

  async fetch(ctx: ConnectorFetchContext) {
    const fromParams = recordsFromParams(ctx);
    if (fromParams) {
      return {
        rawRecords: fromParams,
        metadata: { mode: "customer_or_licensed_payload" },
      };
    }

    const token = ctx.credentials.accessToken;
    const igUserId = str(
      ctx.configuration.instagramBusinessAccountId ||
        ctx.configuration.igUserId ||
        ctx.configuration.pageId
    );
    if (!igUserId) {
      return {
        rawRecords: [],
        metadata: {
          note: "Set configuration.instagramBusinessAccountId, or pass params.records.",
        },
      };
    }

    const result = await fetchJson(
      `https://graph.facebook.com/v21.0/${encodeURIComponent(igUserId)}/media?fields=id,caption,permalink,timestamp,media_type&limit=25&access_token=${encodeURIComponent(token)}`
    );

    if (!result.ok) {
      return {
        rawRecords: [],
        metadata: {
          mode: "instagram_graph",
          apiError: result.error,
          note: "Instagram Graph access denied — check Business account permissions. No scrape fallback.",
        },
      };
    }

    const data = asRecord(result.data);
    const list = Array.isArray(data?.data) ? data!.data : [];
    return {
      rawRecords: list.map((media) => ({
        ...(asRecord(media) || {}),
        companyName: str(
          ctx.configuration.companyName || ctx.configuration.username || igUserId
        ),
        website: str(ctx.configuration.website),
      })),
      metadata: { mode: "instagram_graph_media" },
    };
  },

  normalize(raw): NormalizedSignalRecord | null {
    const r = asRecord(raw);
    if (!r) return null;
    const companyName = str(r.companyName || r.company_name || r.username);
    if (!companyName) return null;
    const caption = str(r.caption || r.description);
    const title = str(r.title) || (caption ? caption.slice(0, 120) : "Instagram business activity");

    return {
      signalType: SignalType.SOCIAL_ACTIVITY,
      title,
      description: caption || null,
      evidenceUrl: str(r.permalink || r.url || r.evidenceUrl) || null,
      confidence: Number(r.confidence ?? 68),
      occurredAt: (r.timestamp || r.occurredAt) as string | Date | null | undefined,
      externalId: str(r.id || r.externalId) || `${companyName}:${title}`,
      company: {
        name: companyName,
        website: str(r.website) || null,
        domain: extractDomain(str(r.website)) || str(r.domain) || null,
      },
      whyNow: str(r.whyNow) || `Instagram business signal for ${companyName}`,
      recommendedAction:
        str(r.recommendedAction) || "Review Instagram engagement for buying intent",
      rawData: { instagram: r },
    };
  },
};
