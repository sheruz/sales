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
  stripeConfigured: boolean;
};

export function BillingPanel() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [billing, setBilling] = useState<BillingSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [plansRes, billingRes] = await Promise.all([
        fetch("/api/plans"),
        fetch("/api/billing"),
      ]);
      const plansJson = await plansRes.json();
      const billingJson = await billingRes.json();
      if (plansJson.success) setPlans(plansJson.data);
      if (billingJson.success) setBilling(billingJson.data);
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

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading billing…</p>;
  }

  return (
    <div className="space-y-6">
      {billing && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Current plan</CardTitle>
            <CardDescription>
              Server-enforced entitlements for this organization
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-semibold">
                {billing.subscription.planName}
              </span>
              <Badge variant="secondary">{billing.subscription.status}</Badge>
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

            {billing.stripeConfigured &&
              billing.subscription.provider === "stripe" && (
                <Button
                  variant="outline"
                  onClick={() => void openPortal()}
                  disabled={busy === "portal"}
                >
                  Manage billing in Stripe
                </Button>
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
