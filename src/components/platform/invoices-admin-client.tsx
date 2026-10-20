"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Invoice = {
  id: string;
  number: string;
  status: string;
  provider: string;
  total: string | number;
  currency: string;
  organization: { name: string };
  paymentUrl: string | null;
};

export function InvoicesAdminClient({ canWrite }: { canWrite: boolean }) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [status, setStatus] = useState("");
  const [paymentUrl, setPaymentUrl] = useState("");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const sp = status ? `?status=${status}` : "";
    const res = await fetch(`/api/platform/invoices${sp}`);
    const json = await res.json();
    if (json.success) setInvoices(json.data.invoices);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function markPaid(id: string, amount: number) {
    const res = await fetch("/api/platform/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "mark_paid",
        invoiceId: id,
        amount,
        method: "manual",
        reason: reason || "Mark paid",
      }),
    });
    const json = await res.json();
    setMsg(json.success ? "Marked paid" : json.error?.message);
    await load();
  }

  async function setUrl(id: string) {
    const res = await fetch("/api/platform/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "set_payment_url",
        invoiceId: id,
        paymentUrl,
        reason: reason || "Set Payoneer URL",
      }),
    });
    const json = await res.json();
    setMsg(json.success ? "URL saved" : json.error?.message);
    await load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Invoices & payments</h2>
        <p className="text-sm text-muted-foreground">
          All tenants · mark paid never available to tenants
        </p>
      </div>
      {msg && <p className="text-sm">{msg}</p>}
      <div className="flex gap-2">
        <select
          className="border rounded-md h-9 px-2 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All</option>
          <option value="OPEN">OPEN</option>
          <option value="OVERDUE">OVERDUE</option>
          <option value="PAID">PAID</option>
          <option value="VOID">VOID</option>
        </select>
        {canWrite && (
          <>
            <Input
              className="max-w-xs"
              placeholder="Payoneer payment URL"
              value={paymentUrl}
              onChange={(e) => setPaymentUrl(e.target.value)}
            />
            <Input
              className="max-w-xs"
              placeholder="Reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </>
        )}
      </div>
      <div className="space-y-3">
        {invoices.map((inv) => (
          <Card key={inv.id}>
            <CardHeader className="py-3">
              <CardTitle className="text-base flex flex-wrap gap-2 justify-between">
                <span>
                  {inv.number} · {inv.organization.name}
                </span>
                <span className="text-sm font-normal">
                  {inv.status} · {inv.provider} · {inv.currency}{" "}
                  {String(inv.total)}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  window.open(`/api/billing/invoices/${inv.id}/html`, "_blank")
                }
              >
                View invoice
              </Button>
              {canWrite && inv.status !== "PAID" && inv.status !== "VOID" && (
                <>
                  <Button
                    size="sm"
                    onClick={() => void markPaid(inv.id, Number(inv.total))}
                  >
                    Mark paid
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void setUrl(inv.id)}
                  >
                    Set payment URL
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
