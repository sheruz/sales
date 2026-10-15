"use client";

import { useEffect, useState } from "react";
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
  rampStart: number;
  rampIncrement: number;
  sentToday: number;
  effectiveLimit: number;
  bounceRate: number;
  lastError: string | null;
  dnsCheck: unknown;
  allowFreeMailProvider?: boolean;
  senderName?: string | null;
  senderTitle?: string | null;
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

function MailboxLimitsEditor({
  mailbox,
  busy,
  onSave,
}: {
  mailbox: Mailbox;
  busy: boolean;
  onSave: (patch: {
    dailyCap: number;
    rampStart: number;
    rampIncrement: number;
    resetSentToday?: boolean;
  }) => void;
}) {
  const [dailyCap, setDailyCap] = useState(String(mailbox.dailyCap));
  const [rampStart, setRampStart] = useState(String(mailbox.rampStart));
  const [rampIncrement, setRampIncrement] = useState(
    String(mailbox.rampIncrement)
  );

  function parse() {
    const cap = Number(dailyCap);
    const start = Number(rampStart);
    const inc = Number(rampIncrement);
    if (!Number.isFinite(cap) || !Number.isFinite(start) || !Number.isFinite(inc)) {
      toast.error("Enter valid numbers for limits");
      return null;
    }
    return {
      dailyCap: Math.round(cap),
      rampStart: Math.round(start),
      rampIncrement: Math.round(inc),
    };
  }

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-md bg-muted/40 p-2 text-xs">
      <label className="space-y-1">
        <span className="text-muted-foreground">Daily cap</span>
        <Input
          className="h-8 w-20"
          inputMode="numeric"
          value={dailyCap}
          onChange={(e) => setDailyCap(e.target.value)}
          disabled={busy}
        />
      </label>
      <label className="space-y-1">
        <span className="text-muted-foreground">Ramp start</span>
        <Input
          className="h-8 w-20"
          inputMode="numeric"
          value={rampStart}
          onChange={(e) => setRampStart(e.target.value)}
          disabled={busy}
        />
      </label>
      <label className="space-y-1">
        <span className="text-muted-foreground">+ / day</span>
        <Input
          className="h-8 w-16"
          inputMode="numeric"
          value={rampIncrement}
          onChange={(e) => setRampIncrement(e.target.value)}
          disabled={busy}
        />
      </label>
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => {
          const parsed = parse();
          if (parsed) onSave(parsed);
        }}
      >
        Save limits
      </Button>
      <Button
        size="sm"
        variant="secondary"
        disabled={busy}
        title="Zero sent today and set ramp start = daily cap so you can send again immediately"
        onClick={() => {
          const parsed = parse();
          if (!parsed) return;
          // Unblock: full cap available today
          onSave({
            ...parsed,
            rampStart: parsed.dailyCap,
            resetSentToday: true,
          });
        }}
      >
        Reset sent today
      </Button>
      <span className="text-muted-foreground">
        Effective limit = min(cap, ramp start + days×increment). Raising only
        Daily cap leaves Ramp start at 5.
      </span>
    </div>
  );
}

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

type DashStats = {
  queued: number;
  held: number;
  heldTimezone: number;
  sentToday: number;
  failed: number;
  enrolledToday: number;
  dueNow: number;
  waitingForWindow: number;
  nextScheduledFor: string | null;
  suppressCount: number;
  mailboxes: Mailbox[];
};

