"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Play, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type QueryRow = {
  id: string;
  query: string;
  country: string | null;
  city: string | null;
  status: string;
  lastRunAt: string | null;
  resultsCount: number;
  pageToken: string | null;
  lastError: string | null;
};

type SourcingConfig = {
  enabled: boolean;
  queriesPerDay: number;
  companiesPerDay: number;
  queriesPerTick: number;
  crawlsPerTick: number;
};

type Props = {
  initial: {
    config: SourcingConfig;
    queries: QueryRow[];
    companiesToday: number;
    pendingCrawls: number;
    costs: {
      todayUsd: number;
      todayCalls: number;
      monthUsd: number;
      monthCalls: number;
      recent: Array<{
        id: string;
        operation: string;
        estimatedCostUsd: number;
        createdAt: string;
      }>;
    };
    recentErrors: Array<{
      id: string;
      name: string;
      crawlStatus: string | null;
      crawlError: string | null;
      website: string | null;
    }>;
  };
};

export function SourcingPanel({ initial }: Props) {
  const router = useRouter();
  const [config, setConfig] = useState(initial.config);
  const [queries, setQueries] = useState(initial.queries);
  const [busy, setBusy] = useState<string | null>(null);
  const [manualQuery, setManualQuery] = useState("");
  const [manualCity, setManualCity] = useState("");
  const [manualCountry, setManualCountry] = useState("");

  async function refresh() {
    const res = await fetch("/api/autopilot/sourcing");
    const json = await res.json();
    if (!json.success) throw new Error(json.error?.message);
    setConfig(json.data.config);
    setQueries(json.data.queries);
    router.refresh();
  }

  async function patchConfig(patch: Partial<SourcingConfig>) {
    setBusy("config");
    try {
      const res = await fetch("/api/autopilot/sourcing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      setConfig(json.data.config);
      toast.success(patch.enabled ? "Sourcing ON" : "Sourcing updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function generateQueries() {
    setBusy("generate");
    try {
      const res = await fetch("/api/autopilot/sourcing/queries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generate: true, maxQueries: 12 }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      toast.success(
        `Created ${json.data.queries.length} draft queries (paused — review before activating)`
      );
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function addManual() {
    setBusy("add");
    try {
      const res = await fetch("/api/autopilot/sourcing/queries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: manualQuery,
          city: manualCity || undefined,
          country: manualCountry || undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      setManualQuery("");
      toast.success("Query added");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function setStatus(id: string, status: string) {
    setBusy(id);
    try {
      const res = await fetch(`/api/autopilot/sourcing/queries/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function runOne(id: string) {
    setBusy(`run-${id}`);
    try {
      const res = await fetch("/api/autopilot/sourcing/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queryId: id }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      toast.success(
        `Found ${json.data.places} places · created ${json.data.created} · ~$${json.data.estimatedCostUsd}`
      );
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Google sourcing</CardTitle>
            <CardDescription>
              OFF by default. Uses Places Text Search + website crawl. Review
              queries before enabling cron.
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant={config.enabled ? "default" : "outline"}
            disabled={busy === "config"}
            onClick={() => patchConfig({ enabled: !config.enabled })}
          >
            {config.enabled ? "Sourcing ON" : "Sourcing OFF"}
          </Button>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-4 text-sm">
          <div>
            <p className="text-muted-foreground">Companies today</p>
            <p className="text-2xl font-semibold">{initial.companiesToday}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Pending crawls</p>
            <p className="text-2xl font-semibold">{initial.pendingCrawls}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Google spend today</p>
            <p className="text-2xl font-semibold">
              ${initial.costs.todayUsd.toFixed(3)}
            </p>
            <p className="text-xs text-muted-foreground">
              {initial.costs.todayCalls} calls
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Google spend this month</p>
            <p className="text-2xl font-semibold">
              ${initial.costs.monthUsd.toFixed(3)}
            </p>
            <p className="text-xs text-muted-foreground">
              {initial.costs.monthCalls} calls
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Search queries</CardTitle>
          <CardDescription>
            Generate from ICP (creates paused drafts), edit, activate, then Run
            now for one cheap page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={generateQueries}
              disabled={busy === "generate"}
            >
              {busy === "generate" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Generate from ICP
            </Button>
          </div>

          <div className="grid gap-2 sm:grid-cols-4">
            <Input
              placeholder="Query e.g. dental clinic in Austin"
              value={manualQuery}
              onChange={(e) => setManualQuery(e.target.value)}
              className="sm:col-span-2"
            />
            <Input
              placeholder="City"
              value={manualCity}
              onChange={(e) => setManualCity(e.target.value)}
            />
            <Input
              placeholder="Country"
              value={manualCountry}
              onChange={(e) => setManualCountry(e.target.value)}
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={addManual}
            disabled={!manualQuery.trim() || busy === "add"}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add query
          </Button>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Query</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Results</TableHead>
                <TableHead>Last run</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {queries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    No queries yet. Generate from ICP or add manually.
                  </TableCell>
                </TableRow>
              ) : (
                queries.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell>
                      <div className="font-medium">{q.query}</div>
                      <div className="text-xs text-muted-foreground">
                        {[q.city, q.country].filter(Boolean).join(", ") || "—"}
                        {q.lastError ? ` · ${q.lastError}` : ""}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{q.status}</Badge>
                      {q.pageToken ? (
                        <span className="ml-1 text-xs text-muted-foreground">
                          +pages
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>{q.resultsCount}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {q.lastRunAt
                        ? new Date(q.lastRunAt).toLocaleString()
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {q.status !== "ACTIVE" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setStatus(q.id, "ACTIVE")}
                        >
                          Activate
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setStatus(q.id, "PAUSED")}
                        >
                          Pause
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy === `run-${q.id}` || q.status === "PAUSED"}
                        onClick={() => runOne(q.id)}
                      >
                        {busy === `run-${q.id}` ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Play className="h-3 w-3" />
                        )}
                        <span className="ml-1">Run now</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Google API calls</CardTitle>
          <CardDescription>Estimated cost per Text Search call.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {initial.costs.recent.length === 0 ? (
            <p className="text-muted-foreground">No Google Places calls yet.</p>
          ) : (
            initial.costs.recent.map((c) => (
              <div
                key={c.id}
                className="flex justify-between border-b border-border py-1 last:border-0"
              >
                <span>
                  {c.operation} · {new Date(c.createdAt).toLocaleString()}
                </span>
                <span>${c.estimatedCostUsd.toFixed(4)}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {initial.recentErrors.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Crawl issues</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {initial.recentErrors.map((e) => (
              <div key={e.id}>
                <span className="font-medium">{e.name}</span>{" "}
                <Badge variant="outline">{e.crawlStatus}</Badge>
                <p className="text-xs text-muted-foreground">
                  {e.crawlError || e.website}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
