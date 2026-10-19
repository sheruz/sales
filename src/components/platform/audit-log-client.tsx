"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Log = {
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  reason: string | null;
  createdAt: string;
  actor: { email: string; firstName: string; lastName: string } | null;
  organization: { name: string; slug: string } | null;
  before: unknown;
  after: unknown;
};

export function AuditLogClient() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [actorUserId, setActorUserId] = useState("");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const sp = new URLSearchParams();
    if (organizationId) sp.set("organizationId", organizationId);
    if (actorUserId) sp.set("actorUserId", actorUserId);
    if (action) sp.set("action", action);
    if (from) sp.set("from", from);
    if (to) sp.set("to", to);
    sp.set("limit", "100");
    const res = await fetch(`/api/platform/audit?${sp}`);
    const json = await res.json();
    if (!json.success) {
      setError(json.error?.message || "Load failed");
      return;
    }
    setLogs(json.data.logs);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Audit log</h2>
        <p className="text-muted-foreground text-sm">
          Thin read-only list — full polish in B4.
        </p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Tenant, actor, action, date</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 items-end">
          <Input
            className="w-56"
            placeholder="Organization id"
            value={organizationId}
            onChange={(e) => setOrganizationId(e.target.value)}
          />
          <Input
            className="w-56"
            placeholder="Actor user id"
            value={actorUserId}
            onChange={(e) => setActorUserId(e.target.value)}
          />
          <Input
            className="w-40"
            placeholder="Action contains"
            value={action}
            onChange={(e) => setAction(e.target.value)}
          />
          <Input
            type="date"
            className="w-40"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <Input
            type="date"
            className="w-40"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
          <Button onClick={() => void load()}>Apply</Button>
        </CardContent>
      </Card>
      <div className="space-y-3">
        {logs.map((l) => (
          <Card key={l.id}>
            <CardContent className="pt-4 text-sm space-y-1">
              <div className="flex flex-wrap gap-2 justify-between">
                <strong className="font-mono">{l.action}</strong>
                <span className="text-muted-foreground">
                  {new Date(l.createdAt).toLocaleString()}
                </span>
              </div>
              <div className="text-muted-foreground">
                {l.actor
                  ? `${l.actor.firstName} ${l.actor.lastName} <${l.actor.email}>`
                  : "system"}{" "}
                · {l.targetType}
                {l.organization ? ` · ${l.organization.name}` : ""}
              </div>
              {l.reason && <div>Reason: {l.reason}</div>}
              <details>
                <summary className="cursor-pointer text-xs">before/after</summary>
                <pre className="text-xs overflow-auto max-h-40 mt-1 bg-muted p-2 rounded">
                  {JSON.stringify({ before: l.before, after: l.after }, null, 2)}
                </pre>
              </details>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
