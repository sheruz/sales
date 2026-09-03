"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { OpportunityStage } from "@prisma/client";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  OPPORTUNITY_STAGE_LABELS,
  OPPORTUNITY_STATUS_LABELS,
  scoreBadgeVariant,
  scoreLabel,
} from "@/lib/constants/opportunities";
import type { OpportunityStatus } from "@prisma/client";

interface OpportunityDetailClientProps {
  opportunityId: string;
  companyName: string;
  score: number;
  stage: OpportunityStage;
  status: OpportunityStatus;
  hasIntelligence: boolean;
}

export function OpportunityDetailClient({
  opportunityId,
  companyName,
  score,
  stage: initialStage,
  status,
  hasIntelligence,
}: OpportunityDetailClientProps) {
  const router = useRouter();
  const [stage, setStage] = useState(initialStage);
  const [saving, setSaving] = useState(false);
  const [researching, setResearching] = useState(false);

  async function onStageChange(value: string | null) {
    if (!value || value === stage) return;
    const next = value as OpportunityStage;
    setSaving(true);
    try {
      const res = await fetch(`/api/opportunities/${opportunityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: next }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message);
      setStage(next);
      toast.success(`Stage updated to ${OPPORTUNITY_STAGE_LABELS[next]}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update stage");
    } finally {
      setSaving(false);
    }
  }

  async function generateIntelligence(force = false) {
    setResearching(true);
    try {
      const res = await fetch(`/api/opportunities/${opportunityId}/research`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message);
      toast.success(
        data.data?.cached
          ? "Showing recent intelligence (cached)"
          : "AI opportunity intelligence ready"
      );
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to generate intelligence"
      );
    } finally {
      setResearching(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-2xl font-bold tracking-tight">{companyName}</h2>
          <Badge variant={scoreBadgeVariant(score)}>
            {score} · {scoreLabel(score)}
          </Badge>
          <Badge variant="outline">
            {OPPORTUNITY_STAGE_LABELS[stage] ?? stage}
          </Badge>
          <Badge variant="secondary">
            {OPPORTUNITY_STATUS_LABELS[status] ?? status}
          </Badge>
        </div>
        <p className="text-muted-foreground">
          {hasIntelligence
            ? "Sales intelligence is ready for this opportunity"
            : "Generate AI intelligence for why now, what to sell, and who to contact"}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={hasIntelligence ? "outline" : "default"}
          disabled={researching}
          onClick={() => generateIntelligence(hasIntelligence)}
        >
          {researching ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          {hasIntelligence ? "Refresh intelligence" : "Generate intelligence"}
        </Button>
        <span className="text-sm text-muted-foreground">Stage</span>
        <Select
          value={stage}
          onValueChange={onStageChange}
          disabled={saving}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.values(OpportunityStage).map((s) => (
              <SelectItem key={s} value={s}>
                {OPPORTUNITY_STAGE_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
