"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { appOps } from "@/lib/app-paths";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Feature = {
  featureKey: string;
  enabled: boolean;
  limitValue: number | null;
};

type Draft = {
  id: string;
  version: number;
  editorRevision: number;
  priceMonthly: string | number;
  priceYearly: string | number;
  currency: string;
  monthlyCredits: number | null;
  creditRolloverEnabled: boolean;
  creditRolloverCapMonths: number | null;
  features: Feature[];
};

type Registry = {
  modules: { key: string; label: string }[];
  limits: { key: string; label: string }[];
};

export function PackageEditorClient({
  planId,
  canWrite,
}: {
  planId: string;
  canWrite: boolean;
}) {
  const [planName, setPlanName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState("PUBLIC");
  const [mostPopular, setMostPopular] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [registry, setRegistry] = useState<Registry | null>(null);
  const [versions, setVersions] = useState<
    { id: string; version: number; status: string }[]
  >([]);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [preview, setPreview] = useState<unknown>(null);
  const [applyMode, setApplyMode] = useState<
    "now" | "renewal" | "new_subscribers_only"
  >("now");
  const [confirmName, setConfirmName] = useState("");
  const [featureMap, setFeatureMap] = useState<Record<string, Feature>>({});

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch(`/api/platform/plans/${planId}`);
    const json = await res.json();
    if (!json.success) {
      setError(json.error?.message || "Load failed");
      return;
    }
    const p = json.data.plan;
    setPlanName(p.name);
    setDescription(p.description || "");
    setVisibility(p.visibility);
    setMostPopular(!!p.mostPopular);
    setVersions(
      p.versions.map((v: { id: string; version: number; status: string }) => ({
        id: v.id,
        version: v.version,
        status: v.status,
      }))
    );
    setRegistry(json.data.registry);
    let d = json.data.draft as Draft | null;
    if (!d && canWrite) {
      const createDraft = await fetch(`/api/platform/plans/${planId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          editorRevision: 0,
          reason: "Create working draft",
          name: p.name,
        }),
      });
      const cj = await createDraft.json();
      if (cj.success) {
        d = cj.data.draft;
      } else if (cj.error?.code === "OPTIMISTIC_LOCK") {
        const again = await fetch(`/api/platform/plans/${planId}`);
        const aj = await again.json();
        d = aj.data.draft;
      } else {
        setError(cj.error?.message || "Could not create draft");
        return;
      }
    }
    if (d) {
      setDraft(d);
      const map: Record<string, Feature> = {};
      for (const f of d.features) map[f.featureKey] = { ...f };
      setFeatureMap(map);
    }
  }, [planId, canWrite]);

  useEffect(() => {
    void load();
  }, [load]);

  const featureList = useMemo(() => Object.values(featureMap), [featureMap]);

  async function saveDraft() {
    if (!draft || !canWrite) return;
    setError(null);
    setMsg(null);
    const res = await fetch(`/api/platform/plans/${planId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: planName,
        description,
        visibility,
        mostPopular,
        priceMonthly: Number(draft.priceMonthly),
        priceYearly: Number(draft.priceYearly),
        currency: draft.currency,
        monthlyCredits: draft.monthlyCredits,
        creditRolloverEnabled: draft.creditRolloverEnabled,
        creditRolloverCapMonths: draft.creditRolloverCapMonths,
        features: featureList,
        editorRevision: draft.editorRevision,
        reason: reason || "Draft save",
      }),
    });
    const json = await res.json();
    if (!json.success) {
      setError(json.error?.message || "Save failed");
      if (json.error?.code === "OPTIMISTIC_LOCK") await load();
      return;
    }
    setDraft(json.data.draft);
    const map: Record<string, Feature> = {};
    for (const f of json.data.draft.features) map[f.featureKey] = { ...f };
    setFeatureMap(map);
    setMsg(`Draft saved (rev ${json.data.draft.editorRevision})`);
  }

  async function runPreview() {
    setError(null);
    const res = await fetch(`/api/platform/plans/${planId}/preview`);
    const json = await res.json();
    if (!json.success) {
      setError(json.error?.message || "Preview failed");
      return;
    }
    setPreview(json.data);
  }

  async function publish() {
    if (!draft || !canWrite) return;
    setError(null);
    setMsg(null);
    const res = await fetch(`/api/platform/plans/${planId}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        applyMode,
        editorRevision: draft.editorRevision,
        confirmPlanName: confirmName,
        reason: reason || "Publish package version",
      }),
    });
    const json = await res.json();
    if (!json.success) {
      setError(json.error?.message || "Publish failed");
      return;
    }
    setMsg(
      `Published v${json.data.planVersion.version} (${json.data.applyMode}): now=${json.data.appliedNow}, renewal=${json.data.scheduledRenewal}, new-only=${json.data.grandfathered}`
    );
    setPreview(null);
    await load();
  }

  async function archive() {
    if (!canWrite) return;
    const r = reason || "Archive plan";
    const res = await fetch(`/api/platform/plans/${planId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: r }),
    });
    const json = await res.json();
    if (!json.success) {
      setError(json.error?.message || "Archive failed");
      return;
    }
    setMsg("Plan archived");
  }

  function setFeat(key: string, patch: Partial<Feature>) {
    setFeatureMap((prev) => ({
      ...prev,
      [key]: {
        featureKey: key,
        enabled: prev[key]?.enabled ?? true,
        limitValue: prev[key]?.limitValue ?? null,
        ...patch,
      },
    }));
  }

  const previewData = preview as {
    affectedCompaniesCount?: number;
    aboveLimitsCount?: number;
    companies?: {
      name: string;
      aboveLimits: { featureKey: string; overBy: number; wouldPause: { label: string }[] }[];
    }[];
  } | null;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={appOps("/packages")}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Packages
        </Link>
        <h2 className="text-2xl font-bold tracking-tight mt-2">
          {planName || "Package"}
        </h2>
        {draft && (
          <p className="text-sm text-muted-foreground">
            Draft v{draft.version} · revision {draft.editorRevision}{" "}
            <Badge variant="secondary">DRAFT</Badge>
          </p>
        )}
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      {msg && <p className="text-sm text-green-700">{msg}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Plan details</CardTitle>
          <CardDescription>Saved into the working draft</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={planName}
              disabled={!canWrite}
              onChange={(e) => setPlanName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Visibility</Label>
            <select
              className="border rounded-md h-9 px-2 text-sm w-full"
              value={visibility}
              disabled={!canWrite}
              onChange={(e) => setVisibility(e.target.value)}
            >
              <option value="PUBLIC">PUBLIC</option>
              <option value="PRIVATE">PRIVATE</option>
              <option value="INTERNAL">INTERNAL</option>
              <option value="DRAFT">DRAFT</option>
            </select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Marketing description</Label>
            <Textarea
              value={description}
              disabled={!canWrite}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={mostPopular}
              disabled={!canWrite}
              onChange={(e) => setMostPopular(e.target.checked)}
            />
            Most popular
          </label>
        </CardContent>
      </Card>

      {draft && (
        <Card>
          <CardHeader>
            <CardTitle>Credits & prices</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Monthly price</Label>
              <Input
                type="number"
                disabled={!canWrite}
                value={Number(draft.priceMonthly)}
                onChange={(e) =>
                  setDraft({ ...draft, priceMonthly: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Yearly price</Label>
              <Input
                type="number"
                disabled={!canWrite}
                value={Number(draft.priceYearly)}
                onChange={(e) =>
                  setDraft({ ...draft, priceYearly: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Input
                disabled={!canWrite}
                value={draft.currency}
                onChange={(e) =>
                  setDraft({ ...draft, currency: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Monthly credits</Label>
              <Input
                type="number"
                disabled={!canWrite}
                value={draft.monthlyCredits ?? ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    monthlyCredits: e.target.value
                      ? Number(e.target.value)
                      : null,
                  })
                }
              />
            </div>
            <label className="flex items-center gap-2 text-sm self-end">
              <input
                type="checkbox"
                checked={draft.creditRolloverEnabled}
                disabled={!canWrite}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    creditRolloverEnabled: e.target.checked,
                  })
                }
              />
              Rollover on
            </label>
            <div className="space-y-2">
              <Label>Rollover cap (months)</Label>
              <Input
                type="number"
                disabled={!canWrite}
                value={draft.creditRolloverCapMonths ?? ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    creditRolloverCapMonths: e.target.value
                      ? Number(e.target.value)
                      : null,
                  })
                }
              />
            </div>
          </CardContent>
        </Card>
      )}

      {registry && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Modules</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              {registry.modules.map((m) => (
                <label key={m.key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    disabled={!canWrite}
                    checked={featureMap[m.key]?.enabled ?? false}
                    onChange={(e) =>
                      setFeat(m.key, { enabled: e.target.checked })
                    }
                  />
                  {m.label}
                </label>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Limits</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {registry.limits.map((l) => (
                <div key={l.key} className="flex items-center gap-2">
                  <Label className="w-40 shrink-0 text-xs">{l.label}</Label>
                  <Input
                    type="number"
                    disabled={!canWrite}
                    placeholder="unlimited"
                    value={featureMap[l.key]?.limitValue ?? ""}
                    onChange={(e) =>
                      setFeat(l.key, {
                        enabled: true,
                        limitValue: e.target.value
                          ? Number(e.target.value)
                          : null,
                      })
                    }
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Save / publish</CardTitle>
          <CardDescription>
            Reason is required for audit. Preview is mandatory before publish.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Reason</Label>
            <Input
              value={reason}
              disabled={!canWrite}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why are you changing this package?"
            />
          </div>
          {canWrite && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void saveDraft()}>Save draft</Button>
              <Button variant="outline" onClick={() => void runPreview()}>
                Preview publish
              </Button>
              <Button variant="destructive" onClick={() => void archive()}>
                Archive plan
              </Button>
            </div>
          )}

          {previewData && (
            <div className="border rounded-md p-4 space-y-3 bg-muted/30">
              <p className="text-sm font-medium">
                Affects {previewData.affectedCompaniesCount} companies ·{" "}
                {previewData.aboveLimitsCount} above new limits
              </p>
              <ul className="text-sm space-y-2 max-h-48 overflow-auto">
                {(previewData.companies || []).map((c) => (
                  <li key={c.name}>
                    <strong>{c.name}</strong>
                    {c.aboveLimits.length === 0 ? (
                      <span className="text-muted-foreground"> — within limits</span>
                    ) : (
                      <ul className="ml-4 list-disc">
                        {c.aboveLimits.map((a) => (
                          <li key={a.featureKey}>
                            {a.featureKey}: over by {a.overBy}; would pause{" "}
                            {a.wouldPause.map((w) => w.label).join(", ")}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
              <div className="space-y-2">
                <Label>Apply mode</Label>
                <select
                  className="border rounded-md h-9 px-2 text-sm w-full max-w-md"
                  value={applyMode}
                  disabled={!canWrite}
                  onChange={(e) =>
                    setApplyMode(e.target.value as typeof applyMode)
                  }
                >
                  <option value="now">Apply now</option>
                  <option value="renewal">At each company&apos;s next renewal</option>
                  <option value="new_subscribers_only">New subscribers only</option>
                </select>
              </div>
              {applyMode === "now" &&
                (previewData.affectedCompaniesCount || 0) > 0 && (
                  <div className="space-y-2">
                    <Label>
                      Type plan name &quot;{planName}&quot; to confirm Apply now
                    </Label>
                    <Input
                      value={confirmName}
                      onChange={(e) => setConfirmName(e.target.value)}
                    />
                  </div>
                )}
              {canWrite && (
                <Button onClick={() => void publish()}>Publish</Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Version history</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {versions.map((v) => (
            <div key={v.id} className="flex gap-2 items-center">
              <Badge variant={v.status === "DRAFT" ? "secondary" : "default"}>
                {v.status}
              </Badge>
              <span>v{v.version}</span>
              <span className="font-mono text-xs text-muted-foreground">
                {v.id.slice(0, 8)}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