export function OutboundPanel({ initial }: Props) {
  const router = useRouter();
  const [config, setConfig] = useState(initial.config);
  const [address, setAddress] = useState(initial.config.physicalAddress);
  const [businessName, setBusinessName] = useState(initial.config.businessName);
  const [countries, setCountries] = useState(
    initial.config.countryAllowList.join(", ")
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [available, setAvailable] = useState(initial.availableAccounts ?? []);
  const [stats, setStats] = useState<DashStats>({
    queued: initial.queued,
    held: initial.held,
    heldTimezone: initial.heldTimezone,
    sentToday: initial.sentToday,
    failed: initial.failed,
    enrolledToday: initial.enrolledToday,
    dueNow: initial.dueNow ?? 0,
    waitingForWindow: initial.waitingForWindow ?? 0,
    nextScheduledFor: initial.nextScheduledFor ?? null,
    suppressCount: initial.suppressCount,
    mailboxes: initial.mailboxes,
  });

  useEffect(() => {
    setConfig(initial.config);
    setAddress(initial.config.physicalAddress);
    setBusinessName(initial.config.businessName);
    setCountries(initial.config.countryAllowList.join(", "));
    setStats({
      queued: initial.queued,
      held: initial.held,
      heldTimezone: initial.heldTimezone,
      sentToday: initial.sentToday,
      failed: initial.failed,
      enrolledToday: initial.enrolledToday,
      dueNow: initial.dueNow ?? 0,
      waitingForWindow: initial.waitingForWindow ?? 0,
      nextScheduledFor: initial.nextScheduledFor ?? null,
      suppressCount: initial.suppressCount,
      mailboxes: initial.mailboxes,
    });
  }, [initial]);

  function parseCountries(raw: string): string[] {
    return raw
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 40);
  }

  async function refreshStats() {
    const res = await fetch("/api/autopilot/outbound");
    const json = await res.json();
    if (!json.success) throw new Error(json.error?.message || "Refresh failed");
    const d = json.data;
    if (d.config) setConfig(d.config);
    setStats({
      queued: d.queued ?? 0,
      held: d.held ?? 0,
      heldTimezone: d.heldTimezone ?? 0,
      sentToday: d.sentToday ?? 0,
      failed: d.failed ?? 0,
      enrolledToday: d.enrolledToday ?? 0,
      dueNow: d.dueNow ?? 0,
      waitingForWindow: d.waitingForWindow ?? 0,
      nextScheduledFor: d.nextScheduledFor ?? null,
      suppressCount: d.suppressCount ?? 0,
      mailboxes: d.mailboxes ?? [],
    });
  }

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
      await refreshStats();
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
        const results = (json.data?.results ?? []) as Array<{
          status: string;
          reason?: string;
        }>;
        const enrolled =
          json.data?.enrolled ??
          results.filter((r) => r.status === "enrolled").length;
        const skipped =
          json.data?.skipped ??
          results.filter((r) => r.status === "skipped").length;
        if (enrolled > 0) {
          toast.success(
            `Enrolled ${enrolled}` +
              (skipped ? ` · skipped ${skipped}` : "")
          );
        } else {
          const reason = results.find((r) => r.reason)?.reason;
          toast.message(
            `Enrolled 0` +
              (skipped ? ` · skipped ${skipped}` : "") +
              (reason ? ` (${reason})` : "")
          );
        }
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
      await refreshStats();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function mailboxAction(
    mailboxId: string,
    action:
      | "pause"
      | "activate"
      | "remove"
      | "refresh_dns"
      | "test"
      | "update_branding"
      | "update_limits",
    extra?: Record<string, unknown>
  ) {
    setBusy(`mb:${action}:${mailboxId}`);
    try {
      const res = await fetch("/api/autopilot/outbound/mailboxes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mailboxId, action, ...extra }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      toast.success(
        action === "test"
          ? `Test sent to ${json.data.to}`
          : action === "update_branding"
            ? "Mailbox branding updated"
            : action === "update_limits"
              ? "Mailbox daily limit updated"
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
              <p className="text-2xl font-semibold">{stats.queued}</p>
              {stats.waitingForWindow > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {stats.waitingForWindow} waiting for send window
                  {stats.nextScheduledFor
                    ? ` (next ${new Date(stats.nextScheduledFor).toLocaleString()})`
                    : ""}
                </p>
              ) : stats.dueNow > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {stats.dueNow} due now
                </p>
              ) : null}
            </div>
            <div>
              <p className="text-muted-foreground">Held</p>
              <p className="text-2xl font-semibold">{stats.held}</p>
              <p className="text-xs text-muted-foreground">
                {stats.heldTimezone} need timezone
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Sent today</p>
              <p className="text-2xl font-semibold">{stats.sentToday}</p>
              <p className="text-xs text-muted-foreground">
                Cap {config.dailyGlobalCap}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Enrolled today</p>
              <p className="text-2xl font-semibold">{stats.enrolledToday}</p>
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
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">
              Allowed countries (comma-separated). Use{" "}
              <code className="text-[11px]">*</code> or click Allow all to
              disable country blocking.
            </label>
            <Input
              value={countries}
              onChange={(e) => setCountries(e.target.value)}
              placeholder="*  or  US, Pakistan, United Kingdom"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={busy === "config"}
                onClick={() => {
                  setCountries("*");
                  patchConfig({
                    businessName,
                    physicalAddress: address,
                    countryAllowList: ["*"],
                  });
                }}
              >
                Allow all countries
              </Button>
              <Button
                size="sm"
                disabled={busy === "config"}
                onClick={() => {
                  const list = parseCountries(countries);
                  patchConfig({
                    businessName,
                    physicalAddress: address,
                    countryAllowList: list.length ? list : ["*"],
                  });
                }}
              >
                Save compliance + countries
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Active allow-list:{" "}
            {config.countryAllowList.some((c) => c.trim() === "*")
              ? "All countries (*)"
              : config.countryAllowList.join(", ") || "All countries"}{" "}
            · Suppressions: {stats.suppressCount}
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
          {stats.mailboxes.length === 0 ? (
            <p className="text-muted-foreground">
              Pool empty. Connect SMTP/Gmail/Outlook in Settings, then add here.
            </p>
          ) : (
            stats.mailboxes.map((m) => {
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
                className="space-y-2 rounded-md border p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{m.emailAccount.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.emailAccount.provider} · sent {m.sentToday}/
                      {m.effectiveLimit} (cap {m.dailyCap}, ramp{" "}
                      {m.rampStart}+{m.rampIncrement}/day) · bounce{" "}
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
                    <Button
                      size="sm"
                      variant={m.allowFreeMailProvider ? "default" : "outline"}
                      disabled={Boolean(busy)}
                      title="Allow Gmail/Outlook/Yahoo as From domain"
                      onClick={() =>
                        mailboxAction(m.id, "update_branding", {
                          allowFreeMailProvider: !m.allowFreeMailProvider,
                        })
                      }
                    >
                      {m.allowFreeMailProvider
                        ? "Free-mail OK"
                        : "Allow free-mail"}
                    </Button>
                  </div>
                </div>
                <MailboxLimitsEditor
                  mailbox={m}
                  busy={Boolean(busy)}
                  onSave={(patch) =>
                    mailboxAction(m.id, "update_limits", patch)
                  }
                />
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
