"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { displayContactName } from "@/lib/crm/display-name";
import {
  deriveCompanyFunnelStage,
  funnelStageLabel,
  type FunnelStageKey,
} from "@/lib/crm/funnel-stage";

interface ContactRow {
  id: string;
  fullName: string;
  title: string | null;
  email: string | null;
  emailStatus: string | null;
  source: string | null;
  company: {
    id: string;
    name: string;
    domain: string | null;
    crawlStatus: string | null;
    enrichmentStatus: string | null;
  };
  opportunityStage: string | null;
}

interface ContactsListProps {
  initialData: {
    items: ContactRow[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
    filters: { search: string; page: number };
  };
}

function stageTone(stage: FunnelStageKey): string {
  if (stage === "won" || stage === "meeting" || stage === "replied") return "ok";
  if (stage === "contacted") return "brand";
  if (stage === "audited") return "warn";
  if (stage === "enriched") return "info";
  return "";
}

function verification(status: string | null | undefined) {
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

export function ContactsList({ initialData }: ContactsListProps) {
  const router = useRouter();
  const [search, setSearch] = useState(initialData.filters.search);
  const { items, pagination } = initialData;

  function applyFilters() {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    const qs = params.toString();
    router.push(qs ? `/dashboard/contacts?${qs}` : "/dashboard/contacts");
  }

  function goToPage(page: number) {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    params.set("page", String(page));
    router.push(`/dashboard/contacts?${params.toString()}`);
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
            placeholder="Search contacts, email, or company"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
          />
        </label>
        <button type="button" className="btn" onClick={applyFilters}>
          Search
        </button>
      </div>

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Contact</th>
              <th>Company</th>
              <th>Email</th>
              <th>Stage</th>
              <th className="hide-sm">Source</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="muted"
                  style={{ textAlign: "center", padding: 32 }}
                >
                  No contacts yet. They appear after Autopilot enrichment finds
                  a decision-maker or website inbox.
                </td>
              </tr>
            ) : (
              items.map((c) => {
                const display = displayContactName(c.fullName, c.email);
                const stage = deriveCompanyFunnelStage({
                  crawlStatus: c.company.crawlStatus as never,
                  enrichmentStatus: c.company.enrichmentStatus as never,
                  opportunityStage: c.opportunityStage as never,
                });
                const v = verification(c.emailStatus);
                return (
                  <tr key={c.id}>
                    <td>
                      <Link
                        href={`/dashboard/contacts/${c.id}`}
                        className="cell-main"
                      >
                        {display.label}
                      </Link>
                      <div className="cell-sub">
                        {display.isGeneralInbox
                          ? "General inbox"
                          : c.title || "—"}
                      </div>
                    </td>
                    <td>
                      <Link href={`/dashboard/companies/${c.company.id}`}>
                        {c.company.name}
                      </Link>
                      {c.company.domain ? (
                        <div className="cell-sub">{c.company.domain}</div>
                      ) : null}
                    </td>
                    <td>
                      {c.email ? (
                        <>
                          <div>{c.email}</div>
                          <div className="cell-sub">
                            <span style={{ color: v.color }}>{v.label}</span>
                          </div>
                        </>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${stageTone(stage)}`.trim()}>
                        {funnelStageLabel(stage)}
                      </span>
                    </td>
                    <td className="hide-sm">{sourceLabel(c.source)}</td>
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
          onClick={() => goToPage(pagination.page - 1)}
        >
          Previous
        </button>
        <button
          type="button"
          className="btn"
          disabled={pagination.page >= pagination.totalPages}
          onClick={() => goToPage(pagination.page + 1)}
        >
          Next
        </button>
      </div>
    </>
  );
}
