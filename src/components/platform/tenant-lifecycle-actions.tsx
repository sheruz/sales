"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Super Admin invite + manual activation controls on tenant detail. */
export function TenantLifecycleActions({
  organizationId,
  billingProvider: initialProvider = "PADDLE",
  billingEmail: initialEmail = "",
}: {
  organizationId: string;
  billingProvider?: string;
  billingEmail?: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [planCode, setPlanCode] = useState("STARTER");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [billingProvider, setBillingProvider] = useState(initialProvider);
  const [billingEmail, setBillingEmail] = useState(initialEmail || "");

  async function inviteAction(action: string) {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/platform/organizations/${organizationId}/invite`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            email: email || undefined,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message ?? "Invite action failed");
      }
      if (data.data.inviteLink || data.data.link) {
        setInviteLink(data.data.inviteLink ?? data.data.link);
      }
      if (data.data.token && !data.data.inviteLink) {
        setInviteLink(
          `${window.location.origin}/invite?token=${data.data.token}`
        );
      }
      toast.success(`Invite ${action} ok`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function assign(action: string) {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/platform/organizations/${organizationId}/subscription`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, planCode }),
        }
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message ?? "Assign failed");
      }
      toast.success(`Subscription ${action} applied`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveBilling() {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/platform/organizations/${organizationId}/billing`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            billingProvider,
            billingEmail: billingEmail || null,
            reason: "Update tenant billing method",
          }),
        }
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message ?? "Billing update failed");
      }
      toast.success("Billing settings saved");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <h3 className="text-sm font-semibold">Lifecycle</h3>
      <div className="flex flex-wrap items-end gap-2 border-b pb-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Billing method</label>
          <select
            className="border rounded-md h-9 px-2 text-sm"
            value={billingProvider || "DEFAULT"}
            disabled={busy}
            onChange={(e) => setBillingProvider(e.target.value)}
          >
            <option value="DEFAULT">Use platform default</option>
            <option value="PADDLE">Paddle</option>
            <option value="STRIPE">Stripe</option>
            <option value="MANUAL_PAYONEER">Manual Payoneer</option>
            <option value="MANUAL_BANK">Manual bank</option>
          </select>
        </div>
        <Input
          className="max-w-xs"
          placeholder="Billing email"
          value={billingEmail}
          disabled={busy}
          onChange={(e) => setBillingEmail(e.target.value)}
        />
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void saveBilling()}>
          Save billing
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => inviteAction("resend")}
        >
          Resend invite
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => inviteAction("copy_link")}
        >
          Copy invite link
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => inviteAction("cancel")}
        >
          Cancel invite
        </Button>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <Input
          className="max-w-xs"
          placeholder="New owner email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={busy || !email}
          onClick={() => inviteAction("change_email")}
        >
          Change owner email
        </Button>
      </div>
      {inviteLink ? (
        <p className="break-all text-xs text-muted-foreground">{inviteLink}</p>
      ) : null}
      <div className="flex flex-wrap items-end gap-2 border-t pt-3">
        <Input
          className="max-w-[140px]"
          value={planCode}
          onChange={(e) => setPlanCode(e.target.value)}
          disabled={busy}
        />
        <Button
          size="sm"
          disabled={busy}
          onClick={() => assign("manual")}
        >
          Activate manual
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => assign("trial")}
        >
          Start trial
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => assign("complimentary")}
        >
          Complimentary
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => assign("set_none")}
        >
          Set NONE (lock)
        </Button>
      </div>
    </div>
  );
}
