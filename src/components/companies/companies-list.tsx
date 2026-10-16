"use client";
import { appHome } from "@/lib/app-paths";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { MapPin, Search } from "lucide-react";
import { toast } from "sonner";
import { displayContactName } from "@/lib/crm/display-name";
import {
  funnelStageLabel,
  type FunnelStageKey,
} from "@/lib/crm/funnel-stage";

interface CompanyRow {
  id: string;
  name: string;
  domain: string | null;
  city: string | null;
  country: string | null;
  source: string | null;
  crawlStatus: string | null;
  enrichmentStatus: string | null;
  createdAt: string;
  funnelStage: FunnelStageKey;
  _count: { contacts: number; opportunities: number; emails: number };
  bestContact: {
    id: string;
    fullName: string;
    email: string | null;
    emailStatus: string | null;
    title: string | null;
  } | null;
}

interface CompaniesListProps {
  initialData: {
    items: CompanyRow[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
    filters: {
      search: string;
      page: number;
      source?: string;
      city?: string;
      crawlStatus?: string;
      enrichmentStatus?: string;
      funnel?: string;
      sort?: string;
    };
  };
}

type BadgeTone = "ok" | "warn" | "bad" | "info" | "brand" | "plain" | "";

function stageBadge(c: CompanyRow): { tone: BadgeTone; label: string } {
  const stage = c.funnelStage;
  const emailStatus = c.bestContact?.emailStatus?.toLowerCase();

  if (stage === "won" || stage === "meeting" || stage === "replied") {
    return { tone: "ok", label: funnelStageLabel(stage) };
  }
  if (stage === "contacted") {
    return { tone: "brand", label: funnelStageLabel(stage) };
  }
  if (c.enrichmentStatus === "SKIPPED") {
    return { tone: "plain", label: "Skipped" };
  }
  if (emailStatus === "invalid") {
    return { tone: "bad", label: "Bad email" };
  }
  if (c.enrichmentStatus === "NO_CONTACT" || c.enrichmentStatus === "FAILED") {
    return { tone: "bad", label: "No contact" };
  }
  if (stage === "audited") {
    return { tone: "warn", label: "Pitch ready" };
  }
  if (stage === "enriched") {
    return { tone: "info", label: funnelStageLabel(stage) };
  }
  if (stage === "crawled") {
    return { tone: "", label: "Finding contact" };
  }
  return { tone: "", label: funnelStageLabel(stage) };
}

function verification(status: string | null | undefined): {
  label: string;
  color: string;
} {
  switch (status?.toLowerCase()) {
    case "valid":
      return { label: "verified", color: "var(--dx-ok)" };
    case "invalid":
      return { label: "invalid", color: "var(--dx-bad)" };
    case "accept_all":
      return { label: "risky", color: "var(--dx-warn)" };
    default:
      return { label: "unverified", color: "var(--dx-text-3)" };
  }
}

function sourceLabel(source: string | null): string {
  if (!source) return "—";
  if (source === "google_places") return "Google Maps";
  if (source === "hunter") return "Hunter";
  if (source === "website_crawl") return "Website";
  return source;
}

export function CompaniesList({ initialData }: CompaniesListProps) {
  const router = useRouter();
  const [search, setSearch] = useState(initialData.filters.search);
  const [city, setCity] = useState(initialData.filters.city || "");
  const [source, setSource] = useState(initialData.filters.source || "all");
  const [funnel, setFunnel] = useState(initialData.filters.funnel || "all");
  const [enrichmentStatus, setEnrichmentStatus] = useState(
    initialData.filters.enrichmentStatus || "all"
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const { items, pagination, filters } = initialData;

  function buildUrl(overrides: Record<string, string | number | undefined>) {
    const params = new URLSearchParams();
    const s = overrides.search ?? search;
    const f = overrides.funnel ?? funnel;
    const src = overrides.source ?? source;
    const enr = overrides.enrichmentStatus ?? enrichmentStatus;
    const ct = overrides.city ?? city;
    const page = overrides.page ?? filters.page;
    if (s) params.set("search", String(s));
    if (ct) params.set("city", String(ct));
    if (f && f !== "all") params.set("funnel", String(f));
    if (src && src !== "all") params.set("source", String(src));
    if (enr && enr !== "all") params.set("enrichmentStatus", String(enr));
    if (page && Number(page) > 1) params.set("page", String(page));
    const qs = params.toString();
    return qs ? appHome(`/companies?${qs}`) : appHome("/companies");
  }

  function applyFilters(overrides: Record<string, string | number | undefined> = {}) {
    router.push(buildUrl({ page: 1, ...overrides }));
  }

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(items.map((i) => i.id)) : new Set());
  }

  function toggleOne(id: string, checked: boolean) {
    const next = new Set(selected);
    if (checked) next.add(id);
    else next.delete(id);
    setSelected(next);
  }

