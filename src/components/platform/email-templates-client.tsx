"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PlatformPageHeader } from "@/components/platform/ui/page-header";
import { formatPlatformDateTime } from "@/lib/platform/format";

type TemplateRow = {
  id: string;
  key: string;
  name: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  variables: string[] | unknown;
  updatedAt: string;
  isCustomized: boolean;
};

type SendRow = {
  id: string;
  organizationId: string | null;
  organizationName: string | null;
  toEmail: string;
  templateKey: string;
  eventKey: string;
  status: string;
  attempts: number;
  error: string | null;
  subject: string | null;
  sentAt: string | null;
  createdAt: string;
};

type Tab = "templates" | "log";

function varsList(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x) => typeof x === "string");
  return [];
}

export function EmailTemplatesClient({
  canWrite,
  actorEmail,
}: {
  canWrite: boolean;
  actorEmail: string;
}) {
  const [tab, setTab] = useState<Tab>("templates");
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [variables, setVariables] = useState<string[]>([]);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewSubject, setPreviewSubject] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const [sends, setSends] = useState<SendRow[]>([]);
  const [sendTotal, setSendTotal] = useState(0);
  const [logStatus, setLogStatus] = useState("");
  const [logTemplate, setLogTemplate] = useState("");
  const [logQ, setLogQ] = useState("");

  const selected = useMemo(
    () => templates.find((t) => t.key === selectedKey) || null,
    [templates, selectedKey]
  );

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/platform/email-templates");
      const json = await res.json();
      if (json.success) {
        setTemplates(json.data.templates || []);
        if (!selectedKey && json.data.templates?.[0]) {
          setSelectedKey(json.data.templates[0].key);
        }
      } else {
        toast.error(json.error?.message || "Failed to load templates");
      }
    } finally {
      setLoading(false);
    }
  }, [selectedKey]);

  const loadDetail = useCallback(async (key: string) => {
    const res = await fetch(`/api/platform/email-templates/${key}`);
    const json = await res.json();
    if (!json.success) {
      toast.error(json.error?.message || "Load failed");
      return;
    }
    const t = json.data.template;
    setSubject(t.subject);
    setBodyHtml(t.bodyHtml);
    setBodyText(t.bodyText);
    setVariables(varsList(t.variables));
    setPreviewSubject(json.data.preview?.subject || t.subject);
    setPreviewHtml(json.data.preview?.brandedHtml || "");
  }, []);

  const loadLog = useCallback(async () => {
    const sp = new URLSearchParams();
    if (logStatus) sp.set("status", logStatus);
    if (logTemplate) sp.set("templateKey", logTemplate);
    if (logQ.trim()) sp.set("q", logQ.trim());
    sp.set("take", "80");
    const res = await fetch(`/api/platform/email-sends?${sp}`);
    const json = await res.json();
    if (json.success) {
      setSends(json.data.rows || []);
      setSendTotal(json.data.total || 0);
    }
  }, [logStatus, logTemplate, logQ]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    if (selectedKey) void loadDetail(selectedKey);
  }, [selectedKey, loadDetail]);

  useEffect(() => {
    if (tab === "log") void loadLog();
  }, [tab, loadLog]);

  function insertVar(name: string) {
    const token = `{{${name}}}`;
    setBodyHtml((h) => `${h}${h.endsWith(">") || h.endsWith(" ") ? "" : " "}${token}`);
    toast.message(`Inserted ${token}`);
  }

  async function refreshPreview() {
    if (!selectedKey) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/platform/email-templates/${selectedKey}/preview`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subject, bodyHtml, bodyText }),
        }
      );
      const json = await res.json();
      if (json.success) {
        setPreviewSubject(json.data.preview.subject);
        setPreviewHtml(json.data.preview.brandedHtml);
      } else {
        toast.error(json.error?.message || "Preview failed");
      }
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!selectedKey || !canWrite) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/platform/email-templates/${selectedKey}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, bodyHtml, bodyText }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Template saved");
        await loadTemplates();
        await refreshPreview();
      } else {
        toast.error(json.error?.message || "Save failed");
      }
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (!selectedKey || !canWrite) return;
    if (!confirm("Reset this template to the seeded default?")) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/platform/email-templates/${selectedKey}/reset`,
        { method: "POST" }
      );
      const json = await res.json();
      if (json.success) {
        toast.success("Reset to default");
        await loadTemplates();
        await loadDetail(selectedKey);
      } else {
        toast.error(json.error?.message || "Reset failed");
      }
    } finally {
      setBusy(false);
    }
  }

  async function testSend() {
    if (!selectedKey || !canWrite) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/platform/email-templates/${selectedKey}/test-send`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subject, bodyHtml, bodyText }),
        }
      );
      const json = await res.json();
      if (json.success) {
        toast.success(`Test sent to ${json.data.to}`);
      } else {
        toast.error(json.error?.message || "Test send failed");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PlatformPageHeader
        title="Email templates"
        description="Lifecycle emails to tenants. Preview with sample data, edit copy, reset defaults, and inspect the send log."
      />

      <div className="flex flex-wrap gap-2">
        <Button
          variant={tab === "templates" ? "default" : "outline"}
          size="sm"
          onClick={() => setTab("templates")}
        >
          Templates
        </Button>
        <Button
          variant={tab === "log" ? "default" : "outline"}
          size="sm"
          onClick={() => setTab("log")}
        >
          Send log
        </Button>
      </div>

      {tab === "templates" && (
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Events</CardTitle>
              <CardDescription>{templates.length} templates</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1 max-h-[70vh] overflow-y-auto p-2">
              {loading ? (
                <p className="text-sm text-muted-foreground p-2">Loading…</p>
              ) : (
                templates.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    className={`w-full text-left rounded-md px-2 py-2 text-sm hover:bg-muted ${
                      selectedKey === t.key ? "bg-muted font-medium" : ""
                    }`}
                    onClick={() => setSelectedKey(t.key)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate">{t.name}</span>
                      {t.isCustomized ? (
                        <Badge variant="secondary" className="shrink-0 text-[10px]">
                          edited
                        </Badge>
                      ) : null}
                    </div>
                    <div className="font-mono text-[10px] text-muted-foreground truncate">
                      {t.key}
                    </div>
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          <div className="space-y-4 min-w-0">
            {selected ? (
              <>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{selected.name}</CardTitle>
                    <CardDescription className="font-mono text-xs">
                      {selected.key}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">
                        Subject
                      </label>
                      <Input
                        disabled={!canWrite || busy}
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="text-xs text-muted-foreground">
                          HTML body
                        </label>
                        <div className="flex flex-wrap gap-1">
                          {variables.map((v) => (
                            <Button
                              key={v}
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 text-[11px] font-mono"
                              disabled={!canWrite || busy}
                              onClick={() => insertVar(v)}
                            >
                              {`{{${v}}}`}
                            </Button>
                          ))}
                        </div>
                      </div>
                      <Textarea
                        disabled={!canWrite || busy}
                        value={bodyHtml}
                        onChange={(e) => setBodyHtml(e.target.value)}
                        rows={8}
                        className="font-mono text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">
                        Plain text
                      </label>
                      <Textarea
                        disabled={!canWrite || busy}
                        value={bodyText}
                        onChange={(e) => setBodyText(e.target.value)}
                        rows={5}
                        className="font-mono text-xs"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        disabled={!canWrite || busy}
                        onClick={() => void save()}
                      >
                        Save
                      </Button>
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() => void refreshPreview()}
                      >
                        Preview
                      </Button>
                      <Button
                        variant="outline"
                        disabled={!canWrite || busy}
                        onClick={() => void testSend()}
                      >
                        Send test to me
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={!canWrite || busy}
                        onClick={() => void reset()}
                      >
                        Reset to default
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Test sends go to {actorEmail || "your account email"} via
                      platform transport (Resend/SMTP).
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Preview</CardTitle>
                    <CardDescription className="truncate">
                      {previewSubject || "—"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {previewHtml ? (
                      <iframe
                        title="Email preview"
                        className="w-full min-h-[420px] rounded-md border bg-white"
                        srcDoc={previewHtml}
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Click Preview to render with sample data.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Select a template.</p>
            )}
          </div>
        </div>
      )}

      {tab === "log" && (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Send log</CardTitle>
              <CardDescription>
                Platform lifecycle + test sends ({sendTotal})
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                className="border rounded-md h-9 px-2 text-sm"
                value={logStatus}
                onChange={(e) => setLogStatus(e.target.value)}
              >
                <option value="">All statuses</option>
                <option value="QUEUED">Queued</option>
                <option value="SENT">Sent</option>
                <option value="FAILED">Failed</option>
                <option value="BOUNCED">Bounced</option>
              </select>
              <select
                className="border rounded-md h-9 px-2 text-sm max-w-[200px]"
                value={logTemplate}
                onChange={(e) => setLogTemplate(e.target.value)}
              >
                <option value="">All templates</option>
                {templates.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.key}
                  </option>
                ))}
              </select>
              <Input
                className="h-9 w-[180px]"
                placeholder="Search to / subject"
                value={logQ}
                onChange={(e) => setLogQ(e.target.value)}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => void loadLog()}
              >
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {sends.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sends yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead>Org</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Subject</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sends.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {formatPlatformDateTime(r.sentAt || r.createdAt)}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {r.templateKey}
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.organizationName || "—"}
                      </TableCell>
                      <TableCell className="text-xs">{r.toEmail}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            r.status === "SENT"
                              ? "default"
                              : r.status === "FAILED" || r.status === "BOUNCED"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {r.status}
                        </Badge>
                        {r.error ? (
                          <p className="text-xs text-destructive mt-1 max-w-[180px] truncate">
                            {r.error}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-xs max-w-[220px] truncate">
                        {r.subject || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
