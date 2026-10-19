"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Row = {
  id: string;
  key: string;
  limitValue: number | null;
  enabled: boolean | null;
  reason: string | null;
  expiresAt: string | null;
  effective: { enabled: boolean; limitValue: number | null } | null;
};

export function TenantOverridesClient({
  organizationId,
  canWrite,
}: {
  organizationId: string;
  canWrite: boolean;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [key, setKey] = useState("outbound_mailboxes");
  const [limitValue, setLimitValue] = useState("10");
  const [expiresAt, setExpiresAt] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch(
      `/api/platform/organizations/${organizationId}/overrides`
    );
    const json = await res.json();
    if (!json.success) {
      setError(json.error?.message || "Load failed");
      return;
    }
    setRows(json.data.overrides);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  async function save() {
    const res = await fetch(
      `/api/platform/organizations/${organizationId}/overrides`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key,
          limitValue: limitValue === "" ? null : Number(limitValue),
          enabled: true,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
          reason: reason || "Set override",
        }),
      }
    );
    const json = await res.json();
    if (!json.success) {
      setError(json.error?.message || "Save failed");
      return;
    }
    setReason("");
    await load();
  }

  async function remove(k: string) {
    const res = await fetch(
      `/api/platform/organizations/${organizationId}/overrides`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: k,
          reason: reason || "Remove override",
        }),
      }
    );
    const json = await res.json();
    if (!json.success) {
      setError(json.error?.message || "Remove failed");
      return;
    }
    await load();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Entitlement overrides</CardTitle>
        <CardDescription>
          Effective = plan version + override. Expired rows are removed by the
          lifecycle job.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <p className="text-sm text-destructive">{error}</p>}
        <ul className="text-sm space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="border rounded-md p-2">
              <div className="font-mono text-xs">{r.key}</div>
              <div>
                override limit={String(r.limitValue)} enabled={String(r.enabled)}
                {r.expiresAt
                  ? ` expires ${new Date(r.expiresAt).toLocaleDateString()}`
                  : ""}
              </div>
              <div className="text-muted-foreground">
                effective: limit={String(r.effective?.limitValue)} enabled=
                {String(r.effective?.enabled)}
              </div>
              {canWrite && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-1"
                  onClick={() => void remove(r.key)}
                >
                  Remove
                </Button>
              )}
            </li>
          ))}
          {rows.length === 0 && (
            <li className="text-muted-foreground">No overrides</li>
          )}
        </ul>
        {canWrite && (
          <div className="flex flex-wrap gap-2 items-end">
            <Input
              className="w-48"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="feature key"
            />
            <Input
              className="w-28"
              value={limitValue}
              onChange={(e) => setLimitValue(e.target.value)}
              placeholder="limit"
            />
            <Input
              type="date"
              className="w-40"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
            <Input
              className="w-56"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason (required)"
            />
            <Button onClick={() => void save()}>Save override</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
