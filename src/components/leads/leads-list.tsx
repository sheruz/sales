"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LeadScoreCategory, LeadStatus } from "@prisma/client";
import { format } from "date-fns";
import { toast } from "sonner";
import { MoreHorizontal, Plus, Search, Trash2 } from "lucide-react";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LeadStatusBadge } from "@/components/leads/lead-status-badge";
import { ImportCsvDialog } from "@/components/leads/import-csv-dialog";
import { LEAD_STATUS_LABELS, SCORE_CATEGORY_LABELS } from "@/lib/constants/leads";

interface LeadRow {
  id: string;
  fullName: string;
  email: string | null;
  companyName: string | null;
  jobTitle: string | null;
  status: LeadStatus;
  score: number;
  scoreCategory: string | null;
  source: string | null;
  createdAt: string;
  assignedTo: { firstName: string; lastName: string } | null;
}

interface LeadsListProps {
  initialData: {
    leads: LeadRow[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
    filters: { search: string; status: string; score: string; page: number };
  };
}

export function LeadsList({ initialData }: LeadsListProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState(initialData.filters.search);
  const [status, setStatus] = useState(initialData.filters.status);

  const [score, setScore] = useState(initialData.filters.score);

  const { leads, pagination } = initialData;

  function applyFilters() {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status !== "all") params.set("status", status);
    if (score !== "all") params.set("score", score);
    router.push(`/dashboard/leads?${params.toString()}`);
  }

  function goToPage(page: number) {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status !== "all") params.set("status", status);
    if (score !== "all") params.set("score", score);
    params.set("page", String(page));
    router.push(`/dashboard/leads?${params.toString()}`);
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === leads.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(leads.map((l) => l.id)));
    }
  }

  async function bulkDelete() {
    if (!confirm(`Delete ${selected.size} leads?`)) return;
    try {
      const res = await fetch("/api/leads/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: Array.from(selected), action: "delete" }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message);
      toast.success(`Deleted ${selected.size} leads`);
      setSelected(new Set());
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk delete failed");
    }
  }

  async function bulkStatus(newStatus: LeadStatus) {
    try {
      const res = await fetch("/api/leads/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadIds: Array.from(selected),
          action: "updateStatus",
          status: newStatus,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message);
      toast.success("Status updated");
      setSelected(new Set());
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk update failed");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search leads..."
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            />
          </div>
          <Select value={status} onValueChange={(v) => v && setStatus(v)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {Object.values(LeadStatus).map((s) => (
                <SelectItem key={s} value={s}>
                  {LEAD_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={score} onValueChange={(v) => v && setScore(v)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Score" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Scores</SelectItem>
              {Object.values(LeadScoreCategory).map((s) => (
                <SelectItem key={s} value={s}>
                  {SCORE_CATEGORY_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="secondary" onClick={applyFilters}>
            Search
          </Button>
        </div>
        <div className="flex gap-2">
          <ImportCsvDialog />
          <Link href="/dashboard/leads/new">
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Lead
            </Button>
          </Link>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-4 py-2">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <DropdownMenu>
            <DropdownMenuTrigger>
              <Button variant="outline" size="sm">Update Status</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {Object.values(LeadStatus).map((s) => (
                <DropdownMenuItem key={s} onClick={() => bulkStatus(s)}>
                  {LEAD_STATUS_LABELS[s]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="destructive" size="sm" onClick={bulkDelete}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  checked={selected.size === leads.length && leads.length > 0}
                  onChange={toggleAll}
                />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Assigned</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                  No leads found. Add your first lead or import from CSV.
                </TableCell>
              </TableRow>
            ) : (
              leads.map((lead) => (
                <TableRow
                  key={lead.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/dashboard/leads/${lead.id}`)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(lead.id)}
                      onChange={() => toggleSelect(lead.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{lead.fullName}</p>
                      {lead.email && (
                        <p className="text-xs text-muted-foreground">{lead.email}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p>{lead.companyName ?? "—"}</p>
                      {lead.jobTitle && (
                        <p className="text-xs text-muted-foreground">{lead.jobTitle}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <LeadStatusBadge status={lead.status} />
                  </TableCell>
                  <TableCell>
                    {lead.score}
                    {lead.scoreCategory && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({SCORE_CATEGORY_LABELS[lead.scoreCategory as LeadScoreCategory] ?? lead.scoreCategory})
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{lead.source ?? "—"}</TableCell>
                  <TableCell>
                    {lead.assignedTo
                      ? `${lead.assignedTo.firstName} ${lead.assignedTo.lastName}`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(lead.createdAt), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => router.push(`/dashboard/leads/${lead.id}`)}>
                          View
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => router.push(`/dashboard/leads/${lead.id}/edit`)}>
                          Edit
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{pagination.total} leads total</p>
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
