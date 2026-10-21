"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DeadlineCountdown } from "@/components/billing/deadline-countdown";
import { deadlineExplanation } from "@/lib/billing/countdown";

type Resource = {
  id: string;
  label: string;
  isPrimaryAdmin?: boolean;
};
type Notice = {
  id: string;
  featureKey: string;
  allowedCount: number;
  deadlineAt: string;
  resources: Resource[];
};

export function ChooseWhatStaysClient() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [selected, setSelected] = useState<Record<string, Set<string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/billing/plan-limit-notices");
    const json = await res.json();
    if (!json.success) {
      setError(json.error?.message || "Load failed");
      return;
    }
    setNotices(json.data.notices);
    const init: Record<string, Set<string>> = {};
    for (const n of json.data.notices as Notice[]) {
      const set = new Set<string>();
      // Always include primary admin
      for (const r of n.resources) {
        if (r.isPrimaryAdmin) set.add(r.id);
      }
      // Fill remaining with oldest (resources are newest-first)
      const oldest = [...n.resources].reverse();
      for (const r of oldest) {
        if (set.size >= n.allowedCount) break;
        set.add(r.id);
      }
      init[n.id] = set;
    }
    setSelected(init);
  }

  useEffect(() => {
    void load();
  }, []);

  function toggle(noticeId: string, resourceId: string, max: number, locked: boolean) {
    if (locked) return;
    setSelected((prev) => {
      const set = new Set(prev[noticeId] || []);
      if (set.has(resourceId)) set.delete(resourceId);
      else if (set.size < max) set.add(resourceId);
      return { ...prev, [noticeId]: set };
    });
  }

  async function submit(noticeId: string) {
    setError(null);
    const ids = [...(selected[noticeId] || [])];
    const res = await fetch(
      `/api/billing/plan-limit-notices/${noticeId}/choose`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedIds: ids }),
      }
    );
    const json = await res.json();
    if (!json.success) {
      setError(json.error?.message || "Save failed");
      return;
    }
    setMsg(`Saved — kept ${json.data.kept}, paused ${json.data.paused}`);
    await load();
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Choose what stays active
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          Your plan seat limit dropped. Pick which items stay within the new
          limit. Nothing is deleted — extras are soft-paused at the deadline if
          you don&apos;t choose.
        </p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {msg && <p className="text-sm text-green-700">{msg}</p>}
      {notices.length === 0 && (
        <p className="text-sm text-muted-foreground">No pending choices.</p>
      )}
      {notices.map((n) => {
        const sel = selected[n.id] || new Set();
        return (
          <Card key={n.id}>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="capitalize">
                  {n.featureKey.replace(/_/g, " ")} — keep {n.allowedCount}
                </CardTitle>
                <Badge variant="secondary">
                  <DeadlineCountdown deadlineAt={n.deadlineAt} />
                </Badge>
              </div>
              <CardDescription className="space-y-2">
                <span className="block">
                  Deadline{" "}
                  {new Date(n.deadlineAt).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}{" "}
                  · selected {sel.size}/{n.allowedCount}
                </span>
                <span className="block text-foreground/80">
                  {deadlineExplanation(n.featureKey, n.allowedCount)}
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {n.resources.map((r) => {
                const locked = Boolean(r.isPrimaryAdmin);
                const checked = sel.has(r.id);
                return (
                  <label
                    key={r.id}
                    className={`flex items-center gap-2 text-sm ${
                      locked ? "opacity-80" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={locked}
                      onChange={() =>
                        toggle(n.id, r.id, n.allowedCount, locked)
                      }
                    />
                    <span>{r.label}</span>
                    {locked ? (
                      <Badge variant="outline" className="text-[10px]">
                        Always kept
                      </Badge>
                    ) : null}
                  </label>
                );
              })}
              <Button onClick={() => void submit(n.id)}>Save choices</Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
