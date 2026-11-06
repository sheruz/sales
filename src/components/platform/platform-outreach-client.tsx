"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlatformPageHeader } from "@/components/platform/ui/page-header";
import { appOps } from "@/lib/app-paths";

type TabKey = "accounts" | "templates" | "campaigns";

type Template = {
  id: string;
  key: string;
  name: string;
  category: string;
  subject: string;
  bodyText: string;
  active: boolean;
};

type Campaign = {
  id: string;
  name: string;
  status: string;
  sendCap: number;
  sentCount: number;
  _count?: { recipients: number };
};

type ContactRow = {
  id: string;
  email: string | null;
  fullName: string;
  companyName: string;
  hasWebsite: boolean;
  country: string | null;
};

export function PlatformOutreachClient({ canWrite }: { canWrite: boolean }) {
  const [tab, setTab] = useState<TabKey>("templates");
  const [sendEnabled, setSendEnabled] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [mailboxes, setMailboxes] = useState<
    Array<{ id: string; emailAccount?: { email?: string; displayName?: string | null; status?: string } }>
  >([]);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [campaignName, setCampaignName] = useState("Studio outreach");
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    subject: string;
    bodyText: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const loadToggle = useCallback(async () => {
    const res = await fetch("/api/platform/outreach/send-toggle");
    const json = await res.json();
    if (json.success) setSendEnabled(Boolean(json.data.enabled));
  }, []);

  const loadTemplates = useCallback(async () => {
    const res = await fetch("/api/platform/outreach/templates");
    const json = await res.json();
    if (json.success) setTemplates(json.data.templates);
  }, []);

  const loadCampaigns = useCallback(async () => {
    const res = await fetch("/api/platform/outreach/campaigns");
    const json = await res.json();
    if (json.success) setCampaigns(json.data.campaigns);
  }, []);

  const loadAccounts = useCallback(async () => {
    const res = await fetch("/api/platform/outreach/accounts");
    const json = await res.json();
    if (json.success) setMailboxes(json.data.mailboxes ?? []);
  }, []);

  useEffect(() => {
    void loadToggle();
    void loadTemplates();
    void loadCampaigns();
    void loadAccounts();
  }, [loadToggle, loadTemplates, loadCampaigns, loadAccounts]);

  async function toggleSend(enabled: boolean) {
    if (!canWrite) return;
    setBusy(true);
    try {
      const res = await fetch("/api/platform/outreach/send-toggle", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, reason: "UI toggle" }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || "Failed");
      setSendEnabled(enabled);
      toast.success(enabled ? "Outreach sending ON" : "Outreach sending OFF");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function searchContacts(q: string) {
    const res = await fetch(
      `/api/platform/outreach/contacts?q=${encodeURIComponent(q)}&limit=40`
    );
    const json = await res.json();
    if (json.success) setContacts(json.data.contacts);
  }

  async function previewTemplate(templateId: string, contactId: string) {
    const res = await fetch("/api/platform/outreach/templates/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId, contactId }),
    });
    const json = await res.json();
    if (!json.success) {
      toast.error(json.error?.message || "Preview failed");
      return;
    }
    setPreview({ subject: json.data.subject, bodyText: json.data.bodyText });
  }

  async function createAndReview() {
    if (!canWrite || selected.length === 0) return;
    setBusy(true);
    try {
      const createRes = await fetch("/api/platform/outreach/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: campaignName, sendCap: 50 }),
      });
      const createJson = await createRes.json();
      if (!createJson.success) {
        throw new Error(createJson.error?.message || "Create failed");
      }
      const id = createJson.data.campaign.id as string;
      setActiveCampaignId(id);
      const revRes = await fetch(`/api/platform/outreach/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "review", contactIds: selected }),
      });
      const revJson = await revRes.json();
      if (!revJson.success) {
        throw new Error(revJson.error?.message || "Review failed");
      }
      toast.success(
        `Review ready — ${revJson.data.results.filter((r: { status: string }) => r.status === "READY").length} ready`
      );
      await loadCampaigns();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function launch(mode: "now" | "window") {
    if (!canWrite || !activeCampaignId) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/platform/outreach/campaigns/${activeCampaignId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "launch", mode }),
        }
      );
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || "Launch failed");
      const processed = json.data.processed ?? 0;
      const results = (json.data.sendResults ?? []) as Array<{
        status?: string;
        reason?: string;
      }>;
      const sentReal = results.filter(
        (r) => r.status === "sent" || r.status === "sent_shadow"
      ).length;
      const held = results.filter((r) => r.status === "held");
      if (mode === "now" && sentReal > 0) {
        toast.success(
          `Sent ${sentReal}` +
            (held.length ? ` · ${held.length} held` : "")
        );
      } else if (mode === "now" && held[0]?.reason) {
        toast.message(
          `Queued ${json.data.queued} but held: ${held[0].reason}`
        );
      } else {
        toast.success(
          `Queued ${json.data.queued}` +
            (processed ? ` · processed ${processed}` : "")
        );
      }
      await loadCampaigns();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function pause(id: string) {
    if (!canWrite) return;
    const res = await fetch(`/api/platform/outreach/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "pause" }),
    });
    const json = await res.json();
    if (!json.success) {
      toast.error(json.error?.message || "Pause failed");
      return;
    }
    toast.success("Campaign paused");
    await loadCampaigns();
  }

  async function testMailbox(mailboxId: string) {
    if (!canWrite) return;
    setBusy(true);
    try {
      const res = await fetch("/api/platform/outreach/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mailboxId }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || "Test failed");
      toast.success("Test sent");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PlatformPageHeader
        title="Outreach"
        description="Default Workspace only — same inbox, sequences, suppressions and limits. Not system/transactional email."
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={sendEnabled ? "default" : "outline"}>
              Sending {sendEnabled ? "ON" : "OFF"}
            </Badge>
            {canWrite ? (
              <Button
                size="sm"
                variant={sendEnabled ? "outline" : "default"}
                disabled={busy}
                onClick={() => void toggleSend(!sendEnabled)}
              >
                Turn {sendEnabled ? "OFF" : "ON"}
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground">View only</span>
            )}
          </div>
        }
      />

      <p className="text-sm text-muted-foreground">
        Connect outreach mailboxes in the Default Workspace Autopilot outbound
        pool ({" "}
        <Link className="underline" href="/dashboard/outreach?tab=mailboxes">
          tenant mailboxes
        </Link>
        ). Use a separate domain (e.g. delvixstudio.co). System email stays on{" "}
        <Link className="underline" href={appOps("/emails")}>
          Email templates
        </Link>
        .
      </p>

      <Tabs value={tab} onValueChange={(v) => v && setTab(v as TabKey)}>
        <TabsList>
          <TabsTrigger value="accounts">Email accounts</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "accounts" ? (
        <Card>
          <CardHeader>
            <CardTitle>Outreach mailboxes</CardTitle>
            <CardDescription>
              Accounts on the Default Workspace outbound pool. Connect via Google /
              Microsoft / SMTP in tenant Outbound, then test here.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {mailboxes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No outbound mailboxes yet. Add one under Dashboard → Outreach →
                Mailboxes for Default Workspace.
              </p>
            ) : (
              mailboxes.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded border px-3 py-2"
                >
                  <div>
                    <div className="font-medium">
                      {m.emailAccount?.displayName ||
                        m.emailAccount?.email ||
                        m.id}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {m.emailAccount?.email} · {m.emailAccount?.status}
                    </div>
                  </div>
                  {canWrite ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void testMailbox(m.id)}
                    >
                      Test
                    </Button>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ) : null}

      {tab === "templates" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Templates</CardTitle>
              <CardDescription>
                Seeded A/B/C. Variables: first_name, company_name, website, city,
                business_address, original_subject.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {templates.map((t) => (
                <div key={t.id} className="rounded border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-medium">{t.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {t.category} · {t.key}
                      </div>
                    </div>
                    <Badge variant="secondary">{t.active ? "Active" : "Off"}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{t.subject}</p>
                  {contacts[0] ? (
                    <Button
                      className="mt-2"
                      size="sm"
                      variant="outline"
                      onClick={() => void previewTemplate(t.id, contacts[0].id)}
                    >
                      Preview with first contact
                    </Button>
                  ) : null}
                </div>
              ))}
              <div className="flex gap-2">
                <Input
                  placeholder="Search contacts for preview…"
                  onChange={(e) => void searchContacts(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Live preview</CardTitle>
            </CardHeader>
            <CardContent>
              {preview ? (
                <div className="space-y-2">
                  <div className="text-sm font-medium">{preview.subject}</div>
                  <Textarea readOnly rows={16} value={preview.bodyText} />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Search a contact, then preview a template.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {tab === "campaigns" ? (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Send to clients</CardTitle>
              <CardDescription>
                Auto-picks has-website vs no-website templates. Cap default 50.
                Follow-up day 4 stops on reply (AI classifier).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Input
                  className="max-w-xs"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="Campaign name"
                />
                <Input
                  className="max-w-xs"
                  placeholder="Search contacts…"
                  onChange={(e) => void searchContacts(e.target.value)}
                />
              </div>
              <div className="max-h-56 space-y-1 overflow-auto rounded border p-2">
                {contacts.map((c) => {
                  const on = selected.includes(c.id);
                  return (
                    <label
                      key={c.id}
                      className="flex cursor-pointer items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() =>
                          setSelected((prev) =>
                            on
                              ? prev.filter((x) => x !== c.id)
                              : [...prev, c.id]
                          )
                        }
                      />
                      <span>
                        {c.fullName} · {c.email} · {c.companyName}{" "}
                        <span className="text-muted-foreground">
                          ({c.hasWebsite ? "has site" : "no site"})
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
              {canWrite ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={busy || selected.length === 0}
                    onClick={() => void createAndReview()}
                  >
                    Review ({selected.length})
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy || !activeCampaignId || !sendEnabled}
                    onClick={() => void launch("window")}
                  >
                    Schedule 8–11 local
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy || !activeCampaignId || !sendEnabled}
                    onClick={() => void launch("now")}
                  >
                    Send now
                  </Button>
                </div>
              ) : null}
              {!sendEnabled ? (
                <p className="text-sm text-amber-600">
                  Outreach sending is OFF — turn it on above after address + DNS
                  checks.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Campaigns</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {campaigns.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded border px-3 py-2"
                >
                  <div>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.status} · sent {c.sentCount}/{c.sendCap} · recipients{" "}
                      {c._count?.recipients ?? "—"}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setActiveCampaignId(c.id)}
                    >
                      Select
                    </Button>
                    {canWrite && c.status !== "PAUSED" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void pause(c.id)}
                      >
                        Pause
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
