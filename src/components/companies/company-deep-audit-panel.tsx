"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type DeepStatus = {
  status: "idle" | "queued" | "running" | "done" | "failed" | "skipped";
  inFlight: boolean;
  job: {
    id: string;
    status: string;
    error: string | null;
    creditsSettled: string | null;
  } | null;
  audit: {
    id: string;
    status: string;
    icpFit: string | null;
    icpFitScore: number | null;
    error: string | null;
    finalUrl: string | null;
    title: string | null;
  } | null;
  findings: Array<{
    id: string;
    severity: "A" | "B" | "C";
    title: string;
    whyItMatters?: string;
    evidence: string;
    confidence: string;
    emailEligible?: boolean;
    viewport: string | null;
  }>;
  evidence: Array<{
    id: string;
    kind: string;
    contentType: string;
    byteSize: number;
  }>;
  lowFit: {
    band: string;
    score: number | null;
    reasons: string[];
  } | null;
  creditsNote: string | null;
};

type Props = {
  companyId: string;
  /** Compact: only the trigger button (parent shows panel separately) */
  buttonOnly?: boolean;
  /** Hide the card header button when a sibling button already exists */
  showButton?: boolean;
  className?: string;
};

const DEEP_AUDIT_EVENT = "pow1-deep-audit-refresh";

function severityVariant(
  s: string
): "destructive" | "default" | "secondary" | "outline" {
  if (s === "A") return "destructive";
  if (s === "B") return "default";
  return "secondary";
}

