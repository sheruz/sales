"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CreditCard, Landmark, Wallet } from "lucide-react";

type ProviderRow = {
  provider: string;
  enabled: boolean;
  mode: string;
  displayName: string;
  configuredSandbox: boolean;
  configuredLive: boolean;
  sandboxHint: string | null;
  liveHint: string | null;
  lastTestAt: string | null;
  lastTestResult: { ok?: boolean; message?: string } | null;
  lastWebhookAt: string | null;
  activeSubscriptions: number;
  webhookUrl: string | null;
};

type PaymentsData = {
  emergencyDisable: boolean;
  paymentsEnabled: boolean;
  effectivePaymentsLive: boolean;
  statusPill: string;
  settings: {
    paymentsEnabled: boolean;
    defaultProvider: string;
    checkoutMethods: string[];
    currency: string;
    graceDays: number;
    manualRenewalLeadDays: number;
    business: Record<string, string>;
    manualInstructions: Record<string, string>;
  };
  allCheckoutMethods: string[];
  providers: ProviderRow[];
  lastWebhook: { eventType: string; status: string; createdAt: string } | null;
  failedWebhooks: Array<{
    id: string;
    eventId: string;
    eventType: string;
    status: string;
    error: string | null;
  }>;
  unmatchedWebhooks: Array<{
    id: string;
    eventId: string;
    eventType: string;
    status: string;
    error: string | null;
  }>;
  canImportEnv: boolean;
};

const TABS = [
  "Providers",
  "Checkout settings",
  "Manual methods",
  "Business details",
  "Webhooks & sync",
] as const;

function providerIcon(p: string) {
  if (p === "PADDLE" || p === "STRIPE") return CreditCard;
  if (p.includes("BANK")) return Landmark;
  return Wallet;
}