  async function runBulk(action: "crawl" | "enrich" | "skip" | "unskip") {
    if (!selected.size) {
      toast.error("Select at least one company");
      return;
    }
    const spend =
      action === "enrich"
        ? "This uses Hunter credits. Continue?"
        : action === "crawl"
          ? "Crawl selected company websites now?"
          : action === "skip"
            ? "Skip enrichment for selected companies?"
            : "Move selected companies back to enrichment queue?";
    if (!window.confirm(spend)) return;

    setBusy(true);
    try {
      const res = await fetch("/api/companies/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          companyIds: [...selected],
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      const ok = (json.data.results as Array<{ ok: boolean }>).filter(
        (r) => r.ok
      ).length;
      toast.success(`${action}: ${ok}/${selected.size} succeeded`);
      setSelected(new Set());
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk action failed");
    } finally {
      setBusy(false);
    }
  }

  const from =
    pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const to = Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <>
      <div className="toolbar">
        <label className="input" style={{ flex: 1, minWidth: 200 }}>
          <Search width={15} height={15} />
          <input
            placeholder="Search name or website"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
          />
        </label>
        <label className="select">
          Stage:
          <select
            value={funnel}
            onChange={(e) => {
              setFunnel(e.target.value);
              applyFilters({ funnel: e.target.value });
            }}
          >
            <option value="all">All</option>
            <option value="found">Found</option>
            <option value="crawled">Crawled</option>
            <option value="enriched">Enriched</option>
            <option value="audited">Audited</option>
            <option value="audited_today">Audited today</option>
            <option value="audit_pending">Audit pending</option>
          </select>
        </label>
        <label className="input" style={{ width: 160 }}>
          <MapPin width={15} height={15} />
          <input
            placeholder="City"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
          />
        </label>
        <label className="select hide-sm">
          Source:
          <select
            value={source}
            onChange={(e) => {
              setSource(e.target.value);
              applyFilters({ source: e.target.value });
            }}
          >
            <option value="all">All</option>
            <option value="google_places">Google Maps</option>
          </select>
        </label>
        <label className="select hide-sm">
          Enrichment:
          <select
            value={enrichmentStatus}
            onChange={(e) => {
              setEnrichmentStatus(e.target.value);
              applyFilters({ enrichmentStatus: e.target.value });
            }}
          >
            <option value="all">Any</option>
            <option value="PENDING">Pending</option>
            <option value="ENRICHED">Enriched</option>
            <option value="SKIPPED">Skipped</option>
            <option value="FAILED">Failed</option>
            <option value="NO_CONTACT">No contact</option>
          </select>
        </label>
        <button type="button" className="btn" onClick={() => applyFilters()}>
          Apply
        </button>
      </div>

      {selected.size > 0 ? (
        <div className="toolbar">
          <span className="muted">{selected.size} selected</span>
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => runBulk("crawl")}
          >
            Crawl now
          </button>
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => runBulk("enrich")}
          >
            Enrich now
          </button>
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => runBulk("skip")}
          >
            Skip
          </button>
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => runBulk("unskip")}
          >
            Unskip
          </button>
        </div>
      ) : null}

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ width: 36 }}>
                <input
                  type="checkbox"
                  className="chk-input"
                  aria-label="Select all"
                  checked={items.length > 0 && selected.size === items.length}
                  onChange={(e) => toggleAll(e.target.checked)}
                />
              </th>
              <th>Company</th>
              <th>Stage</th>
              <th>Best contact</th>
              <th className="hide-sm">Location</th>
              <th className="hide-sm">Source</th>
              <th className="hide-sm">Found</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={7} className="muted" style={{ textAlign: "center", padding: 32 }}>
                  No companies yet. Run Autopilot → Sourcing → Run now after
                  connecting Google Places and setting an ICP.
                </td>
              </tr>
            ) : (
              items.map((c) => {
                const best = c.bestContact
                  ? displayContactName(c.bestContact.fullName, c.bestContact.email)
                  : null;
                const v = verification(c.bestContact?.emailStatus);
                const stage = stageBadge(c);
                const location = [c.city, c.country].filter(Boolean).join(", ");
                return (
                  <tr key={c.id}>
                    <td>
                      <input
                        type="checkbox"
                        className="chk-input"
                        checked={selected.has(c.id)}
                        onChange={(e) => toggleOne(c.id, e.target.checked)}
                        aria-label={`Select ${c.name}`}
                      />
                    </td>
                    <td>
                      <Link
                        href={appHome(`/companies/${c.id}`)}
                        className="cell-main"
                      >
                        {c.name}
                      </Link>
                      {c.domain ? <div className="cell-sub">{c.domain}</div> : null}
                    </td>
                    <td>
                      <span className={`badge ${stage.tone}`.trim()}>
                        {stage.label}
                      </span>
                    </td>
                    <td>
                      {best && c.bestContact ? (
                        <>
                          <div>{best.label}</div>
                          <div className="cell-sub">
                            {c.bestContact.email ? `${c.bestContact.email} · ` : ""}
                            <span style={{ color: v.color }}>{v.label}</span>
                          </div>
                        </>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td className="hide-sm">{location || "—"}</td>
                    <td className="hide-sm">{sourceLabel(c.source)}</td>
                    <td className="hide-sm muted">
                      {format(new Date(c.createdAt), "MMM d")}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="toolbar mt">
        <span className="muted">
          Showing {from}–{to} of {pagination.total}
        </span>
        <span style={{ flex: 1 }} />
        <button
          type="button"
          className="btn"
          disabled={pagination.page <= 1}
          onClick={() => router.push(buildUrl({ page: pagination.page - 1 }))}
        >
          Previous
        </button>
        <button
          type="button"
          className="btn"
          disabled={pagination.page >= pagination.totalPages}
          onClick={() => router.push(buildUrl({ page: pagination.page + 1 }))}
        >
          Next
        </button>
      </div>
    </>
  );
}
