"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
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

type BillingDetail = {
  organization: {
    id: string;
    name: string;
    billingEmail: string | null;
    billingContactName: string | null;
    billingProvider: string | null;
    paddleCustomerId: string | null;
    paddleCustomerEnv: string | null;
    stripeCustomerId: string | null;
    creditBalanceCached: number;
  };
  subscription: {
    status: string;
    provider: string | null;
    providerEnvironment: string | null;
    billingInterval: string | null;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    externalSubscriptionId: string | null;
    externalCustomerId: string | null;
    planVersion?: {
      version: number;
      plan?: { name: string; code: string };
    } | null;
  } | null;
  invoices: Array<{
    id: string;
    number: string;
    status: string;
    total: string | number;
    provider: string;
  }>;
  creditLedger: Array<{
    id: string;
    type: string;
    amount: number;
    reason: string | null;
    createdAt: string;
  }>;
  transactions: Array<{
    id: string;
    kind: string;
    amount: string | number;
    status: string;
    provider: string;
    environment: string;
    occurredAt: string;
    externalId: string | null;
  }>;
  paddleCustomerEmail: string | null;
  links: {
    paddleCustomer: string | null;
    paddleSubscription: string | null;
  };
};

export function TenantBillingTab({
  organizationId,
  canWrite,
}: {
  organizationId: string;
  canWrite: boolean;
}) {
  const [data, setData] = useState<BillingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/platform/organizations/${organizationId}/billing-detail`
      );
      const json = await res.json();
      if (json.success) setData(json.data);
      else toast.error(json.error?.message || "Failed to load billing");
    } catch {
      toast.error("Failed to load billing");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runAction(
    action: string,
    extra?: Record<string, unknown>
  ) {
    if (!reason.trim()) {
      toast.error("Reason required for audit log");
      return;
    }
    setBusy(action);
    try {
      const res = await fetch(
        `/api/platform/organizations/${organizationId}/billing-detail`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, reason, ...extra }),
        }
      );
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || "Failed");
      toast.success("Done");
      setReason("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading billing…</p>;
  }
  if (!data) {
    return <p className="text-sm text-muted-foreground">No billing data</p>;
  }

  const sub = data.subscription;
  const org = data.organization;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Subscription</CardTitle>
          <CardDescription>
            Provider IDs and period — links open Paddle vendor dashboard
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <span className="text-muted-foreground">Plan</span>
            <p className="font-medium">
              {sub?.planVersion?.plan?.name || "—"}{" "}
              {sub?.planVersion ? `(v${sub.planVersion.version})` : ""}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Status</span>
            <p>
              <Badge>{sub?.status || "NONE"}</Badge>
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Provider / env</span>
            <p className="font-medium">
              {sub?.provider || org.billingProvider || "—"} ·{" "}
              {sub?.providerEnvironment || "—"}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Period</span>
            <p className="font-medium">
              {sub?.currentPeriodStart
                ? new Date(sub.currentPeriodStart).toLocaleDateString()
                : "—"}{" "}
              →{" "}
              {sub?.currentPeriodEnd
                ? new Date(sub.currentPeriodEnd).toLocaleDateString()
                : "—"}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Billing email</span>
            <p className="font-medium">{org.billingEmail || "—"}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Paddle customer email</span>
            <p className="font-medium">
              {data.paddleCustomerEmail || "—"}
              {data.paddleCustomerEmail &&
                org.billingEmail &&
                data.paddleCustomerEmail.toLowerCase() !==
                  org.billingEmail.toLowerCase() && (
                  <Badge variant="destructive" className="ml-2">
                    mismatch
                  </Badge>
                )}
            </p>
          </div>
          <div className="sm:col-span-2 flex flex-wrap gap-3 text-sm">
            {data.links.paddleCustomer && (
              <a
                className="underline"
                href={data.links.paddleCustomer}
                target="_blank"
                rel="noreferrer"
              >
                Paddle customer
              </a>
            )}
            {data.links.paddleSubscription && (
              <a
                className="underline"
                href={data.links.paddleSubscription}
                target="_blank"
                rel="noreferrer"
              >
                Paddle subscription
              </a>
            )}
            <span className="text-muted-foreground font-mono text-xs">
              cust={org.paddleCustomerId || "—"} · sub=
              {sub?.externalSubscriptionId || "—"}
            </span>
          </div>
        </CardContent>
      </Card>

      {canWrite && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Actions</CardTitle>
            <CardDescription>All actions are audit-logged</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Reason (required)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={!!busy}
                onClick={() => void runAction("resync_paddle")}
              >
                Resync from Paddle
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!!busy}
                onClick={() =>
                  void runAction("change_provider", {
                    provider: "MANUAL_PAYONEER",
                  })
                }
              >
                Switch to Payoneer
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!!busy}
                onClick={() =>
                  void runAction("record_refund", { amount: 0 })
                }
              >
                Record refund
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Transactions ({data.transactions.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-64 space-y-1 overflow-y-auto text-xs">
            {data.transactions.length === 0 ? (
              <p className="text-muted-foreground">None yet</p>
            ) : (
              data.transactions.map((t) => (
                <div key={t.id} className="rounded border px-2 py-1">
                  {new Date(t.occurredAt).toLocaleDateString()} · {t.kind} ·{" "}
                  {t.provider} · {String(t.amount)} · {t.status}
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Invoices ({data.invoices.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-64 space-y-1 overflow-y-auto text-xs">
            {data.invoices.length === 0 ? (
              <p className="text-muted-foreground">None yet</p>
            ) : (
              data.invoices.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between rounded border px-2 py-1"
                >
                  <span>
                    {inv.number} · {inv.provider} · {String(inv.total)}
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{inv.status}</Badge>
                    {canWrite &&
                      (inv.status === "OPEN" || inv.status === "OVERDUE") && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={!!busy}
                          onClick={() =>
                            void runAction("mark_invoice_paid", {
                              invoiceId: inv.id,
                            })
                          }
                        >
                          Mark paid
                        </Button>
                      )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">
              Credit ledger (balance {org.creditBalanceCached})
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-48 space-y-1 overflow-y-auto text-xs">
            {data.creditLedger.map((e) => (
              <div key={e.id} className="rounded border px-2 py-1">
                {new Date(e.createdAt).toLocaleString()} · {e.type} ·{" "}
                {e.amount} {e.reason ? `— ${e.reason}` : ""}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
