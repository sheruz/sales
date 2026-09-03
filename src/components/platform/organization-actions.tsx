"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ROLE_KEYS } from "@/lib/auth/permission-catalog";

const INVITE_ROLES = [
  { key: ROLE_KEYS.COMPANY_ADMIN, label: "Company Admin" },
  { key: ROLE_KEYS.SALES_MANAGER, label: "Sales Manager" },
  { key: ROLE_KEYS.SALES_REP, label: "Sales Rep" },
  { key: ROLE_KEYS.VIEWER, label: "Viewer" },
] as const;

interface OrganizationActionsProps {
  organizationId: string;
  status: string;
}

export function OrganizationActions({
  organizationId,
  status,
}: OrganizationActionsProps) {
  const router = useRouter();
  const [isUpdating, setIsUpdating] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [roleKey, setRoleKey] = useState<string>(ROLE_KEYS.SALES_REP);

  async function patchStatus(next: "ACTIVE" | "SUSPENDED") {
    setIsUpdating(true);
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
        next === "SUSPENDED" ? "Organization suspended" : "Organization activated"
      );
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update status"
      );
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleInvite(event: React.FormEvent) {
    event.preventDefault();
    setIsInviting(true);
    setInviteToken(null);

    try {
      const response = await fetch(
        `/api/platform/organizations/${organizationId}/members`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, roleKey }),
        }
      );
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error?.message ?? "Failed to invite member");
      }

      const token = data.data.token as string;
      setInviteToken(token);
      toast.success(`Invite created for ${data.data.email}`, {
        description: `Token: ${token}`,
        duration: 15000,
      });
      setEmail("");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to invite member"
      );
    } finally {
      setIsInviting(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status</CardTitle>
          <CardDescription>
            Suspend to block tenant access; activate to restore it.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {status === "ACTIVE" ? (
            <Button
              variant="destructive"
              size="sm"
              disabled={isUpdating}
              onClick={() => patchStatus("SUSPENDED")}
            >
              {isUpdating ? "Updating..." : "Suspend"}
            </Button>
          ) : (
            <Button
              size="sm"
              disabled={isUpdating}
              onClick={() => patchStatus("ACTIVE")}
            >
              {isUpdating ? "Updating..." : "Activate"}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invite member</CardTitle>
          <CardDescription>
            Creates a pending invitation. Copy the token once — it is not stored
            in plaintext.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleInvite} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="inviteEmail">Email</Label>
              <Input
                id="inviteEmail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isInviting}
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={roleKey}
                onValueChange={(value) => value && setRoleKey(value)}
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
            <Button type="submit" size="sm" disabled={isInviting}>
              {isInviting ? "Sending..." : "Send invite"}
            </Button>
          </form>

          {inviteToken && (
            <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-2">
              <p className="font-medium">Invite token (shown once)</p>
              <code className="block break-all text-xs">{inviteToken}</code>
              <p className="text-muted-foreground text-xs">
                Share link:{" "}
                <span className="font-mono">
                  /invite?token={inviteToken}
                </span>
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
