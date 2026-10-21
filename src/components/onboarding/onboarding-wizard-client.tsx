"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { appHome } from "@/lib/app-paths";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { OnboardingStep } from "@/lib/onboarding/steps";

type Snapshot = {
  dismissed: boolean;
  progress: {
    currentStep: string;
    completedSteps: string[];
    skipped: boolean;
    completedAt: string | null;
    payload: Record<string, unknown>;
  };
  review: {
    hasProfile: boolean;
    servicesCount: number;
    icpsCount: number;
    mailboxesCount: number;
    hasBrandingAddress: boolean;
    aiReady: boolean;
  };
  allowedIntegrations: Array<{
    id: string;
    label: string;
    allowed: boolean;
  }>;
  wizardSteps: Array<{
    id: string;
    title: string;
    blurb: string;
    done: boolean;
  }>;
  readiness: {
    percentComplete: number;
    steps: Array<{ id: string; label: string; done: boolean; href: string }>;
  };
};

type IcpTpl = {
  id: string;
  name: string;
  description: string;
};

export function OnboardingWizardClient() {
  const router = useRouter();
  const [data, setData] = useState<Snapshot | null>(null);
  const [step, setStep] = useState<OnboardingStep>("business_profile");
  const [busy, setBusy] = useState(false);
  const [templates, setTemplates] = useState<IcpTpl[]>([]);

  // Step forms
  const [companyName, setCompanyName] = useState("");
  const [website, setWebsite] = useState("");
  const [description, setDescription] = useState("");
  const [serviceName, setServiceName] = useState("");
  const [serviceDesc, setServiceDesc] = useState("");
  const [caseStudy, setCaseStudy] = useState("");
  const [senderName, setSenderName] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/onboarding");
    const json = await res.json();
    if (!json.success) {
      toast.error(json.error?.message || "Failed to load onboarding");
      return;
    }
    const snap = json.data as Snapshot;
    setData(snap);
    setStep((snap.progress.currentStep as OnboardingStep) || "business_profile");
  }, []);

  useEffect(() => {
    void load();
    void (async () => {
      const res = await fetch("/api/onboarding/icp-template");
      const json = await res.json();
      if (json.success) setTemplates(json.data.templates || []);
    })();
  }, [load]);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "Update failed");
        return null;
      }
      setData(json.data as Snapshot);
      if (json.data.progress?.currentStep) {
        setStep(json.data.progress.currentStep);
      }
      return json.data;
    } finally {
      setBusy(false);
    }
  }

  async function skipAll() {
    await patch({ skipped: true });
    toast.message("Setup skipped — you can resume anytime from the sidebar");
    router.replace(appHome());
  }

  async function saveProfile() {
    if (!companyName.trim()) {
      toast.error("Company name is required");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/business-brain/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: companyName.trim(),
          website: website.trim() || null,
          description: description.trim() || null,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "Could not save profile");
        return;
      }
      await patch({ markDone: "business_profile" });
      toast.success("Profile saved");
    } finally {
      setBusy(false);
    }
  }

  async function saveService() {
    if (!serviceName.trim()) {
      toast.error("Service name required");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: serviceName.trim(),
          description: serviceDesc.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "Could not create service");
        return;
      }
      const serviceId = json.data?.id || json.data?.service?.id;
      if (caseStudy.trim() && serviceId) {
        await fetch("/api/business-brain/documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "CASE_STUDY",
            title: `${serviceName.trim()} case study`,
            content: caseStudy.trim(),
          }),
        }).catch(() => null);
      }
      await patch({ markDone: "services_case_studies" });
      toast.success("Service added");
    } finally {
      setBusy(false);
    }
  }

  async function pickIcp(templateId: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/onboarding/icp-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "ICP create failed");
        return;
      }
      await load();
      toast.success("ICP created from template");
    } finally {
      setBusy(false);
    }
  }

  async function saveBranding() {
    setBusy(true);
    try {
      const res = await fetch("/api/settings/email-branding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderName: senderName.trim() || undefined,
          businessAddress: businessAddress.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "Branding save failed");
        return;
      }
      await patch({ markDone: "email_branding" });
      toast.success("Branding saved");
    } finally {
      setBusy(false);
    }
  }

  async function startAutopilotShadow() {
    setBusy(true);
    try {
      const res = await fetch("/api/autopilot/outbound", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shadowMode: true, enabled: true }),
      });
      const json = await res.json();
      if (!json.success) {
        // Still complete wizard even if outbound config shape differs
        toast.message(json.error?.message || "Outbound config update skipped");
      }
      await patch({ complete: true, markDone: "start_autopilot" });
      toast.success("Autopilot ready in shadow mode");
      router.replace(appHome("/autopilot"));
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return <p className="text-sm text-muted-foreground p-6">Loading setup…</p>;
  }

  const meta = data.wizardSteps.find((s) => s.id === step);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Set up your workspace
          </h1>
          <p className="text-sm text-muted-foreground">
            Skippable and resumable. Sidebar checklist stays until you finish.
          </p>
        </div>
        <Button variant="ghost" disabled={busy} onClick={() => void skipAll()}>
          Skip for now
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {data.wizardSteps.map((s, i) => (
          <button
            key={s.id}
            type="button"
            className={`rounded-full border px-2.5 py-1 text-xs ${
              s.id === step
                ? "border-primary bg-primary/10 font-medium"
                : s.done
                  ? "border-muted text-muted-foreground"
                  : "border-border"
            }`}
            onClick={() => setStep(s.id as OnboardingStep)}
          >
            {i + 1}. {s.title}
            {s.done ? " ✓" : ""}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{meta?.title || step}</CardTitle>
          <CardDescription>{meta?.blurb}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === "business_profile" && (
            <>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">
                  Company name
                </label>
                <Input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Acme Co"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Website</label>
                <Input
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://…"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">
                  Short description
                </label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>
              <Button disabled={busy} onClick={() => void saveProfile()}>
                Save & continue
              </Button>
            </>
          )}

          {step === "services_case_studies" && (
            <>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">
                  Service name
                </label>
                <Input
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  placeholder="Website redesign"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">
                  Description
                </label>
                <Textarea
                  value={serviceDesc}
                  onChange={(e) => setServiceDesc(e.target.value)}
                  rows={2}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">
                  Case study (optional)
                </label>
                <Textarea
                  value={caseStudy}
                  onChange={(e) => setCaseStudy(e.target.value)}
                  rows={3}
                  placeholder="How you helped a similar client…"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button disabled={busy} onClick={() => void saveService()}>
                  Save & continue
                </Button>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => void patch({ markDone: "services_case_studies" })}
                >
                  Skip step
                </Button>
              </div>
            </>
          )}

          {step === "target_customers" && (
            <div className="grid gap-3 sm:grid-cols-2">
              {templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  disabled={busy}
                  className="rounded-lg border p-3 text-left hover:bg-muted/50"
                  onClick={() => void pickIcp(t.id)}
                >
                  <div className="font-medium text-sm">{t.name}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t.description}
                  </p>
                </button>
              ))}
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void patch({ markDone: "target_customers" })}
              >
                Skip — I&apos;ll set ICP later
              </Button>
            </div>
          )}

          {step === "integrations" && (
            <>
              <p className="text-sm text-muted-foreground">
                Only plan-allowed integrations are listed. Connect AI so Autopilot
                can draft.
              </p>
              <ul className="space-y-2">
                {data.allowedIntegrations.map((i) => (
                  <li
                    key={i.id}
                    className="flex items-center justify-between text-sm border rounded-md px-3 py-2"
                  >
                    <span>
                      {i.label}{" "}
                      {!i.allowed ? (
                        <Badge variant="secondary">Not on plan</Badge>
                      ) : null}
                    </span>
                    {i.allowed ? (
                      <Link
                        href={appHome("/settings?tab=integrations")}
                        className="underline text-xs"
                      >
                        Connect
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Upgrade to unlock
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              <Button
                disabled={busy}
                onClick={() => void patch({ markDone: "integrations" })}
              >
                Continue
              </Button>
            </>
          )}

          {step === "mailbox_dns" && (
            <>
              <p className="text-sm text-muted-foreground">
                Add a sending mailbox and refresh DNS (SPF/DKIM) from Outreach →
                Mailboxes. You have {data.review.mailboxesCount} mailbox
                {data.review.mailboxesCount === 1 ? "" : "s"} now.
              </p>
              <div className="flex flex-wrap gap-2 items-center">
                <Link
                  href={appHome("/outreach?tab=mailboxes")}
                  className="inline-flex h-8 items-center rounded-lg border border-border px-2.5 text-sm font-medium hover:bg-muted"
                >
                  Open mailboxes
                </Link>
                <Button
                  disabled={busy}
                  onClick={() => void patch({ markDone: "mailbox_dns" })}
                >
                  Continue
                </Button>
              </div>
            </>
          )}

          {step === "email_branding" && (
            <>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">
                  Sender name
                </label>
                <Input
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">
                  Business address
                </label>
                <Textarea
                  value={businessAddress}
                  onChange={(e) => setBusinessAddress(e.target.value)}
                  rows={2}
                  placeholder="Street, city, country"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button disabled={busy} onClick={() => void saveBranding()}>
                  Save & continue
                </Button>
                <Link
                  href={appHome("/settings?tab=email-branding")}
                  className="text-sm underline self-center"
                >
                  Full branding editor
                </Link>
              </div>
            </>
          )}

          {step === "review" && (
            <>
              <ul className="text-sm space-y-2">
                <li>
                  Profile: {data.review.hasProfile ? "✓" : "—"}
                </li>
                <li>Services: {data.review.servicesCount}</li>
                <li>ICPs: {data.review.icpsCount}</li>
                <li>Mailboxes: {data.review.mailboxesCount}</li>
                <li>
                  Branding address:{" "}
                  {data.review.hasBrandingAddress ? "✓" : "—"}
                </li>
                <li>AI + email ready: {data.review.aiReady ? "✓" : "—"}</li>
              </ul>
              <Button
                disabled={busy}
                onClick={() => void patch({ markDone: "review" })}
              >
                Looks good — continue
              </Button>
            </>
          )}

          {step === "start_autopilot" && (
            <>
              <p className="text-sm text-muted-foreground">
                We&apos;ll enable Autopilot in <strong>shadow mode</strong> —
                drafts and dry-runs only, no live sends until you turn shadow
                off.
              </p>
              <Button disabled={busy} onClick={() => void startAutopilotShadow()}>
                Start Autopilot (shadow)
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
