"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import { Bot, Loader2, Play, Zap } from "lucide-react";
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

interface AutopilotPanelProps {
  initialConfig: {
    isEnabled: boolean;
    goal: string | null;
    targetJobTitles: string[];
    targetIndustries: string[];
    targetCountries: string[];
    dailySearchLimit: number;
    dailyMessageLimit: number;
    autoCreateCampaigns: boolean;
    serviceId: string | null;
    lastRunAt: string | null;
    lastRunResult: {
      profilesFound?: number;
      leadsProcessed?: number;
      automated?: number;
      log?: string[];
    } | null;
    service: { id: string; name: string } | null;
    activeCampaign: { id: string; name: string } | null;
  };
  services: Array<{ id: string; name: string }>;
  linkedInConnected: boolean;
}

export function AutopilotPanel({
  initialConfig,
  services,
  linkedInConnected,
}: AutopilotPanelProps) {
  const router = useRouter();
  const [config, setConfig] = useState(initialConfig);
  const [isSaving, setIsSaving] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

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
    if (!linkedInConnected) {
      toast.error("Connect LinkedIn in Settings first");
      return;
    }
    setIsRunning(true);
    try {
      const res = await fetch("/api/autopilot", { method: "POST" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message);
      toast.success(
        `Done! Found ${data.data.profilesFound} profiles, automated ${data.data.automated} leads`
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
      {!linkedInConnected && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="pt-4 text-sm">
            Connect your LinkedIn account in{" "}
            <a href="/dashboard/settings" className="underline font-medium">
              Settings → LinkedIn
            </a>{" "}
            before enabling autopilot.
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant={config.isEnabled ? "default" : "secondary"}>
            {config.isEnabled ? "Autopilot ON" : "Autopilot OFF"}
          </Badge>
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
          <Button onClick={runNow} disabled={isRunning || !linkedInConnected}>
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
            Describe what you want. AI will create campaigns, search LinkedIn, create leads, and send outreach automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={config.goal ?? ""}
            onChange={(e) => setConfig({ ...config, goal: e.target.value })}
            placeholder="e.g. Find 25 SaaS CTOs in the US interested in custom web development. Target companies with 50-500 employees."
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
                placeholder="CTO, VP Engineering"
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
              <Label>Daily Search Limit</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={config.dailySearchLimit}
                onChange={(e) =>
                  setConfig({ ...config, dailySearchLimit: Number(e.target.value) })
                }
              />
            </div>
            <div>
              <Label>Daily Message Limit</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={config.dailyMessageLimit}
                onChange={(e) =>
                  setConfig({ ...config, dailyMessageLimit: Number(e.target.value) })
                }
              />
            </div>
          </div>
          <Button onClick={() => saveConfig({})} disabled={isSaving}>
            Save Settings
          </Button>
        </CardContent>
      </Card>

      {config.lastRunAt && (
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
                <p>Profiles found: {config.lastRunResult.profilesFound ?? 0}</p>
                <p>Leads processed: {config.lastRunResult.leadsProcessed ?? 0}</p>
                <p>Automated: {config.lastRunResult.automated ?? 0}</p>
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