export function PaymentsSettingsClient({ canWrite }: { canWrite: boolean }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Providers");
  const [data, setData] = useState<PaymentsData | null>(null);
  const [password, setPassword] = useState("");
  const [reason, setReason] = useState("");
  const [drawer, setDrawer] = useState<ProviderRow | null>(null);
  const [credMode, setCredMode] = useState<"SANDBOX" | "LIVE">("SANDBOX");
  const [activeMode, setActiveMode] = useState<"SANDBOX" | "LIVE">("SANDBOX");
  const [creds, setCreds] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<{
    title: string;
    body: string;
    onConfirm: () => void;
  } | null>(null);
  const [orgQuery, setOrgQuery] = useState("");
  const [orgResults, setOrgResults] = useState<
    Array<{ id: string; name: string; slug: string }>
  >([]);
  const [linkOrgId, setLinkOrgId] = useState("");
  const [syncBusy, setSyncBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(
      `/api/platform/payments${orgQuery ? `?q=${encodeURIComponent(orgQuery)}` : ""}`
    );
    const json = await res.json();
    if (json.success) setData(json.data);
  }, [orgQuery]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveSettings(patch: Record<string, unknown>) {
    const res = await fetch("/api/platform/payments", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_settings",
        ...patch,
        password: password || undefined,
        reason: reason || "Update payment settings",
      }),
    });
    const json = await res.json();
    if (!json.success) {
      toast.error(json.error?.message || "Save failed");
      return;
    }
    toast.success("Saved");
    setPassword("");
    await load();
  }

  async function updateProvider(body: Record<string, unknown>) {
    const pwd =
      typeof body.password === "string" ? body.password : password;
    if (!pwd || !String(pwd).trim()) {
      toast.error("Enter your Super Admin login password to save");
      return false;
    }
    const res = await fetch("/api/platform/payments", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_provider",
        reason: reason || "Update provider",
        ...body,
        password: String(pwd).trim(),
      }),
    });
    const json = await res.json();
    if (!json.success) {
      const detail = json.error?.details?.password?.[0];
      toast.error(
        detail
          ? "Password required — type your login password, then Save"
          : json.error?.message || "Update failed"
      );
      return false;
    }
    toast.success("Provider updated");
    setPassword("");
    setCreds({});
    await load();
    return true;
  }

  async function testProvider(provider: string) {
    const res = await fetch("/api/platform/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "test_connection", provider }),
    });
    const json = await res.json();
    toast.message(json.data?.message || json.error?.message);
    await load();
  }

  async function syncAll(provider?: string) {
    setSyncBusy(true);
    try {
      const res = await fetch("/api/platform/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync_all", provider }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Synced ${json.data.total} items`);
      } else {
        toast.error(json.error?.message || "Sync failed");
      }
    } finally {
      setSyncBusy(false);
      await load();
    }
  }

  async function searchOrgs(q: string) {
    setOrgQuery(q);
    const res = await fetch("/api/platform/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "search_orgs", q }),
    });
    const json = await res.json();
    if (json.success) setOrgResults(json.data.orgs || []);
  }

  if (!data) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  const biz = data.settings.business || {};
  const manual = data.settings.manualInstructions || {};

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Payments</h2>
          <p className="text-muted-foreground text-sm">
            Configure providers, checkout methods, and invoices — no .env edits
            for day-to-day use.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={
              data.statusPill.startsWith("Off") ? "destructive" : "default"
            }
          >
            Payments {data.statusPill}
          </Badge>
          {canWrite && (
            <Button
              size="sm"
              variant={data.settings.paymentsEnabled ? "outline" : "default"}
              onClick={() =>
                setConfirm({
                  title: data.settings.paymentsEnabled
                    ? "Turn payments off?"
                    : "Turn payments on?",
                  body: "Requires your password. Tenants will see checkout when on (unless emergency kill is set).",
                  onConfirm: () => {
                    void saveSettings({
                      paymentsEnabled: !data.settings.paymentsEnabled,
                      password,
                    });
                    setConfirm(null);
                  },
                })
              }
            >
              Master switch: {data.settings.paymentsEnabled ? "ON" : "OFF"}
            </Button>
          )}
        </div>
      </div>

      {data.emergencyDisable && (
        <div className="rounded-md border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          <strong>Emergency disable active</strong> (
          <code>PAYMENTS_EMERGENCY_DISABLE=true</code>). Card checkout is forced
          off regardless of the master switch.
        </div>
      )}

      {data.canImportEnv && canWrite && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base">Import from .env (one-time)</CardTitle>
            <CardDescription>
              Copies legacy PADDLE_*/STRIPE_*/PAYMENTS_ENABLED into encrypted DB
              storage, then env values are ignored at runtime.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Input
              type="password"
              placeholder="Confirm password"
              className="max-w-xs"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button
              size="sm"
              disabled={!password}
              onClick={async () => {
                const res = await fetch("/api/platform/payments", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    action: "import_env",
                    password,
                    reason: "Import from .env",
                  }),
                });
                const json = await res.json();
                if (json.success) {
                  toast.success(
                    `Imported: ${(json.data.imported || []).join(", ") || "nothing"}`
                  );
                  setPassword("");
                  await load();
                } else toast.error(json.error?.message);
              }}
            >
              Import from .env
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-1 border-b pb-2">
        {TABS.map((t) => (
          <Button
            key={t}
            size="sm"
            variant={tab === t ? "default" : "ghost"}
            onClick={() => setTab(t)}
          >
            {t}
          </Button>
        ))}
      </div>

      {tab === "Providers" && (
        <div className="grid gap-4 sm:grid-cols-2">
          {data.providers.map((p) => {
            const Icon = providerIcon(p.provider);
            const configured =
              p.mode === "LIVE" ? p.configuredLive : p.configuredSandbox;
            return (
              <Card key={p.provider}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    {p.displayName}
                  </CardTitle>
                  <CardDescription className="flex flex-wrap gap-1">
                    <Badge variant={p.enabled ? "default" : "secondary"}>
                      {p.enabled ? "Enabled" : "Disabled"}
                    </Badge>
                    <Badge variant="outline">{p.mode}</Badge>
                    <Badge variant="outline">
                      {configured ? "Configured" : "Not configured"}
                    </Badge>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="text-muted-foreground">
                    Active subscriptions: {p.activeSubscriptions}
                    {p.lastWebhookAt
                      ? ` · Last webhook ${new Date(p.lastWebhookAt).toLocaleString()}`
                      : " · No webhooks yet"}
                  </p>
                  {p.webhookUrl && (
                    <p className="font-mono text-xs break-all">{p.webhookUrl}</p>
                  )}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {canWrite && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setDrawer(p);
                            const m =
                              (p.mode as "SANDBOX" | "LIVE") || "SANDBOX";
                            setCredMode(m);
                            setActiveMode(m);
                            setCreds({});
                          }}
                        >
                          Configure
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void testProvider(p.provider)}
                        >
                          Test
                        </Button>
                        {p.webhookUrl && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              void navigator.clipboard.writeText(p.webhookUrl!);
                              toast.success("Webhook URL copied");
                            }}
                          >
                            Copy webhook
                          </Button>
                        )}
                        {(p.provider === "PADDLE" || p.provider === "STRIPE") &&
                          p.enabled && (
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={syncBusy}
                              onClick={() => void syncAll(p.provider)}
                            >
                              Sync packages
                            </Button>
                          )}
                        <Button
                          size="sm"
                          variant={p.enabled ? "destructive" : "default"}
                          onClick={() => {
                            const next = !p.enabled;
                            setConfirm({
                              title: next
                                ? `Enable ${p.displayName}?`
                                : `Disable ${p.displayName}?`,
                              body: next
                                ? "Requires your login password. New checkouts can use this provider when Payments is ON."
                                : p.activeSubscriptions > 0
                                  ? `${p.activeSubscriptions} active subscription(s) keep running and receiving webhooks. New checkouts stop.`
                                  : "Requires your login password.",
                              onConfirm: () => {
                                void updateProvider({
                                  provider: p.provider,
                                  enabled: next,
                                  password: password.trim(),
                                });
                                setConfirm(null);
                              },
                            });
                          }}
                        >
                          {p.enabled ? "Disable" : "Enable"}
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {data.providers.every((p) => !p.enabled) && (
            <p className="text-sm text-muted-foreground sm:col-span-2">
              Connect Paddle in 3 steps: Configure → paste sandbox keys → Test →
              Enable. Then turn the master switch on.
            </p>
          )}
        </div>
      )}

      {tab === "Checkout settings" && (
        <Card>
          <CardHeader>
            <CardTitle>Checkout settings</CardTitle>
            <CardDescription>
              Methods shown to tenants (must also be enabled above).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">
                Default provider for new tenants
              </label>
              <select
                className="border rounded-md h-9 px-2 text-sm"
                disabled={!canWrite}
                value={data.settings.defaultProvider}
                onChange={(e) =>
                  void saveSettings({ defaultProvider: e.target.value })
                }
              >
                {data.providers.map((p) => (
                  <option key={p.provider} value={p.provider}>
                    {p.displayName}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Checkout methods</p>
              {data.allCheckoutMethods.map((m) => {
                const checked = data.settings.checkoutMethods?.includes(m);
                return (
                  <label key={m} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      disabled={!canWrite}
                      checked={!!checked}
                      onChange={(e) => {
                        const next = new Set(data.settings.checkoutMethods || []);
                        if (e.target.checked) next.add(m);
                        else next.delete(m);
                        void saveSettings({
                          checkoutMethods: [...next],
                        });
                      }}
                    />
                    {m}
                  </label>
                );
              })}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="text-xs text-muted-foreground">Currency</label>
                <Input value={data.settings.currency} disabled readOnly />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Grace days</label>
                <Input
                  type="number"
                  disabled={!canWrite}
                  defaultValue={data.settings.graceDays}
                  onBlur={(e) =>
                    void saveSettings({ graceDays: Number(e.target.value) })
                  }
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">
                  Manual renewal lead days
                </label>
                <Input
                  type="number"
                  disabled={!canWrite}
                  defaultValue={data.settings.manualRenewalLeadDays}
                  onBlur={(e) =>
                    void saveSettings({
                      manualRenewalLeadDays: Number(e.target.value),
                    })
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "Manual methods" && (
        <Card>
          <CardHeader>
            <CardTitle>Manual payment instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              placeholder="Payoneer instructions (HTML ok)"
              disabled={!canWrite}
              defaultValue={String(manual.payoneer || "")}
              rows={5}
              id="payoneer-instr"
            />
            <Textarea
              placeholder="Bank transfer instructions (HTML ok)"
              disabled={!canWrite}
              defaultValue={String(manual.bank || "")}
              rows={5}
              id="bank-instr"
            />
            {canWrite && (
              <Button
                onClick={() => {
                  const payoneer = (
                    document.getElementById(
                      "payoneer-instr"
                    ) as HTMLTextAreaElement
                  )?.value;
                  const bank = (
                    document.getElementById("bank-instr") as HTMLTextAreaElement
                  )?.value;
                  void saveSettings({
                    manualInstructions: { payoneer, bank },
                  });
                }}
              >
                Save instructions
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "Business details" && (
        <Card>
          <CardHeader>
            <CardTitle>Delvix business details (invoices)</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Input
              id="biz-name"
              placeholder="Name"
              disabled={!canWrite}
              defaultValue={String(biz.name || "")}
            />
            <Input
              id="biz-email"
              placeholder="Email"
              disabled={!canWrite}
              defaultValue={String(biz.email || "")}
            />
            <Input
              id="biz-tax"
              placeholder="Tax ID"
              disabled={!canWrite}
              defaultValue={String(biz.taxId || "")}
            />
            <Textarea
              id="biz-address"
              className="sm:col-span-2"
              placeholder="Address"
              disabled={!canWrite}
              defaultValue={String(biz.address || "")}
            />
            {canWrite && (
              <Button
                onClick={() =>
                  void saveSettings({
                    business: {
                      name: (
                        document.getElementById("biz-name") as HTMLInputElement
                      )?.value,
                      email: (
                        document.getElementById("biz-email") as HTMLInputElement
                      )?.value,
                      taxId: (
                        document.getElementById("biz-tax") as HTMLInputElement
                      )?.value,
                      address: (
                        document.getElementById(
                          "biz-address"
                        ) as HTMLTextAreaElement
                      )?.value,
                    },
                  })
                }
              >
                Save business details
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "Webhooks & sync" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sync</CardTitle>
              <CardDescription>
                Push all published packages &amp; top-ups to enabled providers.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                disabled={!canWrite || syncBusy}
                onClick={() => void syncAll()}
              >
                {syncBusy ? "Syncing…" : "Sync all published packages & top-ups"}
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                Last webhook:{" "}
                {data.lastWebhook
                  ? `${data.lastWebhook.eventType} (${data.lastWebhook.status})`
                  : "none"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Failed webhooks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {data.failedWebhooks.length === 0 && (
                <p className="text-muted-foreground">None</p>
              )}
              {data.failedWebhooks.map((w) => (
                <div
                  key={w.id}
                  className="border rounded-md p-2 flex justify-between gap-2"
                >
                  <div>
                    <div className="font-mono text-xs">{w.eventType}</div>
                    <div className="text-muted-foreground">{w.error}</div>
                  </div>
                  {canWrite && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        await fetch("/api/platform/payments", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            action: "retry_webhook",
                            eventId: w.eventId,
                          }),
                        });
                        await load();
                      }}
                    >
                      Retry
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Unmatched queue</CardTitle>
              <CardDescription>
                Search organization by name, then Link.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Input
                placeholder="Search org name…"
                value={orgQuery}
                onChange={(e) => void searchOrgs(e.target.value)}
              />
              {orgResults.length > 0 && (
                <ul className="border rounded-md divide-y max-h-40 overflow-auto">
                  {orgResults.map((o) => (
                    <li key={o.id}>
                      <button
                        type="button"
                        className="w-full text-left px-2 py-1.5 hover:bg-muted"
                        onClick={() => setLinkOrgId(o.id)}
                      >
                        {o.name}{" "}
                        <span className="text-muted-foreground font-mono text-xs">
                          {o.slug}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {linkOrgId && (
                <p className="text-xs font-mono">Selected: {linkOrgId}</p>
              )}
              {data.unmatchedWebhooks.length === 0 && (
                <p className="text-muted-foreground">None</p>
              )}
              {data.unmatchedWebhooks.map((w) => (
                <div
                  key={w.id}
                  className="border rounded-md p-2 flex justify-between gap-2"
                >
                  <div>
                    <div className="font-mono text-xs">{w.eventType}</div>
                    <div className="text-muted-foreground">{w.error}</div>
                  </div>
                  {canWrite && (
                    <Button
                      size="sm"
                      disabled={!linkOrgId}
                      onClick={async () => {
                        const res = await fetch("/api/platform/payments", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            action: "link_unmatched",
                            eventId: w.eventId,
                            organizationId: linkOrgId,
                          }),
                        });
                        const json = await res.json();
                        if (json.success) toast.success("Linked");
                        else toast.error(json.error?.message);
                        await load();
                      }}
                    >
                      Link
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {canWrite && (
        <div className="flex flex-wrap gap-2 items-end border-t pt-4">
          <Input
            type="password"
            placeholder="Password (required for provider / switch changes)"
            className="max-w-xs"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Input
            placeholder="Reason"
            className="max-w-xs"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
      )}

      <Sheet open={!!drawer} onOpenChange={(o) => !o && setDrawer(null)}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Configure {drawer?.displayName}</SheetTitle>
            <SheetDescription>
              Credentials are write-only. Existing values show as masks. Never
              logged.
            </SheetDescription>
          </SheetHeader>
          {drawer && (
            <div className="mt-4 space-y-3">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={credMode === "SANDBOX" ? "default" : "outline"}
                  onClick={() => setCredMode("SANDBOX")}
                >
                  Sandbox{" "}
                  {drawer.sandboxHint ? `(${drawer.sandboxHint})` : ""}
                </Button>
                <Button
                  size="sm"
                  variant={credMode === "LIVE" ? "default" : "outline"}
                  onClick={() => setCredMode("LIVE")}
                >
                  Live {drawer.liveHint ? `(${drawer.liveHint})` : ""}
                </Button>
              </div>
              <select
                className="border rounded-md h-9 px-2 text-sm w-full"
                value={activeMode}
                onChange={(e) =>
                  setActiveMode(e.target.value as "SANDBOX" | "LIVE")
                }
              >
                <option value="SANDBOX">Active mode: SANDBOX</option>
                <option value="LIVE">Active mode: LIVE</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Mode and keys are saved together when you click Save below.
              </p>
              {(drawer.provider === "PADDLE"
                ? ["apiKey", "clientToken", "webhookSecret"]
                : drawer.provider === "STRIPE"
                  ? ["secretKey", "publishableKey", "webhookSecret"]
                  : []
              ).map((key) => (
                <div key={key} className="space-y-1">
                  <label className="text-xs text-muted-foreground">{key}</label>
                  <Input
                    type="password"
                    autoComplete="off"
                    placeholder={
                      (credMode === "LIVE"
                        ? drawer.liveHint
                        : drawer.sandboxHint) || "Paste new value to replace"
                    }
                    value={creds[key] || ""}
                    onChange={(e) =>
                      setCreds({ ...creds, [key]: e.target.value })
                    }
                  />
                </div>
              ))}
              {drawer.provider.startsWith("MANUAL") && (
                <p className="text-sm text-muted-foreground">
                  Manual providers use invoice instructions (Manual methods
                  tab). No API keys.
                </p>
              )}
              <div className="border-t pt-3 space-y-2">
                <p className="text-xs text-muted-foreground">
                  Enter your Super Admin login password to save (required for
                  security).
                </p>
                <Input
                  type="password"
                  autoComplete="current-password"
                  placeholder="Your login password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <Input
                  placeholder="Reason (optional)"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
                <Button
                  className="w-full"
                  disabled={!password.trim()}
                  onClick={() => {
                    void updateProvider({
                      provider: drawer.provider,
                      mode: activeMode,
                      credentialsMode: credMode,
                      credentials: creds,
                      password: password.trim(),
                    }).then((ok) => {
                      if (ok) {
                        setDrawer(null);
                        void load();
                      }
                    });
                  }}
                >
                  Save
                </Button>
                {!password && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Save stays disabled until you type your password above.
                  </p>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirm?.title}</DialogTitle>
            <DialogDescription>{confirm?.body}</DialogDescription>
          </DialogHeader>
          <Input
            type="password"
            placeholder="Confirm password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              disabled={!password}
              onClick={() => confirm?.onConfirm()}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
