"use client";

import { useCallback, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export function MfaSettingsPanel() {
  const [status, setStatus] = useState<{
    enabled: boolean;
    mustEnroll: boolean;
  } | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [otpauthUrl, setOtpauthUrl] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/auth/mfa");
    const json = await res.json();
    if (json.success) setStatus(json.data);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function begin() {
    setBusy(true);
    try {
      const res = await fetch("/api/auth/mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "begin" }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || "Failed");
      setSecret(json.data.secret);
      setOtpauthUrl(json.data.otpauthUrl);
      setRecovery(null);
      toast.success("Scan the QR code in your authenticator app");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    setBusy(true);
    try {
      const res = await fetch("/api/auth/mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm", code }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || "Failed");
      setRecovery(json.data.recoveryCodes);
      setSecret(null);
      setOtpauthUrl(null);
      setCode("");
      toast.success("2FA enabled — save your recovery codes now");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  function downloadRecovery() {
    if (!recovery?.length) return;
    const blob = new Blob([recovery.join("\n") + "\n"], {
      type: "text/plain",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sales-platform-2fa-recovery-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!status) {
    return <Skeleton className="h-40 w-full" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Two-factor authentication</CardTitle>
        <CardDescription>
          Required for Super Admin after you enroll. Use an authenticator app
          (Google Authenticator, 1Password, etc.). Keep recovery codes offline.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-center gap-2">
          Status:{" "}
          {status.enabled ? (
            <Badge>Enabled</Badge>
          ) : status.mustEnroll ? (
            <Badge variant="destructive">Enrollment required</Badge>
          ) : (
            <Badge variant="secondary">Not enabled</Badge>
          )}
        </div>
        {!status.enabled && (
          <>
            <Button size="sm" disabled={busy} onClick={() => void begin()}>
              Start setup
            </Button>
            {secret && otpauthUrl && (
              <div className="space-y-3 rounded border p-3">
                <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                  <div className="rounded-md bg-white p-2">
                    <QRCodeSVG value={otpauthUrl} size={160} />
                  </div>
                  <div className="min-w-0 space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Scan with your authenticator, or enter the secret manually:
                    </p>
                    <code className="block break-all text-xs">{secret}</code>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        void navigator.clipboard.writeText(secret);
                        toast.success("Secret copied");
                      }}
                    >
                      Copy secret
                    </Button>
                  </div>
                </div>
                <Input
                  placeholder="6-digit code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
                <Button
                  size="sm"
                  disabled={busy || code.length < 6}
                  onClick={() => void confirm()}
                >
                  Confirm & enable
                </Button>
              </div>
            )}
          </>
        )}
        {recovery && (
          <div className="rounded border border-amber-500/40 bg-amber-500/10 p-3">
            <p className="mb-2 font-medium">
              Save these recovery codes (shown once):
            </p>
            <ul className="space-y-1 font-mono text-xs">
              {recovery.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-3"
              onClick={downloadRecovery}
            >
              Download codes
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
