"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const emptyForm = {
  name: "",
  slug: "",
  country: "",
  timezone: "UTC",
  defaultCurrency: "USD",
  website: "",
  legalName: "",
  internalNotes: "",
  ownerEmail: "",
  ownerFirstName: "",
  ownerLastName: "",
  accessType: "none" as "none" | "trial" | "manual" | "complimentary",
  planCode: "STARTER",
  trialDays: "14",
};

export function CreateOrganizationForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setLastInviteLink(null);

    try {
      const access =
        form.accessType === "none"
          ? { type: "none" as const }
          : form.accessType === "trial"
            ? {
                type: "trial" as const,
                planCode: form.planCode,
                trialDays: Number(form.trialDays) || 14,
              }
            : form.accessType === "manual"
              ? { type: "manual" as const, planCode: form.planCode }
              : {
                  type: "complimentary" as const,
                  planCode: form.planCode || "COMPLIMENTARY",
                };

      const response = await fetch("/api/platform/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          slug: form.slug || undefined,
          country: form.country || undefined,
          timezone: form.timezone || undefined,
          defaultCurrency: form.defaultCurrency || undefined,
          website: form.website || undefined,
          legalName: form.legalName || undefined,
          internalNotes: form.internalNotes || undefined,
          owner: {
            email: form.ownerEmail,
            firstName: form.ownerFirstName,
            lastName: form.ownerLastName,
          },
          access,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error?.message ?? "Failed to create organization");
      }

      if (data.data.inviteEmailSent) {
        toast.success(`Company "${data.data.name}" created — invite emailed`);
      } else {
        toast.success(
          `Company "${data.data.name}" created — copy invite link (email not sent)`
        );
      }
      if (data.data.inviteLink) setLastInviteLink(data.data.inviteLink);
      setForm(emptyForm);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create organization"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm">
            <Plus className="h-4 w-4" />
            New company
          </Button>
        }
      />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New company</DialogTitle>
          <DialogDescription>
            Create a tenant and invite the owner (no password). They set a
            password via email link (72h).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="orgName">Company name</Label>
            <Input
              id="orgName"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              minLength={2}
              disabled={isSubmitting}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="orgSlug">Slug (optional)</Label>
              <Input
                id="orgSlug"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
                placeholder="US"
                disabled={isSubmitting}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Input
                id="timezone"
                value={form.timezone}
                onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Input
                id="currency"
                value={form.defaultCurrency}
                onChange={(e) =>
                  setForm({ ...form, defaultCurrency: e.target.value })
                }
                disabled={isSubmitting}
              />
            </div>
          </div>
          <div className="space-y-2 border-t pt-3">
            <Label>Owner / admin</Label>
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder="First name"
                value={form.ownerFirstName}
                onChange={(e) =>
                  setForm({ ...form, ownerFirstName: e.target.value })
                }
                required
                disabled={isSubmitting}
              />
              <Input
                placeholder="Last name"
                value={form.ownerLastName}
                onChange={(e) =>
                  setForm({ ...form, ownerLastName: e.target.value })
                }
                required
                disabled={isSubmitting}
              />
            </div>
            <Input
              type="email"
              placeholder="Email"
              value={form.ownerEmail}
              onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })}
              required
              disabled={isSubmitting}
            />
          </div>
          <div className="space-y-2 border-t pt-3">
            <Label htmlFor="accessType">Access</Label>
            <select
              id="accessType"
              className="flex h-9 w-full rounded-md border bg-background px-3 text-sm"
              value={form.accessType}
              onChange={(e) =>
                setForm({
                  ...form,
                  accessType: e.target.value as typeof form.accessType,
                })
              }
              disabled={isSubmitting}
            >
              <option value="none">No package yet (choose plan on login)</option>
              <option value="trial">Trial</option>
              <option value="manual">Manual / invoiced</option>
              <option value="complimentary">Complimentary</option>
            </select>
            {form.accessType !== "none" ? (
              <div className="grid grid-cols-2 gap-3">
                <Input
                  placeholder="Plan code (STARTER…)"
                  value={form.planCode}
                  onChange={(e) =>
                    setForm({ ...form, planCode: e.target.value })
                  }
                  disabled={isSubmitting}
                />
                {form.accessType === "trial" ? (
                  <Input
                    type="number"
                    min={1}
                    max={90}
                    value={form.trialDays}
                    onChange={(e) =>
                      setForm({ ...form, trialDays: e.target.value })
                    }
                    disabled={isSubmitting}
                  />
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Internal notes</Label>
            <Input
              id="notes"
              value={form.internalNotes}
              onChange={(e) =>
                setForm({ ...form, internalNotes: e.target.value })
              }
              disabled={isSubmitting}
            />
          </div>
          {lastInviteLink ? (
            <p className="break-all rounded-md bg-muted p-2 text-xs">
              Invite link: {lastInviteLink}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating…" : "Create & send invite"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
