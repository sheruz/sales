"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type AuditConfig = {
  enabled: boolean;
  batchPerTick: number;
  dailyLimit: number;
  maxAttempts: number;
  pitchReviewMode: "AUTO_APPROVE" | "REVIEW_REQUIRED";
};

type Props = {
  initial: {
    config: AuditConfig;
    pending: number;
    auditedToday: number;
    failed: number;
    draftPitches: number;
    approvedPitches: number;
    avgMobileScore: number | null;
    costs: {
      pagespeedTodayUsd: number;
      pagespeedTodayCalls: number;
      claudeTodayUsd: number;
      claudeTodayCalls: number;
    };
    recentErrors: Array<{
      id: string;
      name: string;
      auditStatus: string | null;
      auditError: string | null;
      domain: string | null;
    }>;
    lastCronRun: {
      startedAt: string;
      finishedAt: string | null;
      ok: boolean;
      skipped: boolean;
      skipReason: string | null;
      stale: boolean;
    } | null;
  };
};

export function AuditPanel({ initial }: Props) {
  const router = useRouter();
  const [config, setConfig] = useState(initial.config);
  const [busy, setBusy] = useState<string | null>(null);

  async function patchConfig(patch: Partial<AuditConfig>) {
    setBusy("config");
    try {
      const res = await fetch("/api/autopilot/audit", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      setConfig(json.data.config);
      toast.success(patch.enabled ? "Audit ON" : "Audit settings saved");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function auditNow() {
    setBusy("run");
    try {
      const res = await fetch("/api/autopilot/audit/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 3 }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      const done = (json.data.results as Array<{ status: string }>).filter(
        (r) => r.status === "DONE"
      ).length;
      toast.success(`Processed ${json.data.processed} · audited ${done}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Audit failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      {initial.lastCronRun?.stale || !initial.lastCronRun ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          Cron warning: last run is missing or older than 15 minutes. Check
          server crontab / scripts/cron-tick.sh.
        </div>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Website audit</CardTitle>
            <CardDescription>
              OFF by default. PageSpeed + rule checks + Claude pitch. Only
              ENRICHED companies with a valid (or allowed risky) contact.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={busy === "run"}
              onClick={auditNow}
            >
              {busy === "run" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Audit now (3)
            </Button>
            <Button
              size="sm"
              variant={config.enabled ? "default" : "outline"}
              disabled={busy === "config"}
              onClick={() => patchConfig({ enabled: !config.enabled })}
            >
              {config.enabled ? "Audit ON" : "Audit OFF"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-4 text-sm">
          <div>
            <p className="text-muted-foreground">Eligible pending</p>
            <p className="text-2xl font-semibold">{initial.pending}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Audited today</p>
            <p className="text-2xl font-semibold">{initial.auditedToday}</p>
            <p className="text-xs text-muted-foreground">
              Limit {config.dailyLimit}/day · {config.batchPerTick}/tick
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Avg mobile score</p>
            <p className="text-2xl font-semibold">
              {initial.avgMobileScore ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Pitches</p>
            <p className="text-2xl font-semibold">
              {initial.approvedPitches}
              <span className="text-base font-normal text-muted-foreground">
                {" "}
                approved
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              {initial.draftPitches} pending review
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Review mode & cost</CardTitle>
          <CardDescription>
            REVIEW_REQUIRED keeps pitches as DRAFT until you approve (Phase 4
            only sends APPROVED).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3 text-sm">
          <Button
            size="sm"
            variant={
              config.pitchReviewMode === "REVIEW_REQUIRED"
                ? "default"
                : "outline"
            }
            disabled={busy === "config"}
            onClick={() =>
              patchConfig({ pitchReviewMode: "REVIEW_REQUIRED" })
            }
          >
            Review required
          </Button>
          <Button
            size="sm"
            variant={
              config.pitchReviewMode === "AUTO_APPROVE" ? "default" : "outline"
            }
            disabled={busy === "config"}
            onClick={() => patchConfig({ pitchReviewMode: "AUTO_APPROVE" })}
          >
            Auto-approve
          </Button>
          <div className="ml-auto space-y-1 text-right text-muted-foreground">
            <p>
              PageSpeed today: {initial.costs.pagespeedTodayCalls} calls · $
              {initial.costs.pagespeedTodayUsd.toFixed(4)}
            </p>
            <p>
              Claude today: {initial.costs.claudeTodayCalls} calls · $
              {initial.costs.claudeTodayUsd.toFixed(4)}
            </p>
          </div>
        </CardContent>
      </Card>

      {initial.recentErrors.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent audit errors</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {initial.recentErrors.map((e) => (
              <div
                key={e.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2"
              >
                <div>
                  <p className="font-medium">{e.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {e.domain} · {e.auditError}
                  </p>
                </div>
                <Badge variant="outline">{e.auditStatus}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
