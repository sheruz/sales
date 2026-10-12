"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CrawlStatusBadge,
  EnrichmentStatusBadge,
  FunnelStageBadge,
  SourceBadge,
  VerificationBadge,
} from "@/components/status/status-badge";
import { displayContactName } from "@/lib/crm/display-name";
import type { FunnelStageKey } from "@/lib/crm/funnel-stage";

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

export function CompaniesList({ initialData }: CompaniesListProps) {
  const router = useRouter();
  const [search, setSearch] = useState(initialData.filters.search);
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
    const page = overrides.page ?? filters.page;
    if (s) params.set("search", String(s));
    if (f && f !== "all") params.set("funnel", String(f));
    if (src && src !== "all") params.set("source", String(src));
    if (enr && enr !== "all") params.set("enrichmentStatus", String(enr));
    if (page && Number(page) > 1) params.set("page", String(page));
    return `/dashboard/companies?${params.toString()}`;
  }

  function applyFilters() {
    router.push(buildUrl({ page: 1 }));
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search companies or domains…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
          />
        </div>
        <Select
          value={funnel}
          onValueChange={(v) => setFunnel(v || "all")}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Funnel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stages</SelectItem>
            <SelectItem value="found">Found</SelectItem>
            <SelectItem value="crawled">Crawled</SelectItem>
            <SelectItem value="enriched">Enriched</SelectItem>
            <SelectItem value="audited">Audited</SelectItem>
            <SelectItem value="audited_today">Audited today</SelectItem>
            <SelectItem value="audit_pending">Audit pending</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={source}
          onValueChange={(v) => setSource(v || "all")}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            <SelectItem value="google_places">Google Places</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={enrichmentStatus}
          onValueChange={(v) => setEnrichmentStatus(v || "all")}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Enrichment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any enrichment</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="ENRICHED">Enriched</SelectItem>
            <SelectItem value="SKIPPED">Skipped</SelectItem>
            <SelectItem value="FAILED">Failed</SelectItem>
            <SelectItem value="NO_CONTACT">No contact</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={applyFilters}>Apply</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={busy || !selected.size}
          onClick={() => runBulk("crawl")}
        >
          Crawl now
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy || !selected.size}
          onClick={() => runBulk("enrich")}
        >
          Enrich now
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy || !selected.size}
          onClick={() => runBulk("skip")}
        >
          Skip
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy || !selected.size}
          onClick={() => runBulk("unskip")}
        >
          Unskip
        </Button>
        <span className="text-xs text-muted-foreground self-center">
          {selected.size} selected
        </span>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={
                    items.length > 0 && selected.size === items.length
                  }
                  onChange={(e) => toggleAll(e.target.checked)}
                />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>City / Country</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Crawl</TableHead>
              <TableHead>Enrichment</TableHead>
              <TableHead>Best contact</TableHead>
              <TableHead>Verification</TableHead>
              <TableHead>Emails</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Found</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={11}
                  className="h-24 text-center text-muted-foreground"
                >
                  No companies yet. Run Autopilot → Sourcing → Run now after
                  connecting Google Places and setting an ICP.
                </TableCell>
              </TableRow>
            ) : (
              items.map((c) => {
                const best = c.bestContact
                  ? displayContactName(c.bestContact.fullName, c.bestContact.email)
                  : null;
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selected.has(c.id)}
                        onChange={(e) => toggleOne(c.id, e.target.checked)}
                        aria-label={`Select ${c.name}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/dashboard/companies/${c.id}`}
                        className="font-medium hover:underline"
                      >
                        {c.name}
                      </Link>
                      {c.domain ? (
                        <div className="text-xs text-muted-foreground">
                          {c.domain}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {[c.city, c.country].filter(Boolean).join(", ") || "—"}
                    </TableCell>
                    <TableCell>
                      <FunnelStageBadge stage={c.funnelStage} />
                    </TableCell>
                    <TableCell>
                      <CrawlStatusBadge status={c.crawlStatus} />
                    </TableCell>
                    <TableCell>
                      <EnrichmentStatusBadge status={c.enrichmentStatus} />
                    </TableCell>
                    <TableCell className="text-sm">
                      {best ? best.label : "—"}
                    </TableCell>
                    <TableCell>
                      {c.bestContact?.emailStatus ? (
                        <VerificationBadge status={c.bestContact.emailStatus} />
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>{c._count.emails}</TableCell>
                    <TableCell>
                      <SourceBadge source={c.source} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(c.createdAt), "MMM d, yyyy")}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Page {pagination.page} of {pagination.totalPages} · {pagination.total}{" "}
          companies
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page <= 1}
            onClick={() =>
              router.push(buildUrl({ page: pagination.page - 1 }))
            }
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() =>
              router.push(buildUrl({ page: pagination.page + 1 }))
            }
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
