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

type EnrichmentConfig = {
  enabled: boolean;
  batchPerTick: number;
  dailyCreditLimit: number;
  allowAcceptAll: boolean;
};

type Props = {
  initial: {
    config: EnrichmentConfig;
    pending: number;
    enrichedToday: number;
    noContact: number;
    failed: number;
    skipped: number;
    creditsUsed: number;
    creditsRemaining: number | null;
    dailyCreditLimit: number;
    validEmailsToday: number;
    riskyEmailsToday: number;
    recentErrors: Array<{
      id: string;
      name: string;
      enrichmentStatus: string | null;
      enrichmentError: string | null;
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

export function EnrichmentPanel({ initial }: Props) {
  const router = useRouter();
  const [config, setConfig] = useState(initial.config);
  const [busy, setBusy] = useState<string | null>(null);

  async function patchConfig(patch: Partial<EnrichmentConfig>) {
    setBusy("config");
    try {
      const res = await fetch("/api/autopilot/enrichment", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      setConfig(json.data.config);
      toast.success(
        patch.enabled ? "Enrichment ON" : "Enrichment settings saved"
      );
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function enrichNow() {
    setBusy("run");
    try {
      const res = await fetch("/api/autopilot/enrichment/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 5 }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      const enriched = (json.data.results as Array<{ status: string }>).filter(
        (r) => r.status === "ENRICHED"
      ).length;
      toast.success(
        `Processed ${json.data.processed} · enriched ${enriched}`
      );
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Enrich failed");
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
            <CardTitle className="text-base">Hunter enrichment</CardTitle>
            <CardDescription>
              OFF by default. Finds decision-maker emails, verifies them, creates
              Contacts + SOURCED opportunities.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={busy === "run"}
              onClick={enrichNow}
            >
              {busy === "run" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Enrich now (5)
            </Button>
            <Button
              size="sm"
              variant={config.enabled ? "default" : "outline"}
              disabled={busy === "config"}
              onClick={() => patchConfig({ enabled: !config.enabled })}
            >
              {config.enabled ? "Enrichment ON" : "Enrichment OFF"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-4 text-sm">
          <div>
            <p className="text-muted-foreground">Pending</p>
            <p className="text-2xl font-semibold">{initial.pending}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Enriched today</p>
            <p className="text-2xl font-semibold">{initial.enrichedToday}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Valid / risky today</p>
            <p className="text-2xl font-semibold">
              {initial.validEmailsToday} / {initial.riskyEmailsToday}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Credits used / remaining</p>
            <p className="text-2xl font-semibold">
              {initial.creditsUsed}
              {initial.creditsRemaining != null
                ? ` / ${initial.creditsRemaining}`
                : ""}
            </p>
            <p className="text-xs text-muted-foreground">
              Daily limit {initial.dailyCreditLimit} · no contact{" "}
              {initial.noContact} · failed {initial.failed} · skipped{" "}
              {initial.skipped}
            </p>
          </div>
        </CardContent>
      </Card>

      {initial.lastCronRun ? (
        <p className="text-xs text-muted-foreground">
          Last cron:{" "}
          {new Date(
            initial.lastCronRun.finishedAt || initial.lastCronRun.startedAt
          ).toLocaleString()}
          {initial.lastCronRun.ok ? " · ok" : " · errors"}
          {initial.lastCronRun.skipped
            ? ` · skipped (${initial.lastCronRun.skipReason})`
            : ""}
        </p>
      ) : null}

      {initial.recentErrors.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Enrichment issues</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {initial.recentErrors.map((e) => (
              <div key={e.id}>
                <span className="font-medium">{e.name}</span>{" "}
                <Badge variant="outline">{e.enrichmentStatus}</Badge>
                <p className="text-xs text-muted-foreground">
                  {e.enrichmentError || e.domain}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
