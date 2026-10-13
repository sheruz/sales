"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
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

type OutboundConfig = {
  enabled: boolean;
  shadowMode: boolean;
  dailyGlobalCap: number;
  countryAllowList: string[];
  allowAcceptAll: boolean;
  physicalAddress: string;
  businessName: string;
};

type Mailbox = {
  id: string;
  status: string;
  dailyCap: number;
  sentToday: number;
  effectiveLimit: number;
  bounceRate: number;
  lastError: string | null;
  dnsCheck: unknown;
  emailAccount: { id: string; email: string; provider: string };
};

type Props = {
  initial: {
    config: OutboundConfig;
    queued: number;
    held: number;
    heldTimezone: number;
    sentToday: number;
    failed: number;
    enrolledToday: number;
    dueNow?: number;
    waitingForWindow?: number;
    nextScheduledFor?: string | null;
    mailboxes: Mailbox[];
    suppressCount: number;
    availableAccounts?: Array<{ id: string; email: string; provider: string }>;
    lastCronRun: {
      startedAt: string;
      finishedAt: string | null;
      ok: boolean;
      stale: boolean;
    } | null;
  };
};

function formatSendResult(data: {
  processed?: number;
  reason?: string;
  waitingForWindow?: number;
  nextScheduledFor?: string | null;
  results?: Array<{ status?: string; reason?: string }>;
}): string {
  const processed = data.processed ?? 0;
  if (processed > 0) {
    const sent = (data.results ?? []).filter((r) =>
      String(r.status ?? "").startsWith("sent")
    ).length;
    return `Sent ${sent}/${processed} from outbox`;
  }
  if (data.reason === "global_cap") {
    return "Daily send cap reached — nothing sent";
  }
  if (data.reason === "waiting_for_window") {
    const when = data.nextScheduledFor
      ? new Date(data.nextScheduledFor).toLocaleString()
      : "later";
    return `0 due now — ${data.waitingForWindow ?? 0} waiting for Mon–Fri 8–11 window (next ${when}). Process outbox sends immediately.`;
  }
  return "Nothing due in outbox";
}

