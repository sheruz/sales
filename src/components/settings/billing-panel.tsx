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
import { Badge } from "@/components/ui/badge";

type Plan = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  billingInterval: string;
  isDefault: boolean;
  features: Array<{
    featureKey: string;
    limitValue: number | null;
    enabled: boolean;
  }>;
};

type BillingSnapshot = {
  subscription: {
    id: string;
    status: string;
    planId: string;
    planName: string;
    price: number;
    currency: string;
    billingInterval: string;
    cancelAtPeriodEnd: boolean;
    provider: string;
  };
  entitlements: Array<{
    featureKey: string;
    enabled: boolean;
    limit: number | null;
    used: number | null;
    remaining: number | null;
  }>;
  shadowWouldBlocks?: Array<{
    id: string;
    metric: string;
    quantity: number;
    createdAt: string;
    reason: string | null;
    purpose: string | null;
  }>;
  meteringEnabled?: boolean;
  enforcementEnabled?: boolean;
  orgBillingEnforcementEnabled?: boolean;
  enforcementEnvWarning?: string | null;
  credits?: {
    balance: number;
    isOwner: boolean;
    unlimited?: boolean;
    consumedThisMonth: Array<{ actionType: string; credits: number }>;
    warnings: {
      at20: string | null;
      at5: string | null;
      at0: string | null;
    };
  };
  stripeConfigured: boolean;
};

type LedgerEntry = {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  actionType: string | null;
  reason: string | null;
  createdAt: string;
};

type TopUpPack = {
  id: string;
  name: string;
  credits: number;
  price: string | number;
  currency: string;
};

