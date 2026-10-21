"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type Transport = {
  provider: "RESEND" | "SMTP";
  fromEmail: string | null;
  fromName: string | null;
  replyTo: string | null;
  domain: string | null;
  resendConfigured: boolean;
  resendHint: string | null;
  smtpConfigured: boolean;
};

type Dns = {
  domain: string;
  spf: { ok: boolean; records: string[] };
  dkim: { ok: boolean; selectorsChecked: string[]; records: string[] };
  mx: { ok: boolean; records: string[] };
};

export function PlatformEmailTransportPanel({
  canWrite,
}: {
  canWrite: boolean;
}) {
  const [transport, setTransport] = useState<Transport | null>(null);
  const [dns, setDns] = useState<Dns | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/platform/email-transport");
    const json = await res.json();
    if (json.success) {
      setTransport(json.data.transport);
      setDns(json.data.dns);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(patch: Record<string, unknown>) {
    if (!canWrite) return;
    setBusy(true);
    try {
      const res = await fetch("/api/platform/email-transport", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = await res.json();
      if (json.success) {
        setTransport(json.data.transport);
        setDns(json.data.dns);
        setApiKey("");
        toast.success("Platform email settings saved");
      } else {
        toast.error(json.error?.message || "Save failed");
      }
    } finally {
      setBusy(false);
    }
  }

  async function runDnsCheck() {
    setBusy(true);
    try {
      const res = await fetch("/api/platform/email-transport", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: transport?.domain || undefined }),
      });
      const json = await res.json();
      if (json.success) {
        setDns(json.data.dns);
        toast.success("DNS check complete");
      } else {
        toast.error(json.error?.message || "DNS check failed");
      }
    } finally {
      setBusy(false);
    }
  }

  if (!transport) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Platform email</CardTitle>
        <CardDescription>
          Transactional provider for lifecycle emails (Resend preferred, SMTP
          fallback). Never uses tenant mailboxes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant={transport.resendConfigured ? "default" : "secondary"}>
            Resend {transport.resendConfigured ? "configured" : "not set"}
          </Badge>
          <Badge variant={transport.smtpConfigured ? "default" : "secondary"}>
            SMTP {transport.smtpConfigured ? "env ready" : "not set"}
          </Badge>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Provider</label>
            <select
              className="border rounded-md h-9 px-2 text-sm w-full"
              disabled={!canWrite || busy}
              value={transport.provider}
              onChange={(e) =>
                void save({ provider: e.target.value as "RESEND" | "SMTP" })
              }
            >
              <option value="RESEND">Resend</option>
              <option value="SMTP">SMTP (fallback)</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">From email</label>
            <Input
              disabled={!canWrite || busy}
              defaultValue={transport.fromEmail || ""}
              placeholder="noreply@yourdomain.com"
              onBlur={(e) => {
                if (e.target.value !== (transport.fromEmail || "")) {
                  void save({ fromEmail: e.target.value || null });
                }
              }}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">From name</label>
            <Input
              disabled={!canWrite || busy}
              defaultValue={transport.fromName || ""}
              onBlur={(e) => {
                if (e.target.value !== (transport.fromName || "")) {
                  void save({ fromName: e.target.value || null });
                }
              }}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Reply-To</label>
            <Input
              disabled={!canWrite || busy}
              defaultValue={transport.replyTo || ""}
              onBlur={(e) => {
                if (e.target.value !== (transport.replyTo || "")) {
                  void save({ replyTo: e.target.value || null });
                }
              }}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">
              Sending domain (DNS)
            </label>
            <Input
              disabled={!canWrite || busy}
              defaultValue={transport.domain || ""}
              placeholder="mail.yourdomain.com"
              onBlur={(e) => {
                if (e.target.value !== (transport.domain || "")) {
                  void save({ domain: e.target.value || null, checkDns: true });
                }
              }}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">
              Resend API key{" "}
              {transport.resendHint ? `(${transport.resendHint})` : ""}
            </label>
            <div className="flex gap-2">
              <Input
                type="password"
                disabled={!canWrite || busy}
                value={apiKey}
                placeholder={
                  transport.resendConfigured ? "•••• leave blank to keep" : "re_…"
                }
                onChange={(e) => setApiKey(e.target.value)}
              />
              <Button
                type="button"
                disabled={!canWrite || busy || !apiKey.trim()}
                onClick={() => void save({ resendApiKey: apiKey.trim() })}
              >
                Save key
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={busy || !transport.domain}
            onClick={() => void runDnsCheck()}
          >
            Check SPF / DKIM
          </Button>
        </div>

        {dns ? (
          <div className="rounded-md border p-3 text-sm space-y-2">
            <p className="font-medium">DNS — {dns.domain}</p>
            <p>
              SPF:{" "}
              <Badge variant={dns.spf.ok ? "default" : "destructive"}>
                {dns.spf.ok ? "OK" : "Missing"}
              </Badge>
            </p>
            <p>
              DKIM:{" "}
              <Badge variant={dns.dkim.ok ? "default" : "destructive"}>
                {dns.dkim.ok ? "OK" : "Not found"}
              </Badge>
              {dns.dkim.records[0] ? (
                <span className="text-xs text-muted-foreground ml-2">
                  {dns.dkim.records[0]}
                </span>
              ) : null}
            </p>
            <p>
              MX:{" "}
              <Badge variant={dns.mx.ok ? "default" : "secondary"}>
                {dns.mx.ok ? "OK" : "None"}
              </Badge>
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
