"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

export type GoalRow = {
  id: string;
  name: string;
  targetRevenue: number;
  currency: string;
  targetDeals: number | null;
  averageDealValue: number | null;
  startDate: string | null;
  endDate: string | null;
  targetRegions: string[];
  targetIndustries: string[];
  status: string;
};

type StrategyDraft = {
  name: string;
  targetRevenue: number;
  currency: string;
  timeframe: {
    startDate: string | null;
    endDate: string | null;
    label: string;
  };
  estimatedDealCount: number | null;
  averageDealValue: number | null;
  icp: {
    name: string;
    industries: string[];
    regions: string[];
    countries: string[];
    companySizes: string[];
    decisionMakerTitles: string[];
  };
  service: string | null;
  signals: string[];
  channels: string[];
  summary: string;
};

function splitCsv(value: string) {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function joinCsv(values: string[]) {
  return values.join(", ");
}

const emptyManual = {
  name: "",
  targetRevenue: "",
  currency: "USD",
  targetDeals: "",
  averageDealValue: "",
  startDate: "",
  endDate: "",
  targetRegions: "",
  targetIndustries: "",
};

export function RevenueGoalsClient({
  initialGoals,
}: {
  initialGoals: GoalRow[];
}) {
  const router = useRouter();
  const [goals, setGoals] = useState(initialGoals);
  const [showManual, setShowManual] = useState(false);
  const [manual, setManual] = useState(emptyManual);
  const [creating, setCreating] = useState(false);

  const [prompt, setPrompt] = useState("");
  const [parsing, setParsing] = useState(false);
  const [creatingFromAi, setCreatingFromAi] = useState(false);
  const [strategy, setStrategy] = useState<StrategyDraft | null>(null);
  const [createIcp, setCreateIcp] = useState(true);
  const [activate, setActivate] = useState(false);

  // Editable strategy field mirrors for CSV arrays
  const [icpIndustries, setIcpIndustries] = useState("");
  const [icpRegions, setIcpRegions] = useState("");
  const [icpCountries, setIcpCountries] = useState("");
  const [icpSizes, setIcpSizes] = useState("");
  const [icpTitles, setIcpTitles] = useState("");
  const [signals, setSignals] = useState("");
  const [channels, setChannels] = useState("");

  function applyStrategy(s: StrategyDraft) {
    setStrategy(s);
    setIcpIndustries(joinCsv(s.icp.industries));
    setIcpRegions(joinCsv(s.icp.regions));
    setIcpCountries(joinCsv(s.icp.countries));
    setIcpSizes(joinCsv(s.icp.companySizes));
    setIcpTitles(joinCsv(s.icp.decisionMakerTitles));
    setSignals(joinCsv(s.signals));
    setChannels(joinCsv(s.channels));
  }

  function buildStrategyPayload(): StrategyDraft | null {
    if (!strategy) return null;
    return {
      ...strategy,
      icp: {
        ...strategy.icp,
        industries: splitCsv(icpIndustries),
        regions: splitCsv(icpRegions),
        countries: splitCsv(icpCountries),
        companySizes: splitCsv(icpSizes),
        decisionMakerTitles: splitCsv(icpTitles),
      },
      signals: splitCsv(signals),
      channels: splitCsv(channels),
    };
  }

  async function createManual() {
    if (!manual.name.trim() || !manual.targetRevenue) {
      toast.error("Name and target revenue are required");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/revenue-goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: manual.name.trim(),
          targetRevenue: Number(manual.targetRevenue),
          currency: manual.currency || "USD",
          targetDeals: manual.targetDeals ? Number(manual.targetDeals) : null,
          averageDealValue: manual.averageDealValue
            ? Number(manual.averageDealValue)
            : null,
          startDate: manual.startDate || null,
          endDate: manual.endDate || null,
          targetRegions: splitCsv(manual.targetRegions),
          targetIndustries: splitCsv(manual.targetIndustries),
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message);
      const g = data.data;
      setGoals([
        {
          id: g.id,
          name: g.name,
          targetRevenue: Number(g.targetRevenue),
          currency: g.currency,
          targetDeals: g.targetDeals,
          averageDealValue:
            g.averageDealValue != null ? Number(g.averageDealValue) : null,
          startDate: g.startDate
            ? String(g.startDate).slice(0, 10)
            : null,
          endDate: g.endDate ? String(g.endDate).slice(0, 10) : null,
          targetRegions: g.targetRegions ?? [],
          targetIndustries: g.targetIndustries ?? [],
          status: g.status,
        },
        ...goals,
      ]);
      toast.success("Goal created");
      setManual(emptyManual);
      setShowManual(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setCreating(false);
    }
  }

  async function parsePrompt() {
    if (prompt.trim().length < 10) {
      toast.error("Describe your goal in a bit more detail");
      return;
    }
    setParsing(true);
    try {
      const res = await fetch("/api/revenue-goals/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message);
      applyStrategy(data.data.strategy as StrategyDraft);
      toast.success("Strategy draft ready — review and edit before creating");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Parse failed");
    } finally {
      setParsing(false);
    }
  }

  async function createFromStrategy() {
    const payload = buildStrategyPayload();
    if (!payload) return;
    setCreatingFromAi(true);
    try {
      const res = await fetch("/api/revenue-goals/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          strategy: payload,
          createIcp,
          activate,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message);
      const result = data.data;
      const g = result.goal ?? result;
      if (g?.id) {
        setGoals([
          {
            id: g.id,
            name: g.name,
            targetRevenue: Number(g.targetRevenue),
            currency: g.currency,
            targetDeals: g.targetDeals ?? null,
            averageDealValue:
              g.averageDealValue != null ? Number(g.averageDealValue) : null,
            startDate: g.startDate
              ? String(g.startDate).slice(0, 10)
              : null,
            endDate: g.endDate ? String(g.endDate).slice(0, 10) : null,
            targetRegions: g.targetRegions ?? [],
            targetIndustries: g.targetIndustries ?? [],
            status: g.status,
          },
          ...goals,
        ]);
      }
      toast.success("Goal created from strategy");
      setStrategy(null);
      setPrompt("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setCreatingFromAi(false);
    }
  }

  async function activateGoal(id: string) {
    try {
      const res = await fetch(`/api/revenue-goals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ACTIVE" }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message);
      setGoals(
        goals.map((g) => (g.id === id ? { ...g, status: "ACTIVE" } : g))
      );
      toast.success("Goal activated");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base">Manual goal</CardTitle>
              <CardDescription>Create a revenue target directly.</CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={() => setShowManual(!showManual)}>
              <Plus className="mr-2 h-4 w-4" />
              {showManual ? "Hide" : "New"}
            </Button>
          </CardHeader>
          {showManual && (
            <CardContent className="grid gap-3">
              <div>
                <Label>Name</Label>
                <Input
                  value={manual.name}
                  onChange={(e) => setManual({ ...manual, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Target revenue</Label>
                  <Input
                    type="number"
                    value={manual.targetRevenue}
                    onChange={(e) =>
                      setManual({ ...manual, targetRevenue: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Currency</Label>
                  <Input
                    value={manual.currency}
                    onChange={(e) =>
                      setManual({ ...manual, currency: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Target deals</Label>
                  <Input
                    type="number"
                    value={manual.targetDeals}
                    onChange={(e) =>
                      setManual({ ...manual, targetDeals: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Avg deal value</Label>
                  <Input
                    type="number"
                    value={manual.averageDealValue}
                    onChange={(e) =>
                      setManual({
                        ...manual,
                        averageDealValue: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Start date</Label>
                  <Input
                    type="date"
                    value={manual.startDate}
                    onChange={(e) =>
                      setManual({ ...manual, startDate: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>End date</Label>
                  <Input
                    type="date"
                    value={manual.endDate}
                    onChange={(e) =>
                      setManual({ ...manual, endDate: e.target.value })
                    }
                  />
                </div>
              </div>
              <div>
                <Label>Target regions (CSV)</Label>
                <Input
                  value={manual.targetRegions}
                  onChange={(e) =>
                    setManual({ ...manual, targetRegions: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Target industries (CSV)</Label>
                <Input
                  value={manual.targetIndustries}
                  onChange={(e) =>
                    setManual({ ...manual, targetIndustries: e.target.value })
                  }
                />
              </div>
              <Button onClick={createManual} disabled={creating}>
                {creating ? "Creating…" : "Create goal"}
              </Button>
            </CardContent>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              AI parse
            </CardTitle>
            <CardDescription>
              Describe a goal in natural language, then edit the draft before saving.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Prompt</Label>
              <Textarea
                rows={4}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder='I want $100k in SaaS deals in the US over the next 6 months…'
              />
            </div>
            <Button onClick={parsePrompt} disabled={parsing}>
              {parsing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Parse with AI
            </Button>

            {strategy && (
              <div className="space-y-3 border-t pt-4">
                <div>
                  <Label>Name</Label>
                  <Input
                    value={strategy.name}
                    onChange={(e) =>
                      setStrategy({ ...strategy, name: e.target.value })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Target revenue</Label>
                    <Input
                      type="number"
                      value={strategy.targetRevenue}
                      onChange={(e) =>
                        setStrategy({
                          ...strategy,
                          targetRevenue: Number(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>Currency</Label>
                    <Input
                      value={strategy.currency}
                      onChange={(e) =>
                        setStrategy({ ...strategy, currency: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div>
                  <Label>Timeframe label</Label>
                  <Input
                    value={strategy.timeframe.label}
                    onChange={(e) =>
                      setStrategy({
                        ...strategy,
                        timeframe: {
                          ...strategy.timeframe,
                          label: e.target.value,
                        },
                      })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Start date</Label>
                    <Input
                      type="date"
                      value={strategy.timeframe.startDate ?? ""}
                      onChange={(e) =>
                        setStrategy({
                          ...strategy,
                          timeframe: {
                            ...strategy.timeframe,
                            startDate: e.target.value || null,
                          },
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>End date</Label>
                    <Input
                      type="date"
                      value={strategy.timeframe.endDate ?? ""}
                      onChange={(e) =>
                        setStrategy({
                          ...strategy,
                          timeframe: {
                            ...strategy.timeframe,
                            endDate: e.target.value || null,
                          },
                        })
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Est. deal count</Label>
                    <Input
                      type="number"
                      value={strategy.estimatedDealCount ?? ""}
                      onChange={(e) =>
                        setStrategy({
                          ...strategy,
                          estimatedDealCount: e.target.value
                            ? Number(e.target.value)
                            : null,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>Avg deal value</Label>
                    <Input
                      type="number"
                      value={strategy.averageDealValue ?? ""}
                      onChange={(e) =>
                        setStrategy({
                          ...strategy,
                          averageDealValue: e.target.value
                            ? Number(e.target.value)
                            : null,
                        })
                      }
                    />
                  </div>
                </div>
                <div>
                  <Label>ICP name</Label>
                  <Input
                    value={strategy.icp.name}
                    onChange={(e) =>
                      setStrategy({
                        ...strategy,
                        icp: { ...strategy.icp, name: e.target.value },
                      })
                    }
                  />
                </div>
                <div>
                  <Label>ICP industries</Label>
                  <Input
                    value={icpIndustries}
                    onChange={(e) => setIcpIndustries(e.target.value)}
                  />
                </div>
                <div>
                  <Label>ICP regions</Label>
                  <Input
                    value={icpRegions}
                    onChange={(e) => setIcpRegions(e.target.value)}
                  />
                </div>
                <div>
                  <Label>ICP countries</Label>
                  <Input
                    value={icpCountries}
                    onChange={(e) => setIcpCountries(e.target.value)}
                  />
                </div>
                <div>
                  <Label>ICP company sizes</Label>
                  <Input
                    value={icpSizes}
                    onChange={(e) => setIcpSizes(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Decision maker titles</Label>
                  <Input
                    value={icpTitles}
                    onChange={(e) => setIcpTitles(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Service</Label>
                  <Input
                    value={strategy.service ?? ""}
                    onChange={(e) =>
                      setStrategy({
                        ...strategy,
                        service: e.target.value || null,
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Signals</Label>
                  <Input
                    value={signals}
                    onChange={(e) => setSignals(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Channels</Label>
                  <Input
                    value={channels}
                    onChange={(e) => setChannels(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Summary</Label>
                  <Textarea
                    rows={3}
                    value={strategy.summary}
                    onChange={(e) =>
                      setStrategy({ ...strategy, summary: e.target.value })
                    }
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={createIcp}
                    onChange={(e) => setCreateIcp(e.target.checked)}
                  />
                  Create ICP from strategy
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={activate}
                    onChange={(e) => setActivate(e.target.checked)}
                  />
                  Activate goal immediately
                </label>
                <Button onClick={createFromStrategy} disabled={creatingFromAi}>
                  {creatingFromAi && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Create from strategy
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Existing goals</CardTitle>
        </CardHeader>
        <CardContent>
          {goals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No revenue goals yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Window</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {goals.map((goal) => (
                  <TableRow key={goal.id}>
                    <TableCell className="font-medium">{goal.name}</TableCell>
                    <TableCell>
                      {goal.currency}{" "}
                      {goal.targetRevenue.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {goal.startDate ?? "—"} → {goal.endDate ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          goal.status === "ACTIVE" ? "default" : "secondary"
                        }
                      >
                        {goal.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {goal.status !== "ACTIVE" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => activateGoal(goal.id)}
                        >
                          Activate
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
