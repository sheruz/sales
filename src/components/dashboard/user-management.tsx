"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserRole } from "@prisma/client";
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
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { canManageTargetUser, getAssignableRoles } from "@/lib/auth/role-policy";
import { PlatformConfirmDialog } from "@/components/platform/ui/confirm-dialog";

interface UserRecord {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
}

interface UserManagementProps {
  initialUsers: UserRecord[];
  actorRole?: UserRole;
}

export function UserManagement({ initialUsers, actorRole }: UserManagementProps) {
  const router = useRouter();
  const users = initialUsers;
  const assignableRoles = actorRole
    ? getAssignableRoles(actorRole)
    : Object.values(UserRole);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState<{
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: UserRole;
  }>({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    role: UserRole.SALES_REPRESENTATIVE,
  });

  async function handleCreateUser(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message ?? "Failed to create user");
      }

      toast.success("User created successfully");
      setIsDialogOpen(false);
      setForm({
        email: "",
        password: "",
        firstName: "",
        lastName: "",
        role: UserRole.SALES_REPRESENTATIVE,
      });
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create user"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const [deactivateId, setDeactivateId] = useState<string | null>(null);
  const [deactivateBusy, setDeactivateBusy] = useState(false);

  function requestDeactivate(userId: string, role: string) {
    if (role === "SUPER_ADMIN") {
      toast.error("Super Admin accounts cannot be deactivated");
      return;
    }
    setDeactivateId(userId);
  }

  async function handleDeactivate(reason: string) {
    if (!deactivateId) return;
    setDeactivateBusy(true);
    try {
      const response = await fetch(`/api/users/${deactivateId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message ?? "Failed to deactivate user");
      }

      toast.success("User deactivated");
      setDeactivateId(null);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to deactivate user"
      );
    } finally {
      setDeactivateBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {users.length} user{users.length !== 1 ? "s" : ""} in the system
        </p>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create User</DialogTitle>
              <DialogDescription>
                Add a new team member to the platform.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={form.firstName}
                    onChange={(e) =>
                      setForm({ ...form, firstName: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={form.lastName}
                    onChange={(e) =>
                      setForm({ ...form, lastName: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="newEmail">Email</Label>
                <Input
                  id="newEmail"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                  required
                  minLength={8}
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={form.role}
                  onValueChange={(value) =>
                    setForm({ ...form, role: value as UserRole })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {assignableRoles.map((role) => (
                      <SelectItem key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Creating..." : "Create User"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
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
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">
                  {user.firstName} {user.lastName}
                </TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{ROLE_LABELS[user.role]}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={user.isActive ? "default" : "destructive"}>
                    {user.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell>
                  {user.isActive &&
                    user.role !== "SUPER_ADMIN" &&
                    (!actorRole || canManageTargetUser(actorRole, user.role)) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => requestDeactivate(user.id, user.role)}
                      aria-label="Deactivate user"
                    >
                      <Trash2 className="mr-1 h-4 w-4 text-destructive" />
                      Deactivate
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <PlatformConfirmDialog
        open={!!deactivateId}
        onOpenChange={(o) => !o && setDeactivateId(null)}
        title="Deactivate this user?"
        description="They will no longer be able to sign in. Reason is saved to the audit log."
        requireReason
        destructive
        confirmLabel="Deactivate"
        busy={deactivateBusy}
        onConfirm={({ reason }) => handleDeactivate(reason)}
      />
    </div>
  );
}
