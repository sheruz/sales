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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PlatformPageHeader } from "@/components/platform/ui/page-header";
import { PlatformEmptyState } from "@/components/platform/ui/empty-state";
import { formatPlatformDateTime } from "@/lib/platform/format";
import { auditActionLabel, diffKeys } from "@/lib/platform/action-labels";

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

const ACTION_PRESETS = [
  { value: "all", label: "All actions" },
  { value: "platform.", label: "Platform *" },
  { value: "billing", label: "Billing" },
  { value: "plan", label: "Plans" },
  { value: "user", label: "Users" },
  { value: "organization", label: "Organizations" },
];

export function AuditLogClient() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [actorUserId, setActorUserId] = useState("");
  const [action, setAction] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const sp = new URLSearchParams();
      if (organizationId) sp.set("organizationId", organizationId);
      if (actorUserId) sp.set("actorUserId", actorUserId);
      if (action && action !== "all") sp.set("action", action);
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
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <PlatformPageHeader
        title="Audit log"
        description="Platform audit trail of Super Admin actions."
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Tenant, actor, action, date</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-2">
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
          <Select
            value={action}
            onValueChange={(v) => v && setAction(v)}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTION_PRESETS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : logs.length === 0 ? (
        <PlatformEmptyState
          title="No audit events"
          description="Try clearing filters or widening the date range."
        />
      ) : (
        <div className="space-y-3">
          {logs.map((l) => {
            const diffs = diffKeys(l.before, l.after);
            const open = expanded === l.id;
            return (
              <Card key={l.id}>
                <CardContent className="space-y-2 pt-4 text-sm">
                  <div className="flex flex-wrap justify-between gap-2">
                    <strong>{auditActionLabel(l.action)}</strong>
                    <span className="text-muted-foreground">
                      {formatPlatformDateTime(l.createdAt)}
                    </span>
                  </div>
                  <div className="text-muted-foreground">
                    {l.actor
                      ? `${l.actor.firstName} ${l.actor.lastName} <${l.actor.email}>`
                      : "system"}{" "}
                    · {l.targetType}
                    {l.organization ? ` · ${l.organization.name}` : ""}
                    {l.reason ? ` · ${l.reason}` : ""}
                  </div>
                  {diffs.length > 0 && (
                    <button
                      type="button"
                      className="text-xs underline"
                      onClick={() => setExpanded(open ? null : l.id)}
                    >
                      {open ? "Hide changes" : `Show ${diffs.length} change(s)`}
                    </button>
                  )}
                  {open && (
                    <ul className="space-y-1 rounded border bg-muted/30 p-2 font-mono text-xs">
                      {diffs.map((d) => (
                        <li key={d.key}>
                          <span className="text-muted-foreground">{d.key}:</span>{" "}
                          {d.from} → {d.to}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
