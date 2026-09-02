"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Bot,
  Globe,
  Loader2,
  Play,
  Search,
  Unlock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AUTOMATION_STATUS_LABELS } from "@/lib/constants/automation";

interface CampaignDetailProps {
  campaign: {
    id: string;
    name: string;
    description: string | null;
    status: string;
    aiInstructions: string | null;
    targetAudience: string | null;
    dailyOutreachLimit: number;
    service: { name: string } | null;
  };
  stats: {
    totalLeads: number;
    automatedLeads: number;
    repliedLeads: number;
    hotLeads: number;
  };
}

export function CampaignDetail({ campaign, stats }: CampaignDetailProps) {
  const router = useRouter();
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [profileUrls, setProfileUrls] = useState("");
  const [searchCriteria, setSearchCriteria] = useState({
    jobTitles: "",
    industries: "",
    countries: "",
    keywords: "",
    description: "",
  });
  const [targetCount, setTargetCount] = useState(10);

  async function discoverFromUrls() {
    const urls = profileUrls
      .split("\n")
      .map((u) => u.trim())
      .filter(Boolean);
    if (urls.length === 0) return;

    setIsDiscovering(true);
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/discover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileUrls: urls, autoStartAutomation: true }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message);
      toast.success("LinkedIn discovery started — leads will be imported and automated");
      setProfileUrls("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Discovery failed");
    } finally {
      setIsDiscovering(false);
    }
  }

  async function discoverFromCriteria() {
    setIsDiscovering(true);
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/discover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetCount,
          searchCriteria: {
            jobTitles: searchCriteria.jobTitles.split(",").map((s) => s.trim()).filter(Boolean),
            industries: searchCriteria.industries.split(",").map((s) => s.trim()).filter(Boolean),
            countries: searchCriteria.countries.split(",").map((s) => s.trim()).filter(Boolean),
            keywords: searchCriteria.keywords.split(",").map((s) => s.trim()).filter(Boolean),
            description: searchCriteria.description || undefined,
          },
          autoStartAutomation: true,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message);
      toast.success(`AI prospect search started for ${targetCount} leads`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Search failed");
    } finally {
      setIsDiscovering(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Total Leads", value: stats.totalLeads },
          { label: "AI Automated", value: stats.automatedLeads },
          { label: "Replied", value: stats.repliedLeads },
          { label: "Hot Leads", value: stats.hotLeads },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-4">
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-sm text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="h-4 w-4" />
              Import LinkedIn Profiles
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Paste LinkedIn profile URLs (one per line). AI will enrich profiles, research, score, and start outreach automatically.
            </p>
            <Textarea
              placeholder={"https://linkedin.com/in/john-doe\nhttps://linkedin.com/in/jane-smith"}
              value={profileUrls}
              onChange={(e) => setProfileUrls(e.target.value)}
              rows={5}
            />
            <Button onClick={discoverFromUrls} disabled={isDiscovering}>
              {isDiscovering ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Import & Automate
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Search className="h-4 w-4" />
              AI Prospect Finder
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Define your ideal customer profile. AI generates matching prospects for LinkedIn outreach.
            </p>
            <div>
              <Label>Job Titles (comma-separated)</Label>
              <Input
                value={searchCriteria.jobTitles}
                onChange={(e) => setSearchCriteria({ ...searchCriteria, jobTitles: e.target.value })}
                placeholder="CTO, VP Engineering, Head of Product"
              />
            </div>
            <div>
              <Label>Industries</Label>
              <Input
                value={searchCriteria.industries}
                onChange={(e) => setSearchCriteria({ ...searchCriteria, industries: e.target.value })}
                placeholder="SaaS, FinTech, Healthcare"
              />
            </div>
            <div>
              <Label>Countries</Label>
              <Input
                value={searchCriteria.countries}
                onChange={(e) => setSearchCriteria({ ...searchCriteria, countries: e.target.value })}
                placeholder="USA, UK, Canada"
              />
            </div>
            <div>
              <Label>Number of Prospects</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={targetCount}
                onChange={(e) => setTargetCount(Number(e.target.value))}
              />
            </div>
            <Button onClick={discoverFromCriteria} disabled={isDiscovering} variant="outline">
              {isDiscovering ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Bot className="mr-2 h-4 w-4" />
              )}
              Find & Automate
            </Button>
          </CardContent>
        </Card>
      </div>

      {campaign.aiInstructions && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">AI Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{campaign.aiInstructions}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface LeadAIPanelProps {
  leadId: string;
  automationStatus: string;
  automationError?: string | null;
  score: number;
  scoreCategory: string | null;
  hasResearch: boolean;
}

export function LeadAIPanel({
  leadId,
  automationStatus,
  automationError,
  score,
  scoreCategory,
  hasResearch,
}: LeadAIPanelProps) {
  const router = useRouter();
  const [isRunning, setIsRunning] = useState(false);

  const isLocked = !["IDLE", "FAILED", "PAUSED", "COMPLETED"].includes(automationStatus);

  async function runAutomation() {
    setIsRunning(true);
    try {
      const res = await fetch(`/api/automation/${leadId}`, { method: "POST" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message);
      toast.success("AI automation completed");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Automation failed");
    } finally {
      setIsRunning(false);
    }
  }

  async function unlockLead() {
    try {
      const res = await fetch(`/api/automation/${leadId}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message);
      toast.success("Lead unlocked");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to unlock");
    }
  }

  async function runResearch() {
    setIsRunning(true);
    try {
      const res = await fetch(`/api/ai/research/${leadId}`, { method: "POST" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message);
      toast.success("AI research completed");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Research failed");
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bot className="h-4 w-4" />
          AI Automation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Status</span>
          <Badge variant={automationStatus === "FAILED" ? "destructive" : isLocked ? "default" : "secondary"}>
            {AUTOMATION_STATUS_LABELS[automationStatus] ?? automationStatus}
          </Badge>
        </div>
        {automationStatus === "FAILED" && automationError && (
          <p className="text-sm text-destructive rounded-md border border-destructive/30 bg-destructive/5 p-2">
            {automationError}
          </p>
        )}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">AI Score</span>
          <span className="font-medium">
            {score}{scoreCategory ? ` (${scoreCategory})` : ""}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {!hasResearch && (
            <Button size="sm" variant="outline" onClick={runResearch} disabled={isRunning}>
              Research
            </Button>
          )}
          <Button size="sm" onClick={runAutomation} disabled={isRunning || isLocked}>
            {isRunning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
            Run Full Pipeline
          </Button>
          {isLocked && (
            <Button size="sm" variant="outline" onClick={unlockLead}>
              <Unlock className="mr-2 h-4 w-4" />
              Unlock
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
