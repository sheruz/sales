"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Super Admin invite + manual activation controls on tenant detail. */
export function TenantLifecycleActions({
  organizationId,
}: {
  organizationId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [planCode, setPlanCode] = useState("STARTER");
  const [inviteLink, setInviteLink] = useState<string | null>(null);

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

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <h3 className="text-sm font-semibold">B1 lifecycle</h3>
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
