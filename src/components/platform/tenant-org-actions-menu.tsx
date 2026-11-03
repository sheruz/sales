"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ROLE_KEYS } from "@/lib/auth/permission-catalog";
import { PlatformConfirmDialog } from "@/components/platform/ui/confirm-dialog";
import { PowSendToggleTenant } from "@/components/platform/pow-send-toggle";

const INVITE_ROLES = [
  { key: ROLE_KEYS.COMPANY_ADMIN, label: "Company Admin" },
  { key: ROLE_KEYS.SALES_MANAGER, label: "Sales Manager" },
  { key: ROLE_KEYS.SALES_REP, label: "Sales Rep" },
  { key: ROLE_KEYS.VIEWER, label: "Viewer" },
] as const;

const BILLING_PROVIDERS = [
  { value: "DEFAULT", label: "Use platform default" },
  { value: "PADDLE", label: "Paddle" },
  { value: "STRIPE", label: "Stripe" },
  { value: "MANUAL_PAYONEER", label: "Manual Payoneer" },
  { value: "MANUAL_BANK", label: "Manual bank" },
] as const;

type SheetKind =
  | "invite"
  | "billing"
  | "owner-email"
  | "subscription"
  | "pow-send"
  | null;

type ConfirmKind = "suspend" | "cancel-invite" | "set-none" | null;

type SubAction = "manual" | "trial" | "complimentary";