export function BillingPanel() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [billing, setBilling] = useState<BillingSnapshot | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [topUpPacks, setTopUpPacks] = useState<TopUpPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [plansRes, billingRes, creditsRes, packsRes] = await Promise.all([
        fetch("/api/plans"),
        fetch("/api/billing"),
        fetch("/api/billing/credits?take=30"),
        fetch("/api/billing/top-up-packs"),
      ]);
      const plansJson = await plansRes.json();
      const packsJson = await packsRes.json();
      if (packsJson.success) {
        setTopUpPacks(packsJson.data.packs || []);
      }
      const billingJson = await billingRes.json();
      const creditsJson = await creditsRes.json();
      if (plansJson.success) setPlans(plansJson.data);
      if (billingJson.success) setBilling(billingJson.data);
      if (creditsJson.success) setLedger(creditsJson.data.ledger ?? []);
    } catch {
      toast.error("Failed to load billing");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function selectPlan(planId: string) {
    setBusy(planId);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Checkout failed");
        return;
      }
      if (json.data.mode === "checkout" && json.data.url) {
        window.location.href = json.data.url;
        return;
      }
      toast.success(
        json.data.mode === "free"
          ? "Switched to Free plan"
          : "Plan updated"
      );
      await load();
    } catch {
      toast.error("Checkout failed");
    } finally {
      setBusy(null);
    }
  }

  async function openPortal() {
    setBusy("portal");
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Portal unavailable");
        return;
      }
      if (json.data.url) window.location.href = json.data.url;
    } catch {
      toast.error("Portal unavailable");
    } finally {
      setBusy(null);
    }
  }

  async function cancelAtPeriodEnd() {
    setBusy("cancel");
    try {
      const res = await fetch("/api/billing/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", atPeriodEnd: true }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Cancel failed");
        return;
      }
      toast.success("Cancellation scheduled at period end");
      await load();
    } catch {
      toast.error("Cancel failed");
    } finally {
      setBusy(null);
    }
  }

  async function resumeSubscription() {
    setBusy("resume");
    try {
      const res = await fetch("/api/billing/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resume" }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Resume failed");
        return;
      }
      toast.success("Cancellation cleared");
      await load();
    } catch {
      toast.error("Resume failed");
    } finally {
      setBusy(null);
    }
  }

  async function buyTopUp(packId: string) {
    setBusy(packId);
    try {
      const res = await fetch("/api/billing/top-up/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topUpPackId: packId }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Top-up checkout failed");
        return;
      }
      if (json.data.mode === "manual_invoice") {
        toast.success("Invoice created — check Billing / contact Delvix");
        await load();
        return;
      }
      const { transactionId, clientToken } = json.data;
      const { loadPaddleJs } = await import("@/lib/billing/load-paddle-js");
      const Paddle = await loadPaddleJs();
      Paddle.Environment.set(
        process.env.NEXT_PUBLIC_PADDLE_ENV === "production"
          ? "production"
          : "sandbox"
      );
      Paddle.Initialize({ token: clientToken });
      Paddle.Checkout.open({
        transactionId,
        settings: { locale: "en" },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Top-up failed");
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading billing…</p>;
  }

  const credits = billing?.credits;
  const outOfCredits =
    Boolean(billing?.orgBillingEnforcementEnabled) &&
    credits != null &&
    !credits.isOwner &&
    credits.balance <= 0;

  return (
    <div className="space-y-6">
      {outOfCredits && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          Out of credits — Autopilot credit-consuming jobs are paused until you
          add credits. Inbound replies are still processed and held for you.
        </div>
      )}

      {billing && credits && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Credits</CardTitle>
            <CardDescription>
              {credits.isOwner
                ? "Owner workspace — credits are not consumed (usage recorded for stats only)."
                : billing.orgBillingEnforcementEnabled
                  ? "Enforcement on for this workspace: jobs pause at 0 credits."
                  : "Credits are metered; enforcement is off for this workspace."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="text-3xl font-semibold tabular-nums">
                {credits.unlimited || credits.isOwner
                  ? "Unlimited"
                  : credits.balance}
              </span>
              <span className="text-sm text-muted-foreground">
                {credits.unlimited || credits.isOwner
                  ? "platform owner"
                  : "balance"}
              </span>
              {credits.balance < 0 && !credits.isOwner && (
                <Badge variant="destructive">Negative balance</Badge>
              )}
              {credits.warnings.at0 && (
                <Badge variant="destructive">0 credits</Badge>
              )}
              {!credits.warnings.at0 && credits.warnings.at5 && (
                <Badge variant="outline">≤5%</Badge>
              )}
              {!credits.warnings.at0 &&
                !credits.warnings.at5 &&
                credits.warnings.at20 && (
                  <Badge variant="outline">≤20%</Badge>
                )}
            </div>
            {credits.consumedThisMonth.length > 0 && (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {credits.consumedThisMonth.map((row) => (
                  <div
                    key={row.actionType}
                    className="rounded-md border px-3 py-2 text-sm"
                  >
                    <div className="font-medium">{row.actionType}</div>
                    <div className="text-muted-foreground">
                      {row.credits} this month
                    </div>
                  </div>
                ))}
              </div>
            )}
            {ledger.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Recent ledger</h4>
                <ul className="max-h-56 space-y-1 overflow-y-auto text-xs">
                  {ledger.map((e) => (
                    <li
                      key={e.id}
                      className="flex flex-wrap items-center gap-2 rounded border px-2 py-1"
                    >
                      <Badge variant="outline">{e.type}</Badge>
                      <span
                        className={
                          e.amount < 0
                            ? "text-red-600 tabular-nums"
                            : e.amount > 0
                              ? "text-emerald-700 tabular-nums"
                              : "tabular-nums"
                        }
                      >
                        {e.amount > 0 ? `+${e.amount}` : e.amount}
                      </span>
                      <span className="text-muted-foreground">
                        bal {e.balanceAfter}
                      </span>
                      {e.actionType && (
                        <span className="text-muted-foreground">
                          {e.actionType}
                        </span>
                      )}
                      <span className="ml-auto text-muted-foreground">
                        {new Date(e.createdAt).toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {topUpPacks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Credit top-up packs</CardTitle>
            <CardDescription>
              Buy credits via Paddle (when payments are enabled) or request a
              manual invoice.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            {topUpPacks.map((p) => (
              <div
                key={p.id}
                className="rounded-md border px-3 py-3 text-sm space-y-2"
              >
                <div className="font-medium">{p.name}</div>
                <div className="text-muted-foreground">
                  {p.credits.toLocaleString()} credits · {p.currency}{" "}
                  {String(p.price)}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy === p.id}
                  onClick={() => void buyTopUp(p.id)}
                >
                  {busy === p.id ? "…" : "Buy"}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {billing && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Plan &amp; usage</CardTitle>
            <CardDescription>
              Limits and usage for this workspace.
              {billing.enforcementEnabled
                ? " Enforcement is on."
                : " Shadow mode: over-limit actions are logged, not blocked."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-semibold">
                {billing.subscription.planName}
              </span>
              <Badge variant="secondary">{billing.subscription.status}</Badge>
              {!billing.enforcementEnabled && (
                <Badge variant="outline">Shadow metering</Badge>
              )}
              {billing.subscription.cancelAtPeriodEnd && (
                <Badge variant="outline">Cancels at period end</Badge>
              )}
              <span className="text-sm text-muted-foreground">
                {billing.subscription.price === 0
                  ? "Free"
                  : `${billing.subscription.currency} ${billing.subscription.price}/${billing.subscription.billingInterval.toLowerCase()}`}
              </span>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {billing.entitlements.map((e) => (
                <div
                  key={e.featureKey}
                  className="rounded-md border px-3 py-2 text-sm"
                >
                  <div className="font-medium">{e.featureKey}</div>
                  <div className="text-muted-foreground">
                    {!e.enabled
                      ? "Not included"
                      : e.limit == null
                        ? e.used == null
                          ? "Enabled"
                          : `${e.used} used (unlimited)`
                        : `${e.used ?? 0} / ${e.limit}`}
                  </div>
                </div>
              ))}
            </div>

            {billing.shadowWouldBlocks &&
              billing.shadowWouldBlocks.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">
                    Shadow would-blocks (not enforced)
                  </h4>
                  <ul className="max-h-48 space-y-1 overflow-y-auto text-xs text-muted-foreground">
                    {billing.shadowWouldBlocks.map((b) => (
                      <li key={b.id} className="rounded border px-2 py-1">
                        <span className="font-medium text-foreground">
                          {b.metric}
                        </span>
                        {b.purpose ? ` · ${b.purpose}` : ""}
                        {b.reason ? ` — ${b.reason}` : ""}
                        <span className="ml-1 opacity-70">
                          {new Date(b.createdAt).toLocaleString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            {billing.subscription.provider === "PADDLE" &&
              billing.subscription.status === "ACTIVE" && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => void openPortal()}
                    disabled={busy === "portal"}
                  >
                    Manage payment method
                  </Button>
                  {billing.subscription.cancelAtPeriodEnd ? (
                    <Button
                      variant="outline"
                      onClick={() => void resumeSubscription()}
                      disabled={busy === "resume"}
                    >
                      Resume subscription
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      onClick={() => void cancelAtPeriodEnd()}
                      disabled={busy === "cancel"}
                    >
                      Cancel at period end
                    </Button>
                  )}
                </div>
              )}
          </CardContent>
        </Card>
      )}

      <div>
        <h3 className="mb-3 text-sm font-medium">Available plans</h3>
        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((plan) => {
            const current = billing?.subscription.planId === plan.id;
            return (
              <Card key={plan.id} className={current ? "border-primary" : ""}>
                <CardHeader>
                  <CardTitle className="text-base">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-2xl font-semibold">
                    {plan.price === 0
                      ? "Free"
                      : `$${plan.price}`}
                    {plan.price > 0 && (
                      <span className="text-sm font-normal text-muted-foreground">
                        /mo
                      </span>
                    )}
                  </p>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {plan.features
                      .filter((f) => f.enabled)
                      .slice(0, 6)
                      .map((f) => (
                        <li key={f.featureKey}>
                          {f.featureKey}
                          {f.limitValue != null ? `: ${f.limitValue}` : ""}
                        </li>
                      ))}
                  </ul>
                  <Button
                    className="w-full"
                    variant={current ? "secondary" : "default"}
                    disabled={current || busy === plan.id}
                    onClick={() => void selectPlan(plan.id)}
                  >
                    {current
                      ? "Current plan"
                      : plan.price === 0
                        ? "Downgrade to Free"
                        : "Upgrade"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
