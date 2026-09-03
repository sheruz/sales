"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { format } from "date-fns";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  OPPORTUNITY_FILTERS,
  OPPORTUNITY_STAGE_LABELS,
  scoreBadgeVariant,
  scoreLabel,
} from "@/lib/constants/opportunities";
import type { OpportunityListFilter } from "@/services/opportunity.service";
import type { OpportunityStage } from "@prisma/client";

export interface OpportunityListRow {
  id: string;
  score: number;
  stage: OpportunityStage;
  whyNow: string | null;
  updatedAt: string;
  company: { id: string; name: string };
  primarySignal: { id: string; title: string } | null;
  owner: { id: string; firstName: string; lastName: string } | null;
}

interface OpportunitiesListClientProps {
  initialData: {
    items: OpportunityListRow[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
    filters: {
      filter: OpportunityListFilter;
      search: string;
      page: number;
    };
  };
}

export function OpportunitiesListClient({
  initialData,
}: OpportunitiesListClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState(initialData.filters.search);
  const { items, pagination, filters } = initialData;

  function buildUrl(overrides: {
    filter?: string;
    search?: string;
    page?: number;
  }) {
    const params = new URLSearchParams();
    const filter = overrides.filter ?? filters.filter;
    const q = overrides.search ?? search;
    const page = overrides.page ?? filters.page;
    if (filter && filter !== "all") params.set("filter", filter);
    if (q) params.set("search", q);
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    return `/dashboard/opportunities${qs ? `?${qs}` : ""}`;
  }

  function setFilter(filter: OpportunityListFilter) {
    router.push(buildUrl({ filter, page: 1 }));
  }

  function applySearch() {
    router.push(buildUrl({ search, page: 1 }));
  }

  function goToPage(page: number) {
    router.push(buildUrl({ page }));
  }

  function ownerName(owner: OpportunityListRow["owner"]) {
    if (!owner) return "—";
    return `${owner.firstName} ${owner.lastName}`.trim() || "—";
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {OPPORTUNITY_FILTERS.map((f) => (
          <Button
            key={f.value}
            variant={filters.filter === f.value ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      <div className="flex gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search company, why now, problem..."
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applySearch()}
          />
        </div>
        <Button variant="secondary" onClick={applySearch}>
          Search
        </Button>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No opportunities match this filter.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead className="hidden md:table-cell">Why now</TableHead>
                  <TableHead className="hidden lg:table-cell">Signal</TableHead>
                  <TableHead className="hidden sm:table-cell">Owner</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id} className="cursor-pointer">
                    <TableCell>
                      <Link
                        href={`/dashboard/opportunities/${item.id}`}
                        className="font-medium hover:underline"
                      >
                        {item.company.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={scoreBadgeVariant(item.score)}>
                        {item.score} · {scoreLabel(item.score)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {OPPORTUNITY_STAGE_LABELS[item.stage] ?? item.stage}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden max-w-[220px] truncate text-muted-foreground md:table-cell">
                      {item.whyNow ?? "—"}
                    </TableCell>
                    <TableCell className="hidden max-w-[180px] truncate text-muted-foreground lg:table-cell">
                      {item.primarySignal?.title ?? "—"}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {ownerName(item.owner)}
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {format(new Date(item.updatedAt), "MMM d, yyyy")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {pagination.page} of {pagination.totalPages} · {pagination.total}{" "}
            total
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => goToPage(pagination.page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => goToPage(pagination.page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