export function CompanyDeepAuditPanel({
  companyId,
  buttonOnly = false,
  showButton = true,
  className,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<DeepStatus | null>(null);
  const [lightbox, setLightbox] = useState<{
    id: string;
    label: string;
  } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/autopilot/audit/deep?companyId=${encodeURIComponent(companyId)}`
      );
      const json = await res.json();
      if (!json.success) return;
      setData(json.data as DeepStatus);
    } catch {
      /* ignore poll errors */
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onRefresh = (ev: Event) => {
      const detail = (ev as CustomEvent<{ companyId?: string }>).detail;
      if (detail?.companyId && detail.companyId !== companyId) return;
      void load();
    };
    window.addEventListener(DEEP_AUDIT_EVENT, onRefresh);
    return () => window.removeEventListener(DEEP_AUDIT_EVENT, onRefresh);
  }, [companyId, load]);

  useEffect(() => {
    if (!data?.inFlight) return;
    const t = setInterval(() => void load(), 3000);
    return () => clearInterval(t);
  }, [data?.inFlight, load]);

  async function startDeepAudit() {
    setBusy(true);
    try {
      const res = await fetch("/api/autopilot/audit/deep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      if (json.data?.status === "SKIPPED") {
        toast.message("Low ICP fit — skipped (no credits charged)");
      } else if (json.data?.status === "PAUSED") {
        toast.error("Out of credits");
      } else if (json.data?.reused) {
        toast.message("Deep audit already in progress");
      } else {
        toast.success("Deep audit queued (3 credits reserved)");
      }
      await load();
      window.dispatchEvent(
        new CustomEvent(DEEP_AUDIT_EVENT, { detail: { companyId } })
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Deep audit failed");
    } finally {
      setBusy(false);
    }
  }

  const inFlight = Boolean(data?.inFlight);
  const statusLabel = data?.status ?? "idle";

  const button = (
    <Button
      size="sm"
      variant="outline"
      disabled={busy || inFlight}
      onClick={startDeepAudit}
      title={
        inFlight
          ? "Deep audit already queued or running"
          : "Playwright evidence audit · 3 credits"
      }
    >
      {busy || inFlight ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : null}
      Deep audit · 3 credits
    </Button>
  );

  if (buttonOnly) {
    return <span className={className}>{button}</span>;
  }

  const desktop = data?.evidence.find((e) =>
    e.kind.includes("DESKTOP")
  );
  const mobile = data?.evidence.find((e) => e.kind.includes("MOBILE"));

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-3">
        <div>
          <CardTitle className="text-base">Deep audit (Audit 2.0)</CardTitle>
          <CardDescription>
            Playwright desktop + mobile evidence. Runs in sales-audit-worker (3
            credits).
          </CardDescription>
        </div>
        {showButton ? button : null}
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {!data || data.status === "idle" ? (
          <p className="text-muted-foreground">
            No deep audit yet. Click Deep audit to queue one.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground">Status</span>
              <Badge
                variant={
                  statusLabel === "done"
                    ? "default"
                    : statusLabel === "failed"
                      ? "destructive"
                      : statusLabel === "skipped"
                        ? "secondary"
                        : "outline"
                }
              >
                {statusLabel}
                {inFlight ? "…" : ""}
              </Badge>
              {data.creditsNote ? (
                <span className="text-xs text-muted-foreground">
                  {data.creditsNote}
                </span>
              ) : null}
              {data.audit?.icpFit ? (
                <Badge variant="outline">
                  ICP {data.audit.icpFit}
                  {data.audit.icpFitScore != null
                    ? ` · ${data.audit.icpFitScore}`
                    : ""}
                </Badge>
              ) : null}
            </div>

            {statusLabel === "skipped" && data.lowFit ? (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 space-y-1">
                <p className="font-medium">Low ICP fit — skipped</p>
                <p className="text-muted-foreground text-xs">
                  Score {data.lowFit.score ?? "—"} ·{" "}
                  {(data.lowFit.reasons || []).join(", ") || "no industry match"}
                </p>
                <p className="text-xs font-medium">No credits charged</p>
              </div>
            ) : null}

            {statusLabel === "failed" ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 space-y-1">
                <p className="font-medium">Deep audit failed</p>
                <p className="text-muted-foreground text-xs break-all">
                  {data.job?.error || data.audit?.error || "Unknown error"}
                </p>
                <p className="text-xs font-medium">Credits refunded</p>
              </div>
            ) : null}

            {statusLabel === "done" && data.findings.length > 0 ? (
              <div className="space-y-2">
                <p className="font-medium">Findings (A → C)</p>
                <ul className="space-y-2">
                  {data.findings.map((f) => (
                    <li
                      key={f.id || f.title}
                      className="rounded-md border p-2 space-y-1"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={severityVariant(f.severity)}>
                          {f.severity}
                        </Badge>
                        <span className="font-medium">{f.title}</span>
                        <Badge variant="outline" className="text-xs">
                          {f.confidence}
                        </Badge>
                        {f.emailEligible === false ? (
                          <span className="text-xs text-muted-foreground">
                            not for email
                          </span>
                        ) : null}
                        {f.viewport ? (
                          <span className="text-xs text-muted-foreground">
                            {f.viewport}
                          </span>
                        ) : null}
                      </div>
                      {f.whyItMatters ? (
                        <p className="text-xs">{f.whyItMatters}</p>
                      ) : null}
                      <p className="text-xs text-muted-foreground break-all">
                        {f.evidence}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {statusLabel === "done" && (desktop || mobile) ? (
              <div className="space-y-2">
                <p className="font-medium">Screenshots</p>
                <div className="grid gap-3 sm:grid-cols-2 items-start">
                  {desktop ? (
                    <button
                      type="button"
                      className="rounded-md border overflow-hidden text-left hover:bg-muted/40 flex flex-col"
                      onClick={() =>
                        setLightbox({ id: desktop.id, label: "Desktop" })
                      }
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/audit-evidence/${desktop.id}`}
                        alt="Desktop screenshot"
                        className="block w-full max-h-48 h-auto object-contain object-top bg-muted"
                      />
                      <p className="px-2 py-1 text-xs text-muted-foreground">
                        Desktop — click for full size
                      </p>
                    </button>
                  ) : null}
                  {mobile ? (
                    <button
                      type="button"
                      className="rounded-md border overflow-hidden text-left hover:bg-muted/40 flex flex-col"
                      onClick={() =>
                        setLightbox({ id: mobile.id, label: "Mobile" })
                      }
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/audit-evidence/${mobile.id}`}
                        alt="Mobile screenshot"
                        className="block w-full max-h-48 h-auto object-contain object-top bg-muted"
                      />
                      <p className="px-2 py-1 text-xs text-muted-foreground">
                        Mobile — click for full size
                      </p>
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}

            {(statusLabel === "queued" || statusLabel === "running") && (
              <p className="text-xs text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                Waiting for sales-audit-worker… refreshing every 3s
              </p>
            )}
          </>
        )}
      </CardContent>

      <Dialog
        open={Boolean(lightbox)}
        onOpenChange={(open) => {
          if (!open) setLightbox(null);
        }}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{lightbox?.label} screenshot</DialogTitle>
          </DialogHeader>
          {lightbox ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/audit-evidence/${lightbox.id}`}
              alt={lightbox.label}
              className="w-full max-h-[80vh] object-contain bg-muted rounded-md"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/** Standalone trigger used on Autopilot Audit rows. */
export function DeepAuditRowButton({
  companyId,
  disabled,
}: {
  companyId: string;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [inFlight, setInFlight] = useState(Boolean(disabled));

  useEffect(() => {
    setInFlight(Boolean(disabled));
  }, [disabled]);

  async function start() {
    setBusy(true);
    try {
      const res = await fetch("/api/autopilot/audit/deep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      if (json.data?.status === "SKIPPED") {
        toast.message("Low ICP fit — skipped (no credits charged)");
      } else if (json.data?.status === "PAUSED") {
        toast.error("Out of credits");
      } else {
        toast.success(
          json.data?.reused
            ? "Already queued"
            : "Deep audit queued · 3 credits"
        );
        setInFlight(true);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={busy || inFlight}
      onClick={start}
    >
      {busy || inFlight ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : null}
      Deep audit
    </Button>
  );
}