export function OutboundPanel({ initial }: Props) {
  const router = useRouter();
  const [config, setConfig] = useState(initial.config);
  const [address, setAddress] = useState(initial.config.physicalAddress);
  const [businessName, setBusinessName] = useState(initial.config.businessName);
  const [busy, setBusy] = useState<string | null>(null);
  const [available, setAvailable] = useState(initial.availableAccounts ?? []);

  async function patchConfig(patch: Partial<OutboundConfig>) {
    setBusy("config");
    try {
      const res = await fetch("/api/autopilot/outbound", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      setConfig(json.data.config);
      toast.success("Outbound settings saved");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function run(action: "enroll" | "send" | "tick") {
    setBusy(action);
    try {
      const res = await fetch("/api/autopilot/outbound/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, limit: 3 }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      if (action === "enroll") {
        toast.success(
          `Enrolled ${json.data?.processed ?? json.data?.results?.length ?? 0}`
        );
      } else if (action === "send") {
        const msg = formatSendResult(json.data ?? {});
        if ((json.data?.processed ?? 0) > 0) toast.success(msg);
        else toast.message(msg);
      } else {
        const send = json.data?.send ?? {};
        const msg = formatSendResult(send);
        toast.success(
          `Tick done (shadow=${config.shadowMode}). ${msg}`
        );
      }
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function mailboxAction(
    mailboxId: string,
    action: "pause" | "activate" | "remove" | "refresh_dns" | "test"
  ) {
    setBusy(`mb:${action}:${mailboxId}`);
    try {
      const res = await fetch("/api/autopilot/outbound/mailboxes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mailboxId, action }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      toast.success(
        action === "test"
          ? `Test sent to ${json.data.to}`
          : action === "refresh_dns"
            ? "DNS refreshed"
            : "Updated"
      );
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function addMailbox(emailAccountId: string) {
    setBusy(`add:${emailAccountId}`);
    try {
      const res = await fetch("/api/autopilot/outbound/mailboxes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailAccountId }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      if (json.data.primaryDomainWarning) {
        toast.warning(
          "Warning: this mailbox domain matches your primary website domain. Prefer a dedicated sending domain."
        );
      } else {
        toast.success("Added to outbound pool");
      }
      setAvailable((a) => a.filter((x) => x.id !== emailAccountId));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function loadAvailable() {
    const res = await fetch("/api/autopilot/outbound/mailboxes");
    const json = await res.json();
    if (json.success) setAvailable(json.data.available);
  }

  return (
    <div className="space-y-6">
      {config.shadowMode ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <strong>Shadow mode ON</strong> — enroll/queue run, but emails are not
          delivered to prospects. Turn OFF only after test-to-self and DNS look
          good.
        </div>
      ) : (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
          <strong>Live sending</strong> — real emails will go to prospects when
          Outbound is ON or you click Process outbox.
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-3">
          <div>
            <CardTitle className="text-base">Outbound email</CardTitle>
            <CardDescription>
              OFF by default. Only APPROVED pitches, US allow-list. Cron
              respects Mon–Fri 8–11 prospect TZ; Process outbox sends queued
              mail immediately. Sticky mailbox + compliance footer.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={Boolean(busy)}
              onClick={() => run("enroll")}
            >
              {busy === "enroll" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Enroll now (3)
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={Boolean(busy)}
              onClick={() => run("send")}
            >
              {busy === "send" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Process outbox (3)
            </Button>
            <Button
              size="sm"
              variant={config.enabled ? "default" : "outline"}
              disabled={busy === "config"}
              onClick={() => patchConfig({ enabled: !config.enabled })}
            >
              {config.enabled ? "Outbound ON" : "Outbound OFF"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <p className="text-muted-foreground">Queued</p>
              <p className="text-2xl font-semibold">{initial.queued}</p>
              {(initial.waitingForWindow ?? 0) > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {initial.waitingForWindow} waiting for send window
                  {initial.nextScheduledFor
                    ? ` (next ${new Date(initial.nextScheduledFor).toLocaleString()})`
                    : ""}
                </p>
              ) : (initial.dueNow ?? 0) > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {initial.dueNow} due now
                </p>
              ) : null}
            </div>
            <div>
              <p className="text-muted-foreground">Held</p>
              <p className="text-2xl font-semibold">{initial.held}</p>
              <p className="text-xs text-muted-foreground">
                {initial.heldTimezone} need timezone
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Sent today</p>
              <p className="text-2xl font-semibold">{initial.sentToday}</p>
              <p className="text-xs text-muted-foreground">
                Cap {config.dailyGlobalCap}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Enrolled today</p>
              <p className="text-2xl font-semibold">{initial.enrolledToday}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Safety settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={config.shadowMode ? "default" : "outline"}
              disabled={busy === "config"}
              onClick={() => patchConfig({ shadowMode: true })}
            >
              Shadow ON
            </Button>
            <Button
              size="sm"
              variant={!config.shadowMode ? "destructive" : "outline"}
              disabled={busy === "config"}
              onClick={() => patchConfig({ shadowMode: false })}
            >
              Shadow OFF (live)
            </Button>
            <Button
              size="sm"
              variant={config.allowAcceptAll ? "default" : "outline"}
              disabled={busy === "config"}
              onClick={() =>
                patchConfig({ allowAcceptAll: !config.allowAcceptAll })
              }
            >
              {config.allowAcceptAll
                ? "Catch-all emails ON"
                : "Catch-all emails OFF"}
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="text-xs text-muted-foreground">
                Business name (footer)
              </label>
              <Input
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">
                Physical address (required)
              </label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
          </div>
          <Button
            size="sm"
            disabled={busy === "config"}
            onClick={() =>
              patchConfig({
                businessName,
                physicalAddress: address,
              })
            }
          >
            Save compliance footer
          </Button>
          <p className="text-xs text-muted-foreground">
            Countries: {config.countryAllowList.join(", ")} · Suppressions:{" "}
            {initial.suppressCount}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Outbound mailbox pool</CardTitle>
            <CardDescription>
              Accounts are NOT added automatically. Add only dedicated senders.
              Main inbox stays for sync.
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={loadAvailable}>
            Refresh available
          </Button>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {initial.mailboxes.length === 0 ? (
            <p className="text-muted-foreground">
              Pool empty. Connect SMTP/Gmail/Outlook in Settings, then add here.
            </p>
          ) : (
            initial.mailboxes.map((m) => {
              const dns =
                m.dnsCheck && typeof m.dnsCheck === "object"
                  ? (m.dnsCheck as {
                      spf?: { ok?: boolean };
                      dkim?: { ok?: boolean };
                    })
                  : null;
              return (
              <div
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"
              >
                <div>
                  <p className="font-medium">{m.emailAccount.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {m.emailAccount.provider} · sent {m.sentToday}/
                    {m.effectiveLimit} · bounce{" "}
                    {(m.bounceRate * 100).toFixed(1)}%
                    {dns
                      ? ` · SPF ${dns.spf?.ok ? "OK" : "FAIL"} · DKIM ${
                          dns.dkim?.ok ? "OK" : "FAIL"
                        }`
                      : ""}
                  </p>
                  {m.lastError ? (
                    <p className="text-xs text-destructive">{m.lastError}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{m.status}</Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={Boolean(busy)}
                    onClick={() => mailboxAction(m.id, "test")}
                  >
                    Test to self
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={Boolean(busy)}
                    onClick={() => mailboxAction(m.id, "refresh_dns")}
                  >
                    Check DNS
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={Boolean(busy)}
                    onClick={() =>
                      mailboxAction(
                        m.id,
                        m.status === "PAUSED" ? "activate" : "pause"
                      )
                    }
                  >
                    {m.status === "PAUSED" ? "Activate" : "Pause"}
                  </Button>
                </div>
              </div>
            );
            })
          )}

          {available.length > 0 ? (
            <div className="border-t pt-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Available accounts (not in pool)
              </p>
              {available.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-2"
                >
                  <span>
                    {a.email} · {a.provider}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={Boolean(busy)}
                    onClick={() => addMailbox(a.id)}
                  >
                    Add to pool
                  </Button>
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
