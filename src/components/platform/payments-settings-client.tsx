"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function PaymentsSettingsClient({ canWrite }: { canWrite: boolean }) {
  const [data, setData] = useState<{
    paymentsEnabled: boolean;
    paddle: {
      configured: boolean;
      environment: string;
      webhookUrl: string;
    };
    lastWebhook: { eventType: string; status: string; createdAt: string } | null;
    failedWebhooks: Array<{
      id: string;
      eventId: string;
      eventType: string;
      status: string;
      error: string | null;
    }>;
    business: {
      name?: string;
      address?: string;
      email?: string;
      taxId?: string;
    };
    manualInstructions: { payoneer: string; bank: string };
  } | null>(null);
  const [reason, setReason] = useState("");
  const [linkOrgId, setLinkOrgId] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [biz, setBiz] = useState({
    name: "",
    address: "",
    email: "",
    taxId: "",
    payoneer: "",
    bank: "",
  });

  async function load() {
    const res = await fetch("/api/platform/payments");
    const json = await res.json();
    if (json.success) {
      setData(json.data);
      setBiz({
        name: json.data.business?.name || "",
        address: json.data.business?.address || "",
        email: json.data.business?.email || "",
        taxId: json.data.business?.taxId || "",
        payoneer: json.data.manualInstructions?.payoneer || "",
        bank: json.data.manualInstructions?.bank || "",
      });
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save() {
    const res = await fetch("/api/platform/payments", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessName: biz.name,
        businessAddress: biz.address,
        businessEmail: biz.email,
        taxId: biz.taxId,
        payoneerInstructions: biz.payoneer,
        bankInstructions: biz.bank,
        reason: reason || "Update payments settings",
      }),
    });
    const json = await res.json();
    setMsg(json.success ? "Saved" : json.error?.message);
    await load();
  }

  async function testConnection() {
    const res = await fetch("/api/platform/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "test_connection" }),
    });
    const json = await res.json();
    setMsg(json.data?.message || json.error?.message);
  }

  async function retry(eventId: string) {
    await fetch("/api/platform/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "retry_webhook", eventId }),
    });
    await load();
  }

  async function linkUnmatched(eventId: string) {
    if (!linkOrgId.trim()) {
      setMsg("Enter organization UUID to link");
      return;
    }
    const res = await fetch("/api/platform/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "link_unmatched",
        eventId,
        organizationId: linkOrgId.trim(),
      }),
    });
    const json = await res.json();
    setMsg(json.success ? "Linked + reprocessed" : json.error?.message);
    await load();
  }

  if (!data) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Payments</h2>
        <p className="text-muted-foreground text-sm">
          Paddle + manual Payoneer/bank. Keys stay in server .env only.
        </p>
      </div>
      {msg && <p className="text-sm">{msg}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Status</CardTitle>
          <CardDescription>
            PAYMENTS_ENABLED={String(data.paymentsEnabled)} (env flag)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            Paddle:{" "}
            {data.paddle.configured ? "configured" : "not configured"} ·{" "}
            {data.paddle.environment}
          </p>
          <p className="font-mono text-xs break-all">
            Webhook URL (paste in Paddle):
            <br />
            {data.paddle.webhookUrl}
          </p>
          <p>
            Last webhook:{" "}
            {data.lastWebhook
              ? `${data.lastWebhook.eventType} (${data.lastWebhook.status}) ${new Date(data.lastWebhook.createdAt).toLocaleString()}`
              : "none yet"}
          </p>
          {canWrite && (
            <Button size="sm" onClick={() => void testConnection()}>
              Test connection
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Failed / unmatched webhooks</CardTitle>
          <CardDescription>
            Unmatched = no org in custom_data. Paste org UUID then Link.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {canWrite && (
            <Input
              placeholder="Organization UUID for Link"
              value={linkOrgId}
              onChange={(e) => setLinkOrgId(e.target.value)}
            />
          )}
          {data.failedWebhooks.length === 0 && (
            <p className="text-muted-foreground">None</p>
          )}
          {data.failedWebhooks.map((w) => (
            <div key={w.id} className="border rounded-md p-2 flex justify-between gap-2">
              <div>
                <div className="font-mono text-xs">{w.eventType}</div>
                <div className="text-muted-foreground">{w.status}: {w.error}</div>
              </div>
              {canWrite && (
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => void retry(w.eventId)}>
                    Retry
                  </Button>
                  {w.status === "unmatched" && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void linkUnmatched(w.eventId)}
                    >
                      Link
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Delvix business details (invoices)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Input
            placeholder="Name"
            value={biz.name}
            disabled={!canWrite}
            onChange={(e) => setBiz({ ...biz, name: e.target.value })}
          />
          <Input
            placeholder="Email"
            value={biz.email}
            disabled={!canWrite}
            onChange={(e) => setBiz({ ...biz, email: e.target.value })}
          />
          <Input
            placeholder="Tax ID (optional)"
            value={biz.taxId}
            disabled={!canWrite}
            onChange={(e) => setBiz({ ...biz, taxId: e.target.value })}
          />
          <Textarea
            className="sm:col-span-2"
            placeholder="Address"
            value={biz.address}
            disabled={!canWrite}
            onChange={(e) => setBiz({ ...biz, address: e.target.value })}
          />
          <Textarea
            className="sm:col-span-2"
            placeholder="Payoneer payment instructions"
            value={biz.payoneer}
            disabled={!canWrite}
            onChange={(e) => setBiz({ ...biz, payoneer: e.target.value })}
          />
          <Textarea
            className="sm:col-span-2"
            placeholder="Bank transfer instructions"
            value={biz.bank}
            disabled={!canWrite}
            onChange={(e) => setBiz({ ...biz, bank: e.target.value })}
          />
          {canWrite && (
            <>
              <Input
                placeholder="Reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <Button onClick={() => void save()}>Save</Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
