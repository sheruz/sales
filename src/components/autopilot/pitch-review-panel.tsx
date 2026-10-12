"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/crm/empty-state";

type PitchRow = {
  id: string;
  personalizedFirstLine: string;
  shortPitch: string;
  topIssue: string | null;
  recommendedService: string | null;
  confidence: number | null;
  company: { id: string; name: string; city: string | null };
  contact: {
    id: string;
    firstName: string;
    fullName: string;
    email: string | null;
    title: string | null;
  };
  findings: unknown;
  pageSpeedMobile: number | null;
};

type Props = {
  initial: { pitches: PitchRow[] };
};

function issuesFromFindings(findings: unknown): string[] {
  if (!findings || typeof findings !== "object") return [];
  const top = (findings as { top_issues?: Array<{ issue?: string }> })
    .top_issues;
  if (!Array.isArray(top)) return [];
  return top.map((t) => t.issue || "").filter(Boolean).slice(0, 3);
}

export function PitchReviewPanel({ initial }: Props) {
  const router = useRouter();
  const [pitches, setPitches] = useState(initial.pitches);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editFirst, setEditFirst] = useState("");
  const [editPitch, setEditPitch] = useState("");

  const allIds = useMemo(() => pitches.map((p) => p.id), [pitches]);

  async function act(
    id: string,
    action: "approve" | "reject" | "edit" | "regenerate",
    body?: Record<string, string>
  ) {
    setBusy(`${action}:${id}`);
    try {
      const res = await fetch(`/api/autopilot/pitches/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...body }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      if (action === "approve" || action === "reject" || action === "regenerate") {
        setPitches((prev) => prev.filter((p) => p.id !== id));
        setSelected((prev) => {
          const n = new Set(prev);
          n.delete(id);
          return n;
        });
      }
      if (action === "edit") {
        setPitches((prev) =>
          prev.map((p) =>
            p.id === id
              ? {
                  ...p,
                  personalizedFirstLine:
                    body?.personalizedFirstLine || p.personalizedFirstLine,
                  shortPitch: body?.shortPitch || p.shortPitch,
                }
              : p
          )
        );
        setEditing(null);
      }
      toast.success(
        action === "approve"
          ? "Approved"
          : action === "reject"
            ? "Rejected"
            : action === "regenerate"
              ? "Regenerating…"
              : "Saved"
      );
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function bulkApprove() {
    const ids = [...selected];
    if (!ids.length) return;
    setBusy("bulk");
    try {
      const res = await fetch("/api/autopilot/pitches/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pitchIds: ids }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      const ok = new Set(
        (json.data.results as Array<{ id: string; ok: boolean }>)
          .filter((r) => r.ok)
          .map((r) => r.id)
      );
      setPitches((prev) => prev.filter((p) => !ok.has(p.id)));
      setSelected(new Set());
      toast.success(`Approved ${ok.size}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk failed");
    } finally {
      setBusy(null);
    }
  }

  if (pitches.length === 0) {
    return (
      <EmptyState
        title="No draft pitches"
        description="Run Audit now on enriched companies. Draft pitches appear here for approve / edit / reject before Phase 4 sends."
        actionHref="/dashboard/autopilot?tab=audit"
        actionLabel="Open Audit"
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            setSelected(
              selected.size === allIds.length ? new Set() : new Set(allIds)
            )
          }
        >
          {selected.size === allIds.length ? "Clear selection" : "Select all"}
        </Button>
        <Button
          size="sm"
          disabled={!selected.size || busy === "bulk"}
          onClick={bulkApprove}
        >
          {busy === "bulk" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          Bulk approve ({selected.size})
        </Button>
      </div>

      {pitches.map((p) => {
        const issues = issuesFromFindings(p.findings);
        const isEdit = editing === p.id;
        return (
          <Card key={p.id}>
            <CardHeader className="flex flex-row items-start gap-3 space-y-0">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={selected.has(p.id)}
                onChange={(e) => {
                  setSelected((prev) => {
                    const n = new Set(prev);
                    if (e.target.checked) n.add(p.id);
                    else n.delete(p.id);
                    return n;
                  });
                }}
              />
              <div className="min-w-0 flex-1">
                <CardTitle className="text-base">
                  <Link
                    href={`/dashboard/companies/${p.company.id}`}
                    className="hover:underline"
                  >
                    {p.company.name}
                  </Link>
                </CardTitle>
                <CardDescription>
                  {p.contact.fullName}
                  {p.contact.title ? ` · ${p.contact.title}` : ""}
                  {p.contact.email ? ` · ${p.contact.email}` : ""}
                  {p.pageSpeedMobile != null
                    ? ` · Mobile ${p.pageSpeedMobile}`
                    : ""}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {issues.length > 0 ? (
                <ul className="list-disc pl-5 text-muted-foreground">
                  {issues.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              ) : p.topIssue ? (
                <p className="text-muted-foreground">{p.topIssue}</p>
              ) : null}

              {isEdit ? (
                <div className="space-y-2">
                  <Textarea
                    value={editFirst}
                    onChange={(e) => setEditFirst(e.target.value)}
                    rows={2}
                  />
                  <Textarea
                    value={editPitch}
                    onChange={(e) => setEditPitch(e.target.value)}
                    rows={4}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={busy === `edit:${p.id}`}
                      onClick={() =>
                        act(p.id, "edit", {
                          personalizedFirstLine: editFirst,
                          shortPitch: editPitch,
                        })
                      }
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditing(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="font-medium">{p.personalizedFirstLine}</p>
                  <p className="text-muted-foreground whitespace-pre-wrap">
                    {p.shortPitch}
                  </p>
                  {p.recommendedService ? (
                    <p className="text-xs">
                      Recommended: {p.recommendedService}
                      {p.confidence != null ? ` · confidence ${p.confidence}` : ""}
                    </p>
                  ) : null}
                </>
              )}

              {!isEdit ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    size="sm"
                    disabled={Boolean(busy)}
                    onClick={() => act(p.id, "approve")}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={Boolean(busy)}
                    onClick={() => {
                      setEditing(p.id);
                      setEditFirst(p.personalizedFirstLine);
                      setEditPitch(p.shortPitch);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={Boolean(busy)}
                    onClick={() => act(p.id, "reject")}
                  >
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={Boolean(busy)}
                    onClick={() => act(p.id, "regenerate")}
                  >
                    Regenerate
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
