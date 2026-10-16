"use client";

import { useEffect, useState } from "react";
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

type Stats = {
  config: EnrichmentConfig;
  pending: number;
  enrichedToday: number;
  noContactToday: number;
  noContact: number;
  failed: number;
  skipped: number;
  /** App-side Hunter API units logged today (org daily limit) */
  creditsUsed: number;
  /** Live available from this org's Hunter API key */
  creditsRemaining: number | null;
  /** Live used from Hunter account (plan meter), if returned */
  hunterCreditsUsed?: number | null;
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

type Props = {
  initial: Stats;
};

export function EnrichmentPanel({ initial }: Props) {
  const router = useRouter();
  const [stats, setStats] = useState<Stats>({
    ...initial,
    noContactToday: initial.noContactToday ?? 0,
  });
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    setStats({
      ...initial,
      noContactToday: initial.noContactToday ?? 0,
    });
  }, [initial]);

  // Always re-fetch live Hunter balance for this org's key (tenants bring their own).
  useEffect(() => {
    void refreshStats().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only live refresh
  }, []);

  async function refreshStats() {
    const res = await fetch("/api/autopilot/enrichment", {
      cache: "no-store",
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error?.message || "Refresh failed");
    const d = json.data as Stats & { lastCronRun?: Stats["lastCronRun"] };
    setStats((prev) => ({
      ...prev,
      ...d,
      noContactToday: d.noContactToday ?? 0,
      lastCronRun: d.lastCronRun ?? prev.lastCronRun,
    }));
  }

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
      setStats((s) => ({ ...s, config: json.data.config }));
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
      const results = (json.data.results || []) as Array<{ status: string }>;
      const enriched = results.filter((r) => r.status === "ENRICHED").length;
      const noContact = results.filter((r) => r.status === "NO_CONTACT").length;
      const failed = results.filter((r) => r.status === "FAILED").length;
      const skipped = results.filter(
        (r) => r.status === "SKIPPED" || r.status === "ALREADY_DONE"
      ).length;
      toast.success(
        `Processed ${json.data.processed} · contacts ${enriched} · no contact ${noContact}` +
          (failed || skipped
            ? ` · failed ${failed} · skipped ${skipped}`
            : "")
      );
      await refreshStats();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Enrich failed");
    } finally {
      setBusy(null);
    }
  }

  const config = stats.config;

  return (
    <div className="space-y-6">
      {stats.lastCronRun?.stale || !stats.lastCronRun ? (
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
              Newest sourced companies first. Already enriched / no-contact
              companies are never charged again. &quot;Enriched today&quot; =
              contact found; &quot;No contact today&quot; still uses Hunter
              credits.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={busy === "refresh"}
              onClick={() => {
                setBusy("refresh");
                void refreshStats()
                  .then(() => toast.success("Hunter balance refreshed"))
                  .catch((err) =>
                    toast.error(
                      err instanceof Error ? err.message : "Refresh failed"
                    )
                  )
                  .finally(() => setBusy(null));
              }}
            >
              {busy === "refresh" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Refresh balance
            </Button>
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
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 text-sm">
          <div>
            <p className="text-muted-foreground">Pending</p>
            <p className="text-2xl font-semibold">{stats.pending}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Enriched today</p>
            <p className="text-2xl font-semibold">{stats.enrichedToday}</p>
            <p className="text-xs text-muted-foreground">Contact found</p>
          </div>
          <div>
            <p className="text-muted-foreground">No contact today</p>
            <p className="text-2xl font-semibold">{stats.noContactToday}</p>
            <p className="text-xs text-muted-foreground">Credits used, no email</p>
          </div>
          <div>
            <p className="text-muted-foreground">Valid / risky today</p>
            <p className="text-2xl font-semibold">
              {stats.validEmailsToday} / {stats.riskyEmailsToday}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Hunter available</p>
            <p className="text-2xl font-semibold">
              {stats.creditsRemaining != null ? stats.creditsRemaining : "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              Live from your connected Hunter key
              {stats.hunterCreditsUsed != null
                ? ` · Hunter used ${stats.hunterCreditsUsed}`
                : ""}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">App used today</p>
            <p className="text-2xl font-semibold">
              {stats.creditsUsed}
              <span className="text-base font-normal text-muted-foreground">
                {" "}
                / {stats.dailyCreditLimit}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              Org daily cap · failed {stats.failed} · skipped {stats.skipped}
            </p>
          </div>
        </CardContent>
      </Card>

      {stats.lastCronRun ? (
        <p className="text-xs text-muted-foreground">
          Last cron:{" "}
          {new Date(
            stats.lastCronRun.finishedAt || stats.lastCronRun.startedAt
          ).toLocaleString()}
          {stats.lastCronRun.ok ? " · ok" : " · errors"}
          {stats.lastCronRun.skipped
            ? ` · skipped (${stats.lastCronRun.skipReason})`
            : ""}
        </p>
      ) : null}

      {stats.recentErrors.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Enrichment issues</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {stats.recentErrors.map((e) => (
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
