"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ROLE_KEYS, type PermissionKey } from "@/lib/auth/permission-catalog";

const INVITE_ROLES = [
  { key: ROLE_KEYS.COMPANY_ADMIN, label: "Company Admin" },
  { key: ROLE_KEYS.SALES_MANAGER, label: "Sales Manager" },
  { key: ROLE_KEYS.SALES_REP, label: "Sales Rep" },
  { key: ROLE_KEYS.VIEWER, label: "Viewer" },
] as const;

export interface OrgMemberRow {
  id: string;
  status: string;
  isPrimaryAdmin: boolean;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    isActive: boolean;
  };
  role: {
    key: string;
    name: string;
  };
}

interface OrgTeamClientProps {
  members: OrgMemberRow[];
  permissions: PermissionKey[];
  currentUserId: string;
}

function statusVariant(status: string) {
  if (status === "ACTIVE") return "default" as const;
  return "destructive" as const;
}

export function OrgTeamClient({
  members,
  permissions,
  currentUserId,
}: OrgTeamClientProps) {
  const router = useRouter();
  const canInvite = permissions.includes("users.invite");
  const canDelete = permissions.includes("users.delete");

  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [roleKey, setRoleKey] = useState<string>(ROLE_KEYS.SALES_REP);

  async function handleInvite(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setInviteToken(null);

    try {
      const response = await fetch("/api/organizations/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, roleKey }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error?.message ?? "Failed to invite member");
      }

      const token = data.data.token as string;
      setInviteToken(token);
      toast.success(`Invite sent to ${data.data.email}`, {
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
      setIsSubmitting(false);
    }
  }

  async function handleDeactivate(userId: string) {
    if (!confirm("Deactivate this member?")) return;

    try {
      const response = await fetch(`/api/organizations/members/${userId}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error?.message ?? "Failed to deactivate member");
      }
      toast.success("Member deactivated");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to deactivate member"
      );
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold">Team members</h3>
          <p className="text-sm text-muted-foreground">
            Invite colleagues and manage organization roles
          </p>
        </div>
        {canInvite && (
          <Dialog
            open={open}
            onOpenChange={(next) => {
              setOpen(next);
              if (!next) setInviteToken(null);
            }}
          >
            <DialogTrigger
              render={
                <Button size="sm">
                  <Plus className="h-4 w-4" />
                  Invite
                </Button>
              }
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite member</DialogTitle>
                <DialogDescription>
                  They will receive an invite token to join this organization.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleInvite} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="teamInviteEmail">Email</Label>
                  <Input
                    id="teamInviteEmail"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isSubmitting}
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
                {inviteToken && (
                  <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1">
                    <p className="font-medium">Invite token (shown once)</p>
                    <code className="block break-all text-xs">{inviteToken}</code>
                  </div>
                )}
                <DialogFooter>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Sending..." : "Send invite"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center text-muted-foreground"
                >
                  No members yet.
                </TableCell>
              </TableRow>
            ) : (
              members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">
                    {member.user.firstName} {member.user.lastName}
                    {member.isPrimaryAdmin && (
                      <Badge className="ml-2" variant="secondary">
                        Primary
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{member.user.email}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{member.role.name}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(member.status)}>
                      {member.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {canDelete &&
                      member.status === "ACTIVE" &&
                      member.user.id !== currentUserId &&
                      !member.isPrimaryAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeactivate(member.user.id)}
                          aria-label="Deactivate member"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
