"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";
import { EmailPreview } from "@/components/email/email-preview";

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
  const [previewing, setPreviewing] = useState<string | null>(null);
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
      <div className="card">
        <div className="card-body" style={{ textAlign: "center" }}>
          <div className="cell-main">No draft pitches</div>
          <p className="muted" style={{ margin: "4px 0 14px" }}>
            Draft pitches appear here for approve / edit / reject before
            anything is sent. They are written after a company is audited.
          </p>
          <Link href="/dashboard/autopilot?tab=audit" className="btn">
            Open Audit
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="toolbar" style={{ marginBottom: 0 }}>
        <button
          type="button"
          className="btn"
          onClick={() =>
            setSelected(
              selected.size === allIds.length ? new Set() : new Set(allIds)
            )
          }
        >
          {selected.size === allIds.length ? "Clear selection" : "Select all"}
        </button>
        <button
          type="button"
          className="btn primary"
          disabled={!selected.size || busy === "bulk"}
          onClick={bulkApprove}
        >
          {busy === "bulk" ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Check />
          )}
          Bulk approve ({selected.size})
        </button>
      </div>

      {pitches.map((p) => {
        const issues = issuesFromFindings(p.findings);
        const isEdit = editing === p.id;
        const isPreview = previewing === p.id;
        const noticed = issues[0] || p.topIssue;
        const evidence = [
          ...issues.slice(1),
          p.pageSpeedMobile != null
            ? `mobile speed ${p.pageSpeedMobile}/100`
            : null,
        ].filter(Boolean);

        return (
          <div className="card" key={p.id}>
            <div className="card-head">
              <input
                type="checkbox"
                className="chk-input"
                aria-label={`Select ${p.company.name}`}
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
              <div>
                <div className="card-title">
                  <Link href={`/dashboard/companies/${p.company.id}`}>
                    {p.company.name}
                  </Link>
                </div>
                <div className="card-sub">
                  To {p.contact.fullName}
                  {p.contact.email ? ` · ${p.contact.email}` : ""}
                  {p.contact.title ? ` · ${p.contact.title}` : ""}
                  {p.company.city ? ` · ${p.company.city}` : ""}
                </div>
              </div>
              <span className="badge warn" style={{ marginLeft: "auto" }}>
                Waiting approval
              </span>
            </div>
            <div className="card-body">
              {noticed ? (
                <>
                  <div className="cell-sub" style={{ marginBottom: 6 }}>
                    WHAT WE NOTICED
                  </div>
                  <div className="cell-main">{noticed}</div>
                </>
              ) : null}
              {evidence.length > 0 ? (
                <p className="muted" style={{ margin: "6px 0 14px" }}>
                  Evidence: {evidence.join(" · ")}
                </p>
              ) : (
                <div style={{ height: 14 }} />
              )}

              {isEdit ? (
                <div className="stack" style={{ gap: 8 }}>
                  <div className="field area">
                    <textarea
                      value={editFirst}
                      onChange={(e) => setEditFirst(e.target.value)}
                      rows={2}
                    />
                  </div>
                  <div className="field area">
                    <textarea
                      value={editPitch}
                      onChange={(e) => setEditPitch(e.target.value)}
                      rows={4}
                    />
                  </div>
                  <div className="toolbar" style={{ marginBottom: 0 }}>
                    <button
                      type="button"
                      className="btn primary"
                      disabled={busy === `edit:${p.id}`}
                      onClick={() =>
                        act(p.id, "edit", {
                          personalizedFirstLine: editFirst,
                          shortPitch: editPitch,
                        })
                      }
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => setEditing(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="field area" style={{ display: "block" }}>
                    <div style={{ color: "var(--dx-text)", fontWeight: 600 }}>
                      {p.personalizedFirstLine}
                    </div>
                    <div style={{ whiteSpace: "pre-wrap", marginTop: 6 }}>
                      {p.shortPitch}
                    </div>
                  </div>
                  {p.recommendedService ? (
                    <p className="cell-sub" style={{ marginTop: 8 }}>
                      Recommended: {p.recommendedService}
                      {p.confidence != null
                        ? ` · confidence ${p.confidence}`
                        : ""}
                    </p>
                  ) : null}
                </>
              )}

              {isPreview ? (
                <div style={{ marginTop: 14 }}>
                  <EmailPreview pitchId={p.id} />
                </div>
              ) : null}

              {!isEdit ? (
                <div className="toolbar mt" style={{ marginBottom: 0 }}>
                  <button
                    type="button"
                    className="btn primary"
                    disabled={Boolean(busy)}
                    onClick={() => act(p.id, "approve")}
                  >
                    <Check />
                    Approve
                  </button>
                  <button
                    type="button"
                    className="btn"
                    disabled={Boolean(busy)}
                    onClick={() => {
                      setEditing(p.id);
                      setEditFirst(p.personalizedFirstLine);
                      setEditPitch(p.shortPitch);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setPreviewing(isPreview ? null : p.id)}
                  >
                    {isPreview ? "Hide preview" : "Preview email"}
                  </button>
                  <button
                    type="button"
                    className="btn"
                    disabled={Boolean(busy)}
                    onClick={() => act(p.id, "regenerate")}
                  >
                    Regenerate
                  </button>
                  <span style={{ flex: 1 }} />
                  <button
                    type="button"
                    className="btn"
                    disabled={Boolean(busy)}
                    onClick={() => act(p.id, "reject")}
                  >
                    Reject
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
