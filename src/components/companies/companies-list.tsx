"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface CompanyRow {
  id: string;
  name: string;
  domain: string | null;
  status: string;
  industry: string | null;
  _count: { contacts: number; opportunities: number; signals: number };
  signals: { id: string; title: string; detectedAt: string }[];
  opportunities: { id: string; stage: string; updatedAt: string }[];
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
    filters: { search: string; page: number };
  };
}

export function CompaniesList({ initialData }: CompaniesListProps) {
  const router = useRouter();
  const [search, setSearch] = useState(initialData.filters.search);
  const { items, pagination } = initialData;

  function applyFilters() {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    router.push(`/dashboard/companies?${params.toString()}`);
  }

  function goToPage(page: number) {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    params.set("page", String(page));
    router.push(`/dashboard/companies?${params.toString()}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search companies or domains…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
          />
        </div>
        <Button onClick={applyFilters}>Search</Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Domain</TableHead>
              <TableHead>Contacts</TableHead>
              <TableHead>Opportunities</TableHead>
              <TableHead>Latest signal</TableHead>
              <TableHead>Latest opportunity</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-24 text-center text-muted-foreground"
                >
                  No companies found
                </TableCell>
              </TableRow>
            ) : (
              items.map((company) => {
                const latestSignal = company.signals[0];
                const latestOpp = company.opportunities[0];
                return (
                  <TableRow key={company.id}>
                    <TableCell>
                      <Link
                        href={`/dashboard/companies/${company.id}`}
                        className="font-medium hover:underline"
                      >
                        {company.name}
                      </Link>
                      {company.industry ? (
                        <div className="text-xs text-muted-foreground">
                          {company.industry}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {company.domain || "—"}
                    </TableCell>
                    <TableCell>{company._count.contacts}</TableCell>
                    <TableCell>{company._count.opportunities}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm">
                      {latestSignal ? (
                        <span title={latestSignal.title}>
                          {latestSignal.title}
                          <span className="block text-xs text-muted-foreground">
                            {format(
                              new Date(latestSignal.detectedAt),
                              "MMM d, yyyy"
                            )}
                          </span>
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {latestOpp ? (
                        <Link
                          href={`/dashboard/opportunities/${latestOpp.id}`}
                          className="hover:underline"
                        >
                          {latestOpp.stage}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{company.status}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages} ·{" "}
            {pagination.total} companies
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
