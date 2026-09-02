"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import { Bot, Loader2, Play, Shield, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AutopilotUsage {
  dailyLeadsCreated: number;
  maxLeadsPerDay: number;
  maxLeadsPerRun: number;
  dailyAiCalls: number;
  maxAiCallsPerDay: number;
  dailyMessageCount: number;
  dailyMessageLimit: number;
  dailySearchCount: number;
  dailySearchLimit: number;
  remainingLeadsToday: number;
  remainingAiCallsToday: number;
}

interface AutopilotPanelProps {
  initialConfig: {
    isEnabled: boolean;
    goal: string | null;
    targetJobTitles: string[];
    targetIndustries: string[];
    targetCountries: string[];
    dailySearchLimit: number;
    dailyMessageLimit: number;
    maxLeadsPerRun: number;
    maxLeadsPerDay: number;
    maxAiCallsPerDay: number;
    autoCreateCampaigns: boolean;
    serviceId: string | null;
    lastRunAt: string | null;
    nextRunAt: string | null;
    lastRunResult: {
      profilesFound?: number;
      newLeadsCreated?: number;
      leadsProcessed?: number;
      emailsSent?: number;
      discoveryMode?: string;
      log?: string[];
      status?: string;
      error?: string;
      startedAt?: string;
      finishedAt?: string;
    } | null;
    service: { id: string; name: string } | null;
    activeCampaign: { id: string; name: string } | null;
  };
  usage: AutopilotUsage | null;
  services: Array<{ id: string; name: string }>;
  emailConfigured: boolean;
}

