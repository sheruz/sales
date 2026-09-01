"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Plus, Target, Users, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { toast } from "sonner";
import { CAMPAIGN_STATUS_LABELS } from "@/lib/constants/automation";

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  status: string;
  dailyOutreachLimit: number;
  targetIndustries: string[];
  service: { id: string; name: string } | null;
  _count: { leads: number };
  createdAt: string;
}

interface Service {
  id: string;
  name: string;
}

interface CampaignsListProps {
  initialCampaigns: Campaign[];
  services: Service[];
}

export function CampaignsList({ initialCampaigns, services }: CampaignsListProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    targetAudience: "",
    serviceId: "",
    aiInstructions: "",
    dailyOutreachLimit: 50,
    status: "DRAFT",
  });

  async function createCampaign() {
    if (!form.name.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          serviceId: form.serviceId || undefined,
          targetCountries: [],
          targetIndustries: [],
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message);
      toast.success("Campaign created");
      setOpen(false);
      router.push(`/dashboard/campaigns/${data.data.id}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create campaign");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button><Plus className="mr-2 h-4 w-4" />New Campaign</Button>} />
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Campaign</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Q1 SaaS Outreach"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                />
              </div>
              <div>
                <Label>Target Audience</Label>
                <Input
                  value={form.targetAudience}
                  onChange={(e) => setForm({ ...form, targetAudience: e.target.value })}
                  placeholder="CTOs at mid-size SaaS companies"
                />
              </div>
              <div>
                <Label>Service</Label>
                <Select
                  value={form.serviceId}
                  onValueChange={(v) => v && setForm({ ...form, serviceId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select service" />
                  </SelectTrigger>
                  <SelectContent>
                    {services.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>AI Instructions</Label>
                <Textarea
                  value={form.aiInstructions}
                  onChange={(e) => setForm({ ...form, aiInstructions: e.target.value })}
                  placeholder="Tone, messaging guidelines, what to emphasize..."
                  rows={3}
                />
              </div>
              <Button onClick={createCampaign} disabled={isSubmitting} className="w-full">
                {isSubmitting ? "Creating..." : "Create Campaign"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {initialCampaigns.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Target className="mx-auto mb-4 h-12 w-12 opacity-50" />
            <p>No campaigns yet. Create one to start AI-powered outreach.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {initialCampaigns.map((campaign) => (
            <Link key={campaign.id} href={`/dashboard/campaigns/${campaign.id}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">{campaign.name}</CardTitle>
                    <Badge variant={campaign.status === "ACTIVE" ? "default" : "secondary"}>
                      {CAMPAIGN_STATUS_LABELS[campaign.status] ?? campaign.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                    {campaign.description ?? "No description"}
                  </p>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {campaign._count.leads} leads
                    </span>
                    <span className="flex items-center gap-1">
                      <Zap className="h-3 w-3" />
                      {campaign.dailyOutreachLimit}/day
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Created {format(new Date(campaign.createdAt), "MMM d, yyyy")}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
