import { SignalType, SourceConnectorType } from "@prisma/client";
import { extractDomain } from "@/services/company.service";
import type {
  ConnectorFetchContext,
  NormalizedSignalRecord,
  SourceConnectorAdapter,
} from "@/lib/connectors/types";

/**
 * CSV / CRM import — customer-provided rows.
 * params.rows: array of objects OR params.csvText: string
 */
export const csvCrmConnector: SourceConnectorAdapter = {
  type: SourceConnectorType.CSV_CRM,
  provider: "csv_upload",
  displayName: "CSV / CRM Import Connector",
  description:
    "Import customer-provided company/contact/opportunity rows as normalized signals.",

  async validate(ctx) {
    const rows = ctx.params?.rows;
    const csvText = ctx.params?.csvText;
    if ((!rows || !Array.isArray(rows) || rows.length === 0) && !csvText) {
      return { ok: false, message: "Provide params.rows or params.csvText" };
    }
    return { ok: true };
  },

  async fetch(ctx: ConnectorFetchContext) {
    if (Array.isArray(ctx.params?.rows)) {
      return { rawRecords: ctx.params!.rows as unknown[] };
    }
    const csvText = String(ctx.params?.csvText || "");
    const lines = csvText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) return { rawRecords: [] };

    const headers = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
    const records = lines.slice(1).map((line) => {
      const cols = splitCsvLine(line);
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => {
        obj[h] = cols[i] ?? "";
      });
      return obj;
    });

    return { rawRecords: records, metadata: { format: "csv" } };
  },

  normalize(raw): NormalizedSignalRecord | null {
    const r = raw as Record<string, string>;
    const companyName =
      r.company_name || r.company || r.organization || r.name;
    if (!companyName) return null;

    const website = r.website || r.company_website || r.domain || "";
    const email = r.email || r.contact_email || "";
    const title =
      r.signal_title ||
      r.opportunity ||
      r.job_title ||
      r.title ||
      "Imported CRM record";
    const signalType = mapSignalType(r.signal_type || r.type);

    return {
      signalType,
      title,
      description: r.description || r.notes || null,
      evidenceUrl: r.url || r.evidence_url || null,
      confidence: Number(r.confidence || 70),
      externalId: r.external_id || r.id || `${companyName}:${email}:${title}`,
      company: {
        name: companyName,
        website: website || null,
        domain: extractDomain(website) || (r.domain ? r.domain.toLowerCase() : null),
        industry: r.industry || null,
        country: r.country || null,
        city: r.city || null,
        description: r.company_description || null,
      },
      contact:
        r.first_name || email
          ? {
              firstName: r.first_name || r.firstname || "Contact",
              lastName: r.last_name || r.lastname || "Unknown",
              email: email || null,
              title: r.job_title || r.contact_title || null,
              phone: r.phone || null,
              linkedInUrl: r.linkedin || r.linkedin_url || null,
            }
          : null,
      whyNow: r.why_now || `Imported from CRM/CSV: ${title}`,
      likelyProblem: r.likely_problem || r.notes || null,
      recommendedAction: r.recommended_action || "Review imported record and assign owner",
      estimatedValue: r.estimated_value ? Number(r.estimated_value) : null,
      rawData: { csv: r },
    };
  },
};

function mapSignalType(value: string): SignalType {
  const v = (value || "").toUpperCase();
  if (v in SignalType) return v as SignalType;
  if (v.includes("FUND")) return SignalType.FUNDING;
  if (v.includes("HIR") || v.includes("JOB")) return SignalType.HIRING;
  if (v.includes("RFP")) return SignalType.RFP;
  if (v.includes("TEND")) return SignalType.TENDER;
  return SignalType.CRM_ACTIVITY;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}