export function TenantOrgActionsMenu({
  organizationId,
  status,
  billingProvider: initialProvider = "DEFAULT",
  billingEmail: initialEmail = "",
}: {
  organizationId: string;
  status: string;
  billingProvider?: string;
  billingEmail?: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [confirm, setConfirm] = useState<ConfirmKind>(null);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>(ROLE_KEYS.SALES_REP);
  const [inviteToken, setInviteToken] = useState<string | null>(null);

  const [ownerEmail, setOwnerEmail] = useState("");

  const [billingProvider, setBillingProvider] = useState(
    initialProvider || "DEFAULT"
  );
  const [billingEmail, setBillingEmail] = useState(initialEmail || "");

  const [planCode, setPlanCode] = useState("STARTER");
  const [subAction, setSubAction] = useState<SubAction>("trial");

  function closeSheet() {
    setSheet(null);
    setInviteToken(null);
  }

  async function patchStatus(next: "ACTIVE" | "SUSPENDED") {
    setBusy(true);
    try {
      const response = await fetch(
        `/api/platform/organizations/${organizationId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: next }),
        }
      );
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error?.message ?? "Failed to update status");
      }
      toast.success(
        next === "SUSPENDED"
          ? "Organization suspended"
          : "Organization activated"
      );
      setConfirm(null);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update status"
      );
    } finally {
      setBusy(false);
    }
  }

  async function inviteAction(action: string, email?: string) {
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
      const link =
        data.data.inviteLink ??
        data.data.link ??
        (data.data.token
          ? `${window.location.origin}/invite?token=${data.data.token}`
          : null);
      if (link) {
        try {
          await navigator.clipboard.writeText(link);
          toast.success(`Invite ${action} ok — link copied`, {
            description: link,
            duration: 12_000,
          });
        } catch {
          toast.success(`Invite ${action} ok`, {
            description: link,
            duration: 12_000,
          });
        }
      } else {
        toast.success(`Invite ${action} ok`);
      }
      setConfirm(null);
      if (action === "change_email") closeSheet();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function assign(action: SubAction | "set_none") {
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
      setConfirm(null);
      closeSheet();
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
      closeSheet();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleInviteMember(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setInviteToken(null);
    try {
      const response = await fetch(
        `/api/platform/organizations/${organizationId}/members`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: inviteEmail, roleKey: inviteRole }),
        }
      );
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error?.message ?? "Failed to invite member");
      }
      const token = data.data.token as string;
      setInviteToken(token);
      toast.success(`Invite created for ${data.data.email}`);
      setInviteEmail("");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to invite member"
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button size="sm" variant="outline" disabled={busy} />}
        >
          Actions
          <ChevronDown className="ml-1 size-3.5 opacity-70" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Lifecycle</DropdownMenuLabel>
            {status === "ACTIVE" ? (
              <DropdownMenuItem
                variant="destructive"
                disabled={busy}
                onClick={() => setConfirm("suspend")}
              >
                Suspend organization
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                disabled={busy}
                onClick={() => void patchStatus("ACTIVE")}
              >
                Activate organization
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>

          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel>Invites &amp; access</DropdownMenuLabel>
            <DropdownMenuItem
              disabled={busy}
              onClick={() => setSheet("invite")}
            >
              Invite member…
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={busy}
              onClick={() => void inviteAction("resend")}
            >
              Resend invite
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={busy}
              onClick={() => void inviteAction("copy_link")}
            >
              Copy invite link
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={busy}
              onClick={() => setSheet("owner-email")}
            >
              Change owner email…
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              disabled={busy}
              onClick={() => setConfirm("cancel-invite")}
            >
              Cancel invite
            </DropdownMenuItem>
          </DropdownMenuGroup>

          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel>Subscription</DropdownMenuLabel>
            <DropdownMenuItem
              disabled={busy}
              onClick={() => {
                setSubAction("manual");
                setSheet("subscription");
              }}
            >
              Activate manual…
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={busy}
              onClick={() => {
                setSubAction("trial");
                setSheet("subscription");
              }}
            >
              Start trial…
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={busy}
              onClick={() => {
                setSubAction("complimentary");
                setSheet("subscription");
              }}
            >
              Complimentary…
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              disabled={busy}
              onClick={() => setConfirm("set-none")}
            >
              Set NONE (lock)
            </DropdownMenuItem>
          </DropdownMenuGroup>

          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel>Billing</DropdownMenuLabel>
            <DropdownMenuItem
              disabled={busy}
              onClick={() => setSheet("billing")}
            >
              Billing method…
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={busy}
              onClick={() => setSheet("pow-send")}
            >
              PoW send override…
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <PlatformConfirmDialog
        open={confirm === "suspend"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Suspend this organization?"
        description="Members will lose access until you activate it again."
        confirmLabel="Suspend"
        destructive
        busy={busy}
        onConfirm={() => patchStatus("SUSPENDED")}
      />
      <PlatformConfirmDialog
        open={confirm === "cancel-invite"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Cancel pending invite?"
        description="The current invite token will stop working."
        confirmLabel="Cancel invite"
        destructive
        busy={busy}
        onConfirm={() => inviteAction("cancel")}
      />
      <PlatformConfirmDialog
        open={confirm === "set-none"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Lock subscription (NONE)?"
        description="Tenant outbound and gated modules will be blocked until a plan is assigned again."
        confirmLabel="Set NONE"
        destructive
        busy={busy}
        onConfirm={() => assign("set_none")}
      />

      <Sheet open={sheet === "invite"} onOpenChange={(o) => !o && closeSheet()}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Invite member</SheetTitle>
            <SheetDescription>
              Creates a pending invitation. Copy the token once — it is not
              stored in plaintext.
            </SheetDescription>
          </SheetHeader>
          <form
            onSubmit={handleInviteMember}
            className="mt-4 space-y-4 px-4 pb-4"
          >
            <div className="space-y-2">
              <Label htmlFor="org-invite-email">Email</Label>
              <Input
                id="org-invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
                disabled={busy}
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={inviteRole}
                onValueChange={(value) => value && setInviteRole(value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INVITE_ROLES.map((role) => (
                    <SelectItem key={role.key} value={role.key}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <SheetFooter className="px-0">
              <Button type="submit" disabled={busy}>
                {busy ? "Sending…" : "Send invite"}
              </Button>
            </SheetFooter>
          </form>
          {inviteToken ? (
            <div className="mx-4 mb-4 space-y-2 rounded-md border bg-muted/40 p-3 text-sm">
              <p className="font-medium">Invite token (shown once)</p>
              <code className="block break-all text-xs">{inviteToken}</code>
              <p className="text-xs text-muted-foreground">
                Share link:{" "}
                <span className="font-mono">/invite?token={inviteToken}</span>
              </p>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      <Sheet
        open={sheet === "owner-email"}
        onOpenChange={(o) => !o && closeSheet()}
      >
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Change owner email</SheetTitle>
            <SheetDescription>
              Updates the pending owner invite email for this organization.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-4 px-4 pb-4">
            <div className="space-y-2">
              <Label htmlFor="owner-email">New owner email</Label>
              <Input
                id="owner-email"
                type="email"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                disabled={busy}
              />
            </div>
            <SheetFooter className="px-0">
              <Button
                disabled={busy || !ownerEmail.trim()}
                onClick={() => void inviteAction("change_email", ownerEmail.trim())}
              >
                {busy ? "Saving…" : "Change owner email"}
              </Button>
            </SheetFooter>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet
        open={sheet === "billing"}
        onOpenChange={(o) => !o && closeSheet()}
      >
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Billing method</SheetTitle>
            <SheetDescription>
              Override how this tenant pays. Leave as platform default when
              possible.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-4 px-4 pb-4">
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select
                value={billingProvider || "DEFAULT"}
                onValueChange={(v) => v && setBillingProvider(v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BILLING_PROVIDERS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="billing-email">Billing email</Label>
              <Input
                id="billing-email"
                type="email"
                value={billingEmail}
                onChange={(e) => setBillingEmail(e.target.value)}
                disabled={busy}
                placeholder="Optional"
              />
            </div>
            <SheetFooter className="px-0">
              <Button disabled={busy} onClick={() => void saveBilling()}>
                {busy ? "Saving…" : "Save billing"}
              </Button>
            </SheetFooter>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet
        open={sheet === "subscription"}
        onOpenChange={(o) => !o && closeSheet()}
      >
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>
              {subAction === "manual"
                ? "Activate manual plan"
                : subAction === "trial"
                  ? "Start trial"
                  : "Complimentary plan"}
            </SheetTitle>
            <SheetDescription>
              Applies immediately to this organization&apos;s subscription.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-4 px-4 pb-4">
            <div className="space-y-2">
              <Label htmlFor="plan-code">Plan code</Label>
              <Input
                id="plan-code"
                value={planCode}
                onChange={(e) => setPlanCode(e.target.value.toUpperCase())}
                disabled={busy}
                placeholder="STARTER"
              />
            </div>
            <SheetFooter className="px-0">
              <Button
                disabled={busy || !planCode.trim()}
                onClick={() => void assign(subAction)}
              >
                {busy ? "Applying…" : "Apply"}
              </Button>
            </SheetFooter>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet
        open={sheet === "pow-send"}
        onOpenChange={(o) => !o && closeSheet()}
      >
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>PoW send override</SheetTitle>
            <SheetDescription>
              Per-tenant override of the global Proof of Work send switch.
              Logged in PlatformAuditLog.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 px-4 pb-4">
            <PowSendToggleTenant organizationId={organizationId} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
