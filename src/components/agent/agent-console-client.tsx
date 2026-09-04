"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Bot, Play, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type RevenueGoalOption = {
  id: string;
  name: string;
  status: string;
  targetRevenue: number;
  currency: string;
};

type AgentGoal = {
  id: string;
  name: string;
  objective: string;
  status: string;
  maxDailyActions: number;
  allowedChannels: string[];
  revenueGoal: {
    id: string;
    name: string;
    status: string;
    targetRevenue: number | string;
    currency: string;
  };
  _count?: { runs: number; actions: number };
};

type PendingAction = {
  id: string;
  actionType: string;
  status: string;
  entityType: string | null;
  entityId: string | null;
  createdAt: string;
  agentGoal: { id: string; name: string };
};

type AgentRun = {
  id: string;
  status: string;
  summary: string | null;
  actionsCount: number;
  successfulActions: number;
  failedActions: number;
  createdAt: string;
  agentGoal: { id: string; name: string };
};

export function AgentConsoleClient({
  revenueGoals,
  canManage,
  canApprove,
}: {
  revenueGoals: RevenueGoalOption[];
  canManage: boolean;
  canApprove: boolean;
}) {
  const [goals, setGoals] = useState<AgentGoal[]>([]);
  const [pending, setPending] = useState<PendingAction[]>([]);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [revenueGoalId, setRevenueGoalId] = useState(
    revenueGoals.find((g) => g.status === "ACTIVE")?.id ||
      revenueGoals[0]?.id ||
      ""
  );
  const [name, setName] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [g, a, r] = await Promise.all([
        fetch("/api/agent/goals").then((x) => x.json()),
        fetch("/api/agent/approvals").then((x) => x.json()),
        fetch("/api/agent/runs").then((x) => x.json()),
      ]);
      if (g.success) setGoals(g.data);
      if (a.success) setPending(a.data);
      if (r.success) setRuns(r.data);
    } catch {
      toast.error("Failed to load agent console");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createGoal(activate: boolean) {
    if (!revenueGoalId) {
      toast.error("Select an ACTIVE revenue goal first");
      return;
    }
    setBusy("create");
    try {
      const res = await fetch("/api/agent/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          revenueGoalId,
          name: name || undefined,
          activate,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Create failed");
        return;
      }
      toast.success(activate ? "Agent goal activated" : "Agent goal drafted");
      setName("");
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function setStatus(id: string, status: string) {
    setBusy(id);
    try {
      const res = await fetch(`/api/agent/goals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Update failed");
        return;
      }
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function runGoal(agentGoalId: string) {
    setBusy(`run-${agentGoalId}`);
    try {
      const res = await fetch("/api/agent/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentGoalId }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Run failed");
        return;
      }
      toast.success(json.data.summary || "Agent run completed");
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function decide(actionId: string, decision: "approve" | "deny") {
    setBusy(actionId);
    try {
      const res = await fetch("/api/agent/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionId, decision }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Decision failed");
        return;
      }
      toast.success(decision === "approve" ? "Approved & executed" : "Denied");
      await load();
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading agent…</p>;
  }

  const activeRevenue = revenueGoals.filter((g) => g.status === "ACTIVE");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="h-4 w-4" />
            Controlled revenue agent
          </CardTitle>
          <CardDescription>
            Operates only against an approved Revenue Goal. Outbound, campaigns,
            proposals, and source runs require human approval. Research, scoring,
            and internal recommendations can run automatically within daily
            limits.
          </CardDescription>
        </CardHeader>
        {canManage && (
          <CardContent className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2 md:col-span-2">
              <Label>Revenue goal</Label>
              <Select
                value={revenueGoalId}
                onValueChange={(v) => setRevenueGoalId(v ?? "")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select revenue goal" />
                </SelectTrigger>
                <SelectContent>
                  {(activeRevenue.length ? activeRevenue : revenueGoals).map(
                    (g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name} ({g.currency} {g.targetRevenue}) — {g.status}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Agent name</Label>
              <Input
                value={name}
                placeholder="Optional"
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="md:col-span-3 flex flex-wrap gap-2">
              <Button
                disabled={busy === "create"}
                onClick={() => void createGoal(false)}
                variant="outline"
              >
                Create draft
              </Button>
              <Button
                disabled={busy === "create"}
                onClick={() => void createGoal(true)}
              >
                Create & activate
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Agent goals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {goals.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No agent goals yet. Activate a revenue goal, then create an
                agent.
              </p>
            )}
            {goals.map((g) => (
              <div
                key={g.id}
                className="rounded-md border p-3 space-y-2 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{g.name}</span>
                  <Badge variant="secondary">{g.status}</Badge>
                  <span className="text-muted-foreground">
                    max {g.maxDailyActions}/day ·{" "}
                    {g.allowedChannels.join(", ") || "email"}
                  </span>
                </div>
                <p className="text-muted-foreground line-clamp-2">
                  {g.objective}
                </p>
                <p className="text-xs text-muted-foreground">
                  Revenue: {g.revenueGoal.name} ({g.revenueGoal.status})
                </p>
                {canManage && (
                  <div className="flex flex-wrap gap-2">
                    {g.status !== "ACTIVE" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy === g.id}
                        onClick={() => void setStatus(g.id, "ACTIVE")}
                      >
                        Activate
                      </Button>
                    )}
                    {g.status === "ACTIVE" && (
                      <>
                        <Button
                          size="sm"
                          disabled={busy === `run-${g.id}`}
                          onClick={() => void runGoal(g.id)}
                        >
                          <Play className="mr-1 h-3 w-3" />
                          Run once
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy === g.id}
                          onClick={() => void setStatus(g.id, "PAUSED")}
                        >
                          Pause
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4" />
              Pending approvals
            </CardTitle>
            <CardDescription>
              Campaign, sequence, outbound, proposal, source runs, and unusual
              volume stay parked until approved.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pending.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No actions awaiting approval.
              </p>
            )}
            {pending.map((a) => (
              <div
                key={a.id}
                className="rounded-md border p-3 space-y-2 text-sm"
              >
                <div className="flex flex-wrap gap-2 items-center">
                  <Badge>{a.actionType}</Badge>
                  <span className="text-muted-foreground">{a.agentGoal.name}</span>
                </div>
                {a.entityType && (
                  <p className="text-xs text-muted-foreground">
                    {a.entityType}: {a.entityId}
                  </p>
                )}
                {canApprove && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={busy === a.id}
                      onClick={() => void decide(a.id, "approve")}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy === a.id}
                      onClick={() => void decide(a.id, "deny")}
                    >
                      Deny
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent runs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {runs.length === 0 && (
            <p className="text-sm text-muted-foreground">No runs yet.</p>
          )}
          {runs.map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
            >
              <div>
                <div className="font-medium">{r.agentGoal.name}</div>
                <div className="text-xs text-muted-foreground">
                  {r.summary || "—"}
                </div>
              </div>
              <Badge variant="secondary">{r.status}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
