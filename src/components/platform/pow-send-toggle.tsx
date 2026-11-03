"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type State = {
  globalEnabled: boolean;
  tenantOverride: boolean | null;
  envForcesOff: boolean;
  effectiveForTenant: boolean | null;
};

export function PowSendToggleGlobal() {
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/platform/pow-send");
    const json = await res.json();
    if (json.success) setState(json.data as State);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function setGlobal(enabled: boolean) {
    setBusy(true);
    try {
      const res = await fetch("/api/platform/pow-send", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: "global",
          enabled,
          reason: enabled
            ? "Enable PoW send globally"
            : "Disable PoW send globally",
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      toast.success(enabled ? "PoW send ON (global)" : "PoW send OFF (global)");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Proof of Work send</CardTitle>
        <CardDescription>
          Global switch for PoW email delivery. Per-tenant overrides live on the
          organization Actions menu. Env{" "}
          <code className="text-xs">POW_SEND_ENABLED=false</code> always forces
          OFF as an emergency kill switch.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {state?.envForcesOff ? (
          <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
            Kill switch active: <code>POW_SEND_ENABLED</code> forces send OFF on
            this host.
          </p>
        ) : null}
        <p className="text-sm">
          Global:{" "}
          <span className="font-medium">
            {state?.globalEnabled ? "ON" : "OFF"}
          </span>
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={busy || state?.globalEnabled === true}
            onClick={() => void setGlobal(true)}
          >
            Turn ON
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy || state?.globalEnabled === false}
            onClick={() => void setGlobal(false)}
          >
            Turn OFF
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function PowSendToggleTenant({
  organizationId,
}: {
  organizationId: string;
}) {
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [choice, setChoice] = useState<string>("inherit");

  const load = useCallback(async () => {
    const res = await fetch(
      `/api/platform/pow-send?organizationId=${organizationId}`
    );
    const json = await res.json();
    if (json.success) {
      const data = json.data as State;
      setState(data);
      setChoice(
        data.tenantOverride === null
          ? "inherit"
          : data.tenantOverride
            ? "on"
            : "off"
      );
    }
  }, [organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setBusy(true);
    try {
      const enabled =
        choice === "inherit" ? null : choice === "on" ? true : false;
      const res = await fetch("/api/platform/pow-send", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: "tenant",
          organizationId,
          enabled,
          reason: `Tenant PoW send → ${choice}`,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      toast.success("PoW send override saved");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 rounded-md border p-3">
      <Label className="text-xs text-muted-foreground">PoW send (tenant)</Label>
      {state?.envForcesOff ? (
        <p className="text-xs text-amber-700">Env kill switch forces OFF</p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Effective:{" "}
        {state?.effectiveForTenant == null
          ? "—"
          : state.effectiveForTenant
            ? "ON"
            : "OFF"}{" "}
        (global {state?.globalEnabled ? "ON" : "OFF"})
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <Select value={choice} onValueChange={(v) => v && setChoice(v)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="inherit">Inherit global</SelectItem>
            <SelectItem value="on">Force ON</SelectItem>
            <SelectItem value="off">Force OFF</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" disabled={busy} onClick={() => void save()}>
          Save
        </Button>
      </div>
    </div>
  );
}
