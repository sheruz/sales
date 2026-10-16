"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Bot,
  CheckCircle2,
  Globe,
  Loader2,
  Mail,
  Plug,
  Shield,
  Unplug,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

interface IntegrationItem {
  platform: string;
  name: string;
  description: string;
  monthlyPriceLabel: string;
  fields: Array<{ key: string; label: string; type: string; placeholder?: string; required?: boolean }>;
  isConnected: boolean;
  maskedPreview: string | null;
  lastError?: string | null;
  staleAccountId?: string | null;
  staleEmail?: string | null;
}

interface EmailAccountSummary {
  id: string;
  provider: string;
  email: string;
  status: string;
}

interface IntegrationsPanelProps {
  initialData: {
    outreachSettings: {
      activeAiProvider: string;
      economyModel: string;
      qualityModel: string;
      enabledChannels: string[];
      discoveryMode: string;
    };
    integrations: IntegrationItem[];
    gmailAccount?: EmailAccountSummary | null;
    outlookAccount?: EmailAccountSummary | null;
    staleGmail?: EmailAccountSummary | null;
    staleOutlook?: EmailAccountSummary | null;
  };
}

export function IntegrationsPanel({ initialData }: IntegrationsPanelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState(initialData);
  const [saving, setSaving] = useState<string | null>(null);

  const [openAiKey, setOpenAiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [googlePlacesKey, setGooglePlacesKey] = useState("");
  const [hunterKey, setHunterKey] = useState("");
  const [emailForm, setEmailForm] = useState({
    smtpHost: "smtp.gmail.com",
    smtpPort: "587",
    smtpUser: "",
    smtpPassword: "",
    fromName: "",
    fromEmail: "",
  });

  const linkedinConnected = searchParams.get("linkedin_connected");
  const linkedinError = searchParams.get("linkedin_error");
  const gmailConnected = searchParams.get("gmail_connected");
  const gmailError = searchParams.get("gmail_error");
  const outlookConnected = searchParams.get("outlook_connected");
  const outlookError = searchParams.get("outlook_error");

  useEffect(() => {
    if (linkedinConnected) toast.success("LinkedIn account connected");
    if (linkedinError) toast.error(`LinkedIn: ${linkedinError}`);
    if (gmailConnected) toast.success("Gmail connected");
    if (gmailError) toast.error(`Gmail: ${gmailError}`);
    if (outlookConnected) toast.success("Outlook connected");
    if (outlookError) toast.error(`Outlook: ${outlookError}`);
  }, [
    linkedinConnected,
    linkedinError,
    gmailConnected,
    gmailError,
    outlookConnected,
    outlookError,
  ]);

  function getIntegration(platform: string) {
    return data.integrations.find((i) => i.platform === platform);
  }

  function toggleChannel(channel: "email" | "linkedin") {
    const current = data.outreachSettings.enabledChannels;
    const next = current.includes(channel)
      ? current.filter((c) => c !== channel)
      : [...current, channel];
    if (next.length === 0) {
      toast.error("At least one outreach channel must stay enabled");
      return;
    }
    void saveOutreach({ enabledChannels: next });
  }

  async function saveOutreach(updates: Partial<typeof data.outreachSettings>) {
    setSaving("outreach");
    try {
      const res = await fetch("/api/integrations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      setData({ ...data, outreachSettings: { ...data.outreachSettings, ...json.data } });
      toast.success("AI preferences saved");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(null);
    }
  }

  async function connectOpenAi() {
    setSaving("OPENAI");
    try {
      const res = await fetch("/api/integrations/openai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: openAiKey }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      toast.success("OpenAI connected");
      setOpenAiKey("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(null);
    }
  }

  async function connectAnthropic() {
    setSaving("ANTHROPIC");
    try {
      const res = await fetch("/api/integrations/anthropic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: anthropicKey }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      toast.success("Anthropic connected");
      setAnthropicKey("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(null);
    }
  }

  async function connectGooglePlaces() {
    setSaving("GOOGLE_PLACES");
    try {
      const res = await fetch("/api/integrations/google-places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: googlePlacesKey }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      toast.success("Google Places connected");
      setGooglePlacesKey("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(null);
    }
  }

  async function connectHunter() {
    setSaving("HUNTER");
    try {
      const res = await fetch("/api/integrations/hunter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: hunterKey }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      toast.success("Hunter.io connected");
      setHunterKey("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(null);
    }
  }

  async function connectGmail() {
    setSaving("GMAIL");
    try {
      const res = await fetch("/api/integrations/gmail/oauth");
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      window.location.href = json.data.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
      setSaving(null);
    }
  }

  async function connectOutlook() {
    setSaving("OUTLOOK");
    try {
      const res = await fetch("/api/integrations/outlook/oauth");
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      window.location.href = json.data.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
      setSaving(null);
    }
  }

  async function connectEmail() {
    setSaving("EMAIL_SMTP");
    try {
      const res = await fetch("/api/integrations/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...emailForm,
          smtpPort: Number(emailForm.smtpPort),
          smtpSecure: false,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      toast.success("Email connected — test message sent");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(null);
    }
  }

  async function disconnect(platform: string) {
    const route =
      platform === "OPENAI"
        ? "openai"
        : platform === "ANTHROPIC"
          ? "anthropic"
          : platform === "EMAIL_SMTP"
            ? "email"
            : platform === "GOOGLE_PLACES"
              ? "google-places"
              : platform.toLowerCase();
    setSaving(`disconnect-${platform}`);
    try {
      const res = await fetch(`/api/integrations/${route}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      toast.success("Disconnected");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(null);
    }
  }

  async function removeEmailAccount(accountId: string) {
    setSaving(`remove-${accountId}`);
    try {
      const res = await fetch(`/api/email-accounts/${accountId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      toast.success("Removed");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(null);
    }
  }

  const openAi = getIntegration("OPENAI");
  const anthropic = getIntegration("ANTHROPIC");
  const email = getIntegration("EMAIL_SMTP");
  const linkedin = getIntegration("LINKEDIN");
  const gmailActive = data.gmailAccount ?? null;
  const outlookActive = data.outlookAccount ?? null;
  const staleGmail = data.staleGmail ?? null;
  const staleOutlook = data.staleOutlook ?? null;

  return (
    <div className="space-y-6">
      <Card className="border-blue-500/30 bg-blue-500/5">
        <CardContent className="pt-4 flex gap-3 text-sm">
          <Shield className="h-5 w-5 shrink-0 text-blue-600" />
          <div>
            <p className="font-medium">Your keys, your accounts — we never share them</p>
            <p className="text-muted-foreground mt-1">
              Credentials are encrypted at rest. You pay OpenAI, Anthropic, and email providers directly.
              Our platform fee applies only to paid integrations like LinkedIn.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="h-4 w-4" />
            AI Provider Preferences
          </CardTitle>
          <CardDescription>
            Economy model for discovery/research. Quality model for emails and replies.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Active AI provider</Label>
            <Select
              value={data.outreachSettings.activeAiProvider}
              onValueChange={(v) => saveOutreach({ activeAiProvider: v as "OPENAI" | "ANTHROPIC" })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="OPENAI">OpenAI (recommended)</SelectItem>
                <SelectItem value="ANTHROPIC">Anthropic (Claude)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Discovery mode</Label>
            <Select
              value={data.outreachSettings.discoveryMode}
              onValueChange={(v) => saveOutreach({ discoveryMode: v as "job_posts" | "linkedin" })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="job_posts">Job posts (recommended)</SelectItem>
                <SelectItem value="linkedin">LinkedIn search</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Economy model (discovery, research)</Label>
            <Input
              value={data.outreachSettings.economyModel}
              onChange={(e) => setData({ ...data, outreachSettings: { ...data.outreachSettings, economyModel: e.target.value } })}
              onBlur={() => saveOutreach({ economyModel: data.outreachSettings.economyModel })}
              placeholder="gpt-4o-mini"
            />
          </div>
          <div>
            <Label>Quality model (emails, replies)</Label>
            <Input
              value={data.outreachSettings.qualityModel}
              onChange={(e) => setData({ ...data, outreachSettings: { ...data.outreachSettings, qualityModel: e.target.value } })}
              onBlur={() => saveOutreach({ qualityModel: data.outreachSettings.qualityModel })}
              placeholder="gpt-4o"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Outreach channels</CardTitle>
          <CardDescription>
            Choose how autopilot contacts leads. Email-only is recommended and safest.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={data.outreachSettings.enabledChannels.includes("email")}
              onChange={() => toggleChannel("email")}
              className="h-4 w-4 rounded border"
            />
            Email (SMTP)
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={data.outreachSettings.enabledChannels.includes("linkedin")}
              onChange={() => toggleChannel("linkedin")}
              className="h-4 w-4 rounded border"
            />
            LinkedIn (requires connected account)
          </label>
        </CardContent>
      </Card>

      <IntegrationCard
        icon={<Bot className="h-5 w-5" />}
        title="OpenAI"
        description={openAi?.description ?? ""}
        price={openAi?.monthlyPriceLabel ?? "Bring your own key"}
        connected={openAi?.isConnected ?? false}
        preview={openAi?.maskedPreview}
      >
        {openAi?.isConnected ? (
          <Button variant="outline" size="sm" onClick={() => disconnect("OPENAI")} disabled={!!saving}>
            <Unplug className="mr-2 h-4 w-4" /> Disconnect
          </Button>
        ) : (
          <div className="flex gap-2">
            <Input type="password" placeholder="sk-proj-..." value={openAiKey} onChange={(e) => setOpenAiKey(e.target.value)} />
            <Button onClick={connectOpenAi} disabled={saving === "OPENAI"}>
              {saving === "OPENAI" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="mr-2 h-4 w-4" />}
              Connect
            </Button>
          </div>
        )}
      </IntegrationCard>

      <IntegrationCard
        icon={<Bot className="h-5 w-5" />}
        title="Anthropic (Claude)"
        description={anthropic?.description ?? ""}
        price={anthropic?.monthlyPriceLabel ?? "Bring your own key"}
        connected={anthropic?.isConnected ?? false}
        preview={anthropic?.maskedPreview}
      >
        {anthropic?.isConnected ? (
          <Button variant="outline" size="sm" onClick={() => disconnect("ANTHROPIC")} disabled={!!saving}>
            <Unplug className="mr-2 h-4 w-4" /> Disconnect
          </Button>
        ) : (
          <div className="flex gap-2">
            <Input type="password" placeholder="sk-ant-..." value={anthropicKey} onChange={(e) => setAnthropicKey(e.target.value)} />
            <Button onClick={connectAnthropic} disabled={saving === "ANTHROPIC"}>
              Connect
            </Button>
          </div>
        )}
      </IntegrationCard>

      <IntegrationCard
        icon={<Globe className="h-5 w-5" />}
        title="Google Places"
        description={
          getIntegration("GOOGLE_PLACES")?.description ??
          "Places API (New) for Autopilot business sourcing."
        }
        price="Bring your own key"
        connected={getIntegration("GOOGLE_PLACES")?.isConnected ?? false}
        preview={getIntegration("GOOGLE_PLACES")?.maskedPreview}
      >
        {getIntegration("GOOGLE_PLACES")?.isConnected ? (
          <div className="flex gap-2 items-center">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span className="text-sm">Connected</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => disconnect("GOOGLE_PLACES")}
              disabled={!!saving}
            >
              Disconnect
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Input
              type="password"
              placeholder="AIza..."
              value={googlePlacesKey}
              onChange={(e) => setGooglePlacesKey(e.target.value)}
            />
            <Button
              onClick={connectGooglePlaces}
              disabled={saving === "GOOGLE_PLACES"}
            >
              Connect
            </Button>
          </div>
        )}
      </IntegrationCard>

      <IntegrationCard
        icon={<Shield className="h-5 w-5" />}
        title="Hunter.io"
        description={
          getIntegration("HUNTER")?.description ??
          "Find and verify decision-maker emails by domain."
        }
        price="Bring your own key"
        connected={getIntegration("HUNTER")?.isConnected ?? false}
        preview={getIntegration("HUNTER")?.maskedPreview}
      >
        {getIntegration("HUNTER")?.isConnected ? (
          <div className="flex gap-2 items-center">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span className="text-sm">Connected</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => disconnect("HUNTER")}
              disabled={!!saving}
            >
              Disconnect
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Input
              type="password"
              placeholder="Hunter API key"
              value={hunterKey}
              onChange={(e) => setHunterKey(e.target.value)}
            />
            <Button onClick={connectHunter} disabled={saving === "HUNTER"}>
              Connect
            </Button>
          </div>
        )}
      </IntegrationCard>

      <IntegrationCard
        icon={<Mail className="h-5 w-5" />}
        title="Gmail"
        description="Connect Gmail via OAuth to send outreach and sync inbox replies (required for Sync inbox)."
        price="Bring your own Google account"
        connected={Boolean(gmailActive)}
        preview={gmailActive?.email ?? null}
        staleLabel={
          !gmailActive && staleGmail
            ? `Disconnected · ${staleGmail.email}`
            : null
        }
      >
        {gmailActive ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => removeEmailAccount(gmailActive.id)}
            disabled={!!saving}
          >
            <Unplug className="mr-2 h-4 w-4" /> Disconnect
          </Button>
        ) : (
          <div className="flex flex-wrap gap-2 items-center">
            {staleGmail && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => removeEmailAccount(staleGmail.id)}
                disabled={!!saving}
              >
                Remove
              </Button>
            )}
            <Button onClick={connectGmail} disabled={saving === "GMAIL"}>
              {saving === "GMAIL" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plug className="mr-2 h-4 w-4" />
              )}
              Connect Gmail
            </Button>
          </div>
        )}
      </IntegrationCard>

      <IntegrationCard
        icon={<Mail className="h-5 w-5" />}
        title="Microsoft Outlook"
        description="Connect Outlook / Microsoft 365 via OAuth for send + inbox sync."
        price="Bring your own Microsoft account"
        connected={Boolean(outlookActive)}
        preview={outlookActive?.email ?? null}
        staleLabel={
          !outlookActive && staleOutlook
            ? `Disconnected · ${staleOutlook.email}`
            : null
        }
      >
        {outlookActive ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => removeEmailAccount(outlookActive.id)}
            disabled={!!saving}
          >
            <Unplug className="mr-2 h-4 w-4" /> Disconnect
          </Button>
        ) : (
          <div className="flex flex-wrap gap-2 items-center">
            {staleOutlook && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => removeEmailAccount(staleOutlook.id)}
                disabled={!!saving}
              >
                Remove
              </Button>
            )}
            <Button onClick={connectOutlook} disabled={saving === "OUTLOOK"}>
              {saving === "OUTLOOK" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plug className="mr-2 h-4 w-4" />
              )}
              Connect Outlook
            </Button>
          </div>
        )}
      </IntegrationCard>

      <IntegrationCard
        icon={<Mail className="h-5 w-5" />}
        title="Email (SMTP)"
        description={email?.description ?? "Outbound SMTP only — use Connect Gmail/Outlook to sync inbound replies"}
        price={email?.monthlyPriceLabel ?? "Bring your own key"}
        connected={email?.isConnected ?? false}
        preview={email?.isConnected ? email?.maskedPreview : null}
        staleLabel={
          !email?.isConnected && email?.staleEmail
            ? `Disconnected · ${email.staleEmail}`
            : null
        }
      >
        {email?.isConnected ? (
          <Button variant="outline" size="sm" onClick={() => disconnect("EMAIL_SMTP")} disabled={!!saving}>
            <Unplug className="mr-2 h-4 w-4" /> Disconnect
          </Button>
        ) : (
          <div className="space-y-3">
            {email?.staleEmail && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  email.staleAccountId
                    ? removeEmailAccount(email.staleAccountId)
                    : disconnect("EMAIL_SMTP")
                }
                disabled={!!saving}
              >
                Remove
              </Button>
            )}
            <div className="grid gap-3 md:grid-cols-2">
              <Input placeholder="SMTP host" value={emailForm.smtpHost} onChange={(e) => setEmailForm({ ...emailForm, smtpHost: e.target.value })} />
              <Input placeholder="Port" value={emailForm.smtpPort} onChange={(e) => setEmailForm({ ...emailForm, smtpPort: e.target.value })} />
              <Input placeholder="SMTP user" value={emailForm.smtpUser} onChange={(e) => setEmailForm({ ...emailForm, smtpUser: e.target.value })} />
              <Input type="password" placeholder="App password" value={emailForm.smtpPassword} onChange={(e) => setEmailForm({ ...emailForm, smtpPassword: e.target.value })} />
              <Input placeholder="From name" value={emailForm.fromName} onChange={(e) => setEmailForm({ ...emailForm, fromName: e.target.value })} />
              <Input placeholder="From email" value={emailForm.fromEmail} onChange={(e) => setEmailForm({ ...emailForm, fromEmail: e.target.value })} />
              <Button className="md:col-span-2" onClick={connectEmail} disabled={saving === "EMAIL_SMTP"}>
                Connect & send test email
              </Button>
            </div>
          </div>
        )}
      </IntegrationCard>

      <IntegrationCard
        icon={<Globe className="h-5 w-5" />}
        title="LinkedIn"
        description={linkedin?.description ?? ""}
        price={linkedin?.monthlyPriceLabel ?? "$9/mo"}
        connected={linkedin?.isConnected ?? false}
        preview={linkedin?.maskedPreview}
      >
        {linkedin?.isConnected ? (
          <div className="flex gap-2 items-center">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span className="text-sm">Connected via official OAuth</span>
            <Button variant="outline" size="sm" onClick={() => disconnect("LINKEDIN")} disabled={!!saving}>
              Disconnect
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Official LinkedIn OAuth only — cookie/session mode is disabled. Sign in on LinkedIn&apos;s login page; we never store your password.
            </p>
            <a href="/api/integrations/linkedin/oauth">
              <Button>
                <Globe className="mr-2 h-4 w-4" />
                Connect LinkedIn Account
              </Button>
            </a>
          </div>
        )}
      </IntegrationCard>
    </div>
  );
}

function IntegrationCard({
  icon,
  title,
  description,
  price,
  connected,
  preview,
  staleLabel,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  price: string;
  connected: boolean;
  preview: string | null | undefined;
  staleLabel?: string | null;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-3">
            {icon}
            <div>
              <CardTitle className="text-base">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
          </div>
          <div className="text-right shrink-0">
            <Badge variant={connected ? "default" : "secondary"}>
              {connected ? "Connected" : "Not connected"}
            </Badge>
            <p className="text-xs text-muted-foreground mt-1">{price}</p>
          </div>
        </div>
        {connected && preview ? (
          <p className="text-xs text-muted-foreground mt-2">Connected as: {preview}</p>
        ) : staleLabel ? (
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">{staleLabel}</p>
        ) : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
