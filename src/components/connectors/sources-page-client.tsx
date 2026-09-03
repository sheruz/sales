"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Play, Plus } from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type ConnectorRow = {
  id: string;
  type: string;
  name: string;
  provider: string;
  status: string;
  lastSyncAt: string | null;
  lastError: string | null;
  createdAt: string;
};

export type CatalogItem = {
  type: string;
  provider: string;
  displayName: string;
  description: string;
};

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "CONNECTED":
      return "default";
    case "ERROR":
      return "destructive";
    case "DISABLED":
      return "secondary";
    default:
      return "outline";
  }
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

export function SourcesPageClient({
  initialConnectors,
  catalog,
}: {
  initialConnectors: ConnectorRow[];
  catalog: CatalogItem[];
}) {
  const router = useRouter();
  const [connectors, setConnectors] = useState(initialConnectors);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [csvTextById, setCsvTextById] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    type: catalog[0]?.type ?? "HIRING",
    name: "",
    complianceAcknowledged: false,
  });

  const selectedCatalog = catalog.find((c) => c.type === form.type);

  async function createConnector() {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (form.type === "RFP_TENDER" && !form.complianceAcknowledged) {
      toast.error("Acknowledge compliance for RFP / Tender connectors");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/source-connectors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: form.type,
          name: form.name.trim(),
          provider: selectedCatalog?.provider,
          configuration:
            form.type === "RFP_TENDER"
              ? { complianceAcknowledged: form.complianceAcknowledged }
              : undefined,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message);

      const created = data.data;
      setConnectors([
        {
          id: created.id,
          type: created.type,
          name: created.name,
          provider: created.provider,
          status: created.status,
          lastSyncAt: created.lastSyncAt
            ? new Date(created.lastSyncAt).toISOString()
            : null,
          lastError: created.lastError ?? null,
          createdAt: created.createdAt
            ? new Date(created.createdAt).toISOString()
            : new Date().toISOString(),
        },
        ...connectors,
      ]);
      toast.success("Connector created");
      setForm({
        type: catalog[0]?.type ?? "HIRING",
        name: "",
        complianceAcknowledged: false,
      });
      setShowForm(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setSubmitting(false);
    }
  }

  async function runConnector(connector: ConnectorRow) {
    const body: Record<string, unknown> = { count: 5 };
    if (connector.type === "CSV_CRM") {
      const csvText = csvTextById[connector.id]?.trim();
      if (!csvText) {
        toast.error("Paste CSV text before running");
        return;
      }
      body.csvText = csvText;
    }

    setRunningId(connector.id);
    try {
      const res = await fetch(`/api/source-connectors/${connector.id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message);

      const result = data.data as {
        created?: number;
        skipped?: number;
        failed?: number;
      };
      toast.success(
        `Run complete — created ${result.created ?? 0}, skipped ${result.skipped ?? 0}, failed ${result.failed ?? 0}`
      );
      setConnectors((prev) =>
        prev.map((c) =>
          c.id === connector.id
            ? {
                ...c,
                status: "CONNECTED",
                lastSyncAt: new Date().toISOString(),
                lastError: null,
              }
            : c
        )
      );
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Run failed");
    } finally {
      setRunningId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Opportunity Engine only receives{" "}
          <Link
            href="/dashboard/opportunities"
            className="underline underline-offset-2"
          >
            normalized signals
          </Link>
          — raw connector payloads stay in the source layer.
        </p>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="mr-2 h-4 w-4" />
          Add connector
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New source connector</CardTitle>
            <CardDescription>
              Choose a catalog type to ingest signals for this organization.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Type</Label>
              <Select
                value={form.type}
                onValueChange={(value) =>
                  setForm({
                    ...form,
                    type: value ?? form.type,
                    complianceAcknowledged: false,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {catalog.map((item) => (
                    <SelectItem key={item.type} value={item.type}>
                      {item.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedCatalog && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {selectedCatalog.description}
                </p>
              )}
            </div>
            <div>
              <Label>Name</Label>
              <Input
                value={form.name}
                placeholder={selectedCatalog?.displayName ?? "Connector name"}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            {form.type === "RFP_TENDER" && (
              <div className="md:col-span-2 flex items-start gap-2 rounded-md border p-3">
                <input
                  id="complianceAcknowledged"
                  type="checkbox"
                  className="mt-1"
                  checked={form.complianceAcknowledged}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      complianceAcknowledged: e.target.checked,
                    })
                  }
                />
                <Label htmlFor="complianceAcknowledged" className="font-normal leading-snug">
                  I acknowledge that this connector will only use permitted public
                  RFP/tender sources (
                  <code className="text-xs">configuration.complianceAcknowledged</code>
                  ).
                </Label>
              </div>
            )}
            <div className="md:col-span-2 flex gap-2">
              <Button onClick={createConnector} disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connected sources</CardTitle>
          <CardDescription>
            Run a connector to fetch and normalize signals into opportunities.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {connectors.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No connectors yet. Add one from the catalog to get started.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last sync</TableHead>
                  <TableHead>Error</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {connectors.map((connector) => (
                  <TableRow key={connector.id}>
                    <TableCell className="font-medium">{connector.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{connector.type}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {connector.provider}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(connector.status)}>
                        {connector.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {formatDate(connector.lastSyncAt)}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm text-destructive">
                      {connector.lastError ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end gap-2">
                        {connector.type === "CSV_CRM" && (
                          <Textarea
                            rows={3}
                            className="min-w-[220px] text-left"
                            placeholder="Paste CSV text…"
                            value={csvTextById[connector.id] ?? ""}
                            onChange={(e) =>
                              setCsvTextById({
                                ...csvTextById,
                                [connector.id]: e.target.value,
                              })
                            }
                          />
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={runningId === connector.id}
                          onClick={() => runConnector(connector)}
                        >
                          {runningId === connector.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Play className="mr-2 h-4 w-4" />
                          )}
                          Run
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
