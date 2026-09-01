"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LeadStatus } from "@prisma/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LEAD_SOURCES, LEAD_STATUS_LABELS } from "@/lib/constants/leads";

export interface LeadFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  linkedInUrl: string;
  companyName: string;
  companyWebsite: string;
  jobTitle: string;
  country: string;
  city: string;
  industry: string;
  companySize: string;
  source: string;
  status: LeadStatus;
  notes: string;
  estimatedBudget: string;
}

interface LeadFormProps {
  initialData?: Partial<LeadFormData>;
  leadId?: string;
  onSuccess?: (leadId: string) => void;
}

const defaultData: LeadFormData = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  linkedInUrl: "",
  companyName: "",
  companyWebsite: "",
  jobTitle: "",
  country: "",
  city: "",
  industry: "",
  companySize: "",
  source: "Manual",
  status: LeadStatus.NEW,
  notes: "",
  estimatedBudget: "",
};

export function LeadForm({ initialData, leadId, onSuccess }: LeadFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<LeadFormData>({ ...defaultData, ...initialData });
  const [isLoading, setIsLoading] = useState(false);

  function update(field: keyof LeadFormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);

    try {
      const payload = {
        ...form,
        estimatedBudget: form.estimatedBudget
          ? parseFloat(form.estimatedBudget)
          : null,
      };

      const url = leadId ? `/api/leads/${leadId}` : "/api/leads";
      const method = leadId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message ?? "Failed to save lead");

      toast.success(leadId ? "Lead updated" : "Lead created");
      if (onSuccess) {
        onSuccess(data.data.id);
      } else {
        router.push(`/dashboard/leads/${data.data.id}`);
        router.refresh();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save lead");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="firstName">First Name *</Label>
          <Input
            id="firstName"
            value={form.firstName}
            onChange={(e) => update("firstName", e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last Name *</Label>
          <Input
            id="lastName"
            value={form.lastName}
            onChange={(e) => update("lastName", e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="jobTitle">Job Title</Label>
          <Input
            id="jobTitle"
            value={form.jobTitle}
            onChange={(e) => update("jobTitle", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="linkedInUrl">LinkedIn URL</Label>
          <Input
            id="linkedInUrl"
            value={form.linkedInUrl}
            onChange={(e) => update("linkedInUrl", e.target.value)}
          />
        </div>
      </div>

      <div className="border-t pt-6">
        <h3 className="mb-4 text-sm font-medium">Company</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="companyName">Company Name</Label>
            <Input
              id="companyName"
              value={form.companyName}
              onChange={(e) => update("companyName", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="companyWebsite">Website</Label>
            <Input
              id="companyWebsite"
              value={form.companyWebsite}
              onChange={(e) => update("companyWebsite", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="industry">Industry</Label>
            <Input
              id="industry"
              value={form.industry}
              onChange={(e) => update("industry", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="companySize">Company Size</Label>
            <Input
              id="companySize"
              value={form.companySize}
              onChange={(e) => update("companySize", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="country">Country</Label>
            <Input
              id="country"
              value={form.country}
              onChange={(e) => update("country", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              value={form.city}
              onChange={(e) => update("city", e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="border-t pt-6">
        <h3 className="mb-4 text-sm font-medium">Details</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={form.status}
              onValueChange={(v) => v && update("status", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(LeadStatus).map((s) => (
                  <SelectItem key={s} value={s}>
                    {LEAD_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Source</Label>
            <Select
              value={form.source}
              onValueChange={(v) => v && update("source", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEAD_SOURCES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="estimatedBudget">Est. Budget ($)</Label>
            <Input
              id="estimatedBudget"
              type="number"
              value={form.estimatedBudget}
              onChange={(e) => update("estimatedBudget", e.target.value)}
            />
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            rows={3}
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
          />
        </div>
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {leadId ? "Update Lead" : "Create Lead"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
