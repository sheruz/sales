"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Step = { day: 0 | 3 | 7 | 14; subject: string; body: string };

type PowStatus = {
  noUsableFinding: boolean;
  usableFindings: Array<{
    id: string;
    severity: string;
    title: string;
    evidence: string;
    confidence: string;
  }>;
  audit: {
    id: string;
    evidence: Array<{ id: string; kind: string }>;
  } | null;
  pitch: {
    id: string;
    status: string;
    powStaleAt: string | null;
    powDraft: {
      status: string;
      finding: {
        id: string;
        severity: string;
        title: string;
        evidence: string;
        confidence: string;
      } | null;
      steps: Step[];
      validation: {
        ok: boolean;
        errors: string[];
        perStep?: Array<{
          wordCount: number;
          bannedPhrases: string[];
          inventedNumbers: string[];
          ok: boolean;
        }>;
      };
      regenerated: boolean;
    } | null;
  } | null;
};

export function PowPitchReview({ companyId }: { companyId: string }) {
  const [data, setData] = useState<PowStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [editSteps, setEditSteps] = useState<Step[] | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(
      `/api/pow/pitches?companyId=${encodeURIComponent(companyId)}`
    );
    const json = await res.json();
    if (!json.success) return;
    setData(json.data as PowStatus);
    const draft = json.data?.pitch?.powDraft;
    if (draft?.steps) setEditSteps(draft.steps);
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function generate() {
    setBusy("gen");
    try {
      const res = await fetch("/api/pow/pitches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      if (json.data?.status === "no_usable_finding") {
        toast.message("No usable finding");
      } else {
        toast.success("PoW draft generated");
      }
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function action(
    actionName: "approve" | "regenerate" | "edit",
    steps?: Step[]
  ) {
    if (!data?.pitch?.id) return;
    setBusy(actionName);
    try {
      const res = await fetch(`/api/pow/pitches/${data.pitch.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          actionName === "edit"
            ? { action: "edit", steps }
            : { action: actionName }
        ),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      toast.success(
        actionName === "approve"
          ? "Approved (send still blocked until PoW3)"
          : actionName === "regenerate"
            ? "Regenerated"
            : "Saved"
      );
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  const draft = data?.pitch?.powDraft;
  const finding = draft?.finding || data?.usableFindings?.[0];
  const desktop = data?.audit?.evidence?.find((e) =>
    String(e.kind).includes("DESKTOP")
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">Proof of Work draft</CardTitle>
          <CardDescription>
            Plain-text sequence (Day 0 / 3 / 7 / 14). Drafts only — sending is
            disabled until PoW3.
          </CardDescription>
        </div>
        <Button
          size="sm"
          disabled={Boolean(busy)}
          onClick={generate}
        >
          {busy === "gen" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          {data?.pitch ? "Regenerate from audit" : "Generate PoW draft"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {data?.noUsableFinding && !draft ? (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
            <p className="font-medium">No usable finding</p>
            <p className="text-xs text-muted-foreground">
              Need Severity A or B with High confidence from the latest DONE deep
              audit.
            </p>
          </div>
        ) : null}

        {draft?.status === "no_usable_finding" ? (
          <Badge variant="secondary">No usable finding</Badge>
        ) : null}

        {finding || draft ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3 rounded-md border p-3">
              <p className="font-medium">Finding</p>
              {finding ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="destructive">{finding.severity}</Badge>
                    <Badge variant="outline">{finding.confidence}</Badge>
                  </div>
                  <p className="font-medium">{finding.title}</p>
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap break-all">
                    {finding.evidence}
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground">No finding selected</p>
              )}
              {desktop ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/audit-evidence/${desktop.id}`}
                  alt="Evidence screenshot"
                  className="block w-full max-h-40 object-contain object-top rounded border bg-muted"
                />
              ) : null}
            </div>

            <div className="space-y-3 rounded-md border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">Draft emails</p>
                {data?.pitch?.status ? (
                  <Badge variant="outline">{data.pitch.status}</Badge>
                ) : null}
                {draft?.status ? (
                  <Badge variant="secondary">{draft.status}</Badge>
                ) : null}
                {data?.pitch?.powStaleAt ? (
                  <Badge variant="destructive">stale</Badge>
                ) : null}
              </div>

              {draft?.validation ? (
                <div className="text-xs space-y-1 rounded bg-muted/50 p-2">
                  <p>
                    Validator:{" "}
                    {draft.validation.ok ? "passed" : "issues found"}
                    {draft.regenerated ? " · regenerated once" : ""}
                  </p>
                  {(draft.validation.errors || []).slice(0, 6).map((e) => (
                    <p key={e} className="text-destructive">
                      {e}
                    </p>
                  ))}
                  {draft.validation.perStep?.map((s, i) => (
                    <p key={i}>
                      Day {[0, 3, 7, 14][i]}: {s.wordCount} words
                      {s.bannedPhrases?.length
                        ? ` · banned: ${s.bannedPhrases.join(", ")}`
                        : ""}
                      {s.inventedNumbers?.length
                        ? ` · numbers: ${s.inventedNumbers.join(", ")}`
                        : ""}
                    </p>
                  ))}
                </div>
              ) : null}

              {(editSteps || draft?.steps || []).map((step, idx) => (
                <div key={step.day} className="space-y-1 border-t pt-2">
                  <p className="text-xs font-medium">Day {step.day}</p>
                  <Input
                    value={editSteps?.[idx]?.subject ?? step.subject}
                    onChange={(e) => {
                      if (!editSteps) return;
                      const next = [...editSteps];
                      next[idx] = { ...next[idx]!, subject: e.target.value };
                      setEditSteps(next);
                    }}
                  />
                  <Textarea
                    rows={5}
                    value={editSteps?.[idx]?.body ?? step.body}
                    onChange={(e) => {
                      if (!editSteps) return;
                      const next = [...editSteps];
                      next[idx] = { ...next[idx]!, body: e.target.value };
                      setEditSteps(next);
                    }}
                  />
                </div>
              ))}

              {data?.pitch ? (
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    size="sm"
                    disabled={Boolean(busy)}
                    onClick={() => action("approve")}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={Boolean(busy) || !editSteps}
                    onClick={() => editSteps && action("edit", editSteps)}
                  >
                    Save edits
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={Boolean(busy)}
                    onClick={() => action("regenerate")}
                  >
                    {busy === "regenerate" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Regenerate
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground">
            Run a deep audit with High-confidence A/B findings, then generate a
            draft.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