export function AutopilotPanel({
  initialConfig,
  usage: initialUsage,
  services,
  emailConfigured,
}: AutopilotPanelProps) {
  const router = useRouter();
  const [config, setConfig] = useState(initialConfig);
  const [usage] = useState(initialUsage);
  const [isSaving, setIsSaving] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  const limitsReached =
    usage &&
    (usage.remainingLeadsToday <= 0 ||
      usage.remainingAiCallsToday <= 0 ||
      usage.dailyMessageCount >= usage.dailyMessageLimit);

  async function saveConfig(updates: Partial<typeof config>) {
    setIsSaving(true);
    try {
      const res = await fetch("/api/autopilot", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isEnabled: updates.isEnabled ?? config.isEnabled,
          goal: updates.goal ?? config.goal,
          targetJobTitles: (updates.targetJobTitles ?? config.targetJobTitles).length
            ? (updates.targetJobTitles ?? config.targetJobTitles)
            : config.targetJobTitles,
          targetIndustries: updates.targetIndustries ?? config.targetIndustries,
          targetCountries: updates.targetCountries ?? config.targetCountries,
          dailySearchLimit: updates.dailySearchLimit ?? config.dailySearchLimit,
          dailyMessageLimit: updates.dailyMessageLimit ?? config.dailyMessageLimit,
          maxLeadsPerRun: updates.maxLeadsPerRun ?? config.maxLeadsPerRun,
          maxLeadsPerDay: updates.maxLeadsPerDay ?? config.maxLeadsPerDay,
          maxAiCallsPerDay: updates.maxAiCallsPerDay ?? config.maxAiCallsPerDay,
          autoCreateCampaigns: updates.autoCreateCampaigns ?? config.autoCreateCampaigns,
          serviceId: updates.serviceId ?? config.serviceId ?? undefined,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message);
      setConfig({ ...config, ...data.data });
      toast.success("Autopilot settings saved");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  }

  async function runNow() {
    if (!emailConfigured) {
      toast.error("Configure SMTP email in .env first (SMTP_HOST, SMTP_USER, SMTP_PASSWORD)");
      return;
    }
    if (limitsReached) {
      toast.error("Daily limits reached — autopilot paused until reset (24h)");
      return;
    }
    setIsRunning(true);
    try {
      const res = await fetch("/api/autopilot", { method: "POST" });
      const text = await res.text();
      let data: {
        success?: boolean;
        data?: { started?: boolean; message?: string; profilesFound?: number; automated?: number };
        error?: { message?: string };
      };
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(
          res.status === 504
            ? "Request timed out — deploy latest code for background autopilot"
            : "Server returned invalid response. Check nginx timeout settings."
        );
      }
      if (!data.success) throw new Error(data.error?.message);
      if (res.status === 202 || data.data?.started) {
        toast.success(data.data?.message ?? "Autopilot started — refresh in a few minutes");
        router.refresh();
        return;
      }
      toast.success(
        `Done! Found ${data.data?.profilesFound ?? 0} profiles, automated ${data.data?.automated ?? 0} leads`
      );
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Autopilot run failed");
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-blue-500/30 bg-blue-500/5">
        <CardContent className="pt-4 flex gap-3 text-sm">
          <Shield className="h-5 w-5 shrink-0 text-blue-600" />
          <div>
            <p className="font-medium">Email-only autopilot (LinkedIn disabled)</p>
            <p className="text-muted-foreground mt-1">
              Finds job posts from companies needing freelancers/dev work, creates leads with email,
              and sends outreach via your SMTP. Max 5 leads/run, 15 AI calls/day. No LinkedIn automation.
            </p>
          </div>
        </CardContent>
      </Card>

      {usage && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Today&apos;s usage</CardTitle>
            {limitsReached && (
              <CardDescription className="text-amber-600">
                Daily limit reached — autopilot paused until counters reset.
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="grid gap-2 text-sm md:grid-cols-3">
            <p>
              New leads: {usage.dailyLeadsCreated} / {usage.maxLeadsPerDay}
              {usage.remainingLeadsToday <= 0 && " (limit reached)"}
            </p>
            <p>
              AI calls: {usage.dailyAiCalls} / {usage.maxAiCallsPerDay}
            </p>
            <p>
              Emails sent today: {usage.dailyMessageCount} / {usage.dailyMessageLimit}
            </p>
          </CardContent>
        </Card>
      )}

      {!emailConfigured && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="pt-4 text-sm">
            Configure email in your server <code className="text-xs">.env</code>:{" "}
            <strong>SMTP_HOST</strong>, <strong>SMTP_USER</strong>, <strong>SMTP_PASSWORD</strong>
            before running autopilot.
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          <Badge variant={config.isEnabled ? "default" : "secondary"}>
            {config.isEnabled ? "Autopilot ON" : "Autopilot OFF"}
          </Badge>
          {limitsReached && config.isEnabled && (
            <Badge variant="outline" className="border-amber-500 text-amber-700">
              Paused — daily limit
            </Badge>
          )}
          {config.lastRunResult?.status === "running" && (
            <Badge variant="outline" className="animate-pulse">
              Running...
            </Badge>
          )}
          {config.nextRunAt && new Date(config.nextRunAt) > new Date() && (
            <span className="text-sm text-muted-foreground">
              Next run after {format(new Date(config.nextRunAt), "h:mm a")}
            </span>
          )}
          {config.activeCampaign && (
            <span className="text-sm text-muted-foreground">
              Campaign: {config.activeCampaign.name}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => saveConfig({ isEnabled: !config.isEnabled })}
            disabled={isSaving}
          >
            <Zap className="mr-2 h-4 w-4" />
            {config.isEnabled ? "Disable" : "Enable"} Autopilot
          </Button>
          <Button
            onClick={runNow}
            disabled={isRunning || !emailConfigured || !!limitsReached}
          >
            {isRunning ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            Run Now
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="h-4 w-4" />
            Autopilot Goal
          </CardTitle>
          <CardDescription>
            Describe what freelance/dev jobs to target. Example: companies posting React, Node, or MVP build requirements in the US.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={config.goal ?? ""}
            onChange={(e) => setConfig({ ...config, goal: e.target.value })}
            placeholder="e.g. Find US startups posting freelance React/Node jobs or contract dev work for SaaS MVPs."
            rows={4}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Job Titles (comma-separated)</Label>
              <Input
                value={config.targetJobTitles.join(", ")}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    targetJobTitles: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                  })
                }
                placeholder="Hiring Manager, CTO, Founder"
              />
            </div>
            <div>
              <Label>Industries</Label>
              <Input
                value={config.targetIndustries.join(", ")}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    targetIndustries: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                  })
                }
                placeholder="SaaS, FinTech"
              />
            </div>
            <div>
              <Label>Countries</Label>
              <Input
                value={config.targetCountries.join(", ")}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    targetCountries: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                  })
                }
                placeholder="United States, UK"
              />
            </div>
            <div>
              <Label>Service</Label>
              <Select
                value={config.serviceId ?? ""}
                onValueChange={(v) => setConfig({ ...config, serviceId: v || null })}
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
              <Label>Max leads per run</Label>
              <Input
                type="number"
                min={1}
                max={25}
                value={config.maxLeadsPerRun}
                onChange={(e) =>
                  setConfig({ ...config, maxLeadsPerRun: Number(e.target.value) })
                }
              />
            </div>
            <div>
              <Label>Max new leads per day</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={config.maxLeadsPerDay}
                onChange={(e) =>
                  setConfig({ ...config, maxLeadsPerDay: Number(e.target.value) })
                }
              />
            </div>
            <div>
              <Label>Daily discovery runs</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={config.dailySearchLimit}
                onChange={(e) =>
                  setConfig({ ...config, dailySearchLimit: Number(e.target.value) })
                }
              />
            </div>
            <div>
              <Label>Daily emails sent</Label>
              <Input
                type="number"
                min={1}
                max={25}
                value={config.dailyMessageLimit}
                onChange={(e) =>
                  setConfig({ ...config, dailyMessageLimit: Number(e.target.value) })
                }
              />
            </div>
            <div>
              <Label>Daily AI calls (Claude)</Label>
              <Input
                type="number"
                min={5}
                max={30}
                value={config.maxAiCallsPerDay}
                onChange={(e) =>
                  setConfig({ ...config, maxAiCallsPerDay: Number(e.target.value) })
                }
              />
            </div>
          </div>
          <Button onClick={() => saveConfig({})} disabled={isSaving}>
            Save Settings
          </Button>
        </CardContent>
      </Card>

      {config.lastRunResult?.status === "failed" && (
        <Card className="border-destructive/50">
          <CardContent className="pt-4 text-sm text-destructive">
            Last run failed: {config.lastRunResult.error}
          </CardContent>
        </Card>
      )}

      {config.lastRunAt && config.lastRunResult?.status !== "running" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Last Run</CardTitle>
            <CardDescription>
              {format(new Date(config.lastRunAt), "MMM d, yyyy h:mm a")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {config.lastRunResult && (
              <div className="space-y-2 text-sm">
                <p>Job posts matched: {config.lastRunResult.profilesFound ?? 0}</p>
                <p>New leads created: {config.lastRunResult.newLeadsCreated ?? 0}</p>
                <p>Emails sent: {config.lastRunResult.emailsSent ?? config.lastRunResult.automated ?? 0}</p>
                {config.lastRunResult.log && (
                  <ul className="mt-2 text-muted-foreground list-disc list-inside">
                    {config.lastRunResult.log.map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
