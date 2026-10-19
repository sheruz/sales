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

type Resource = { id: string; label: string };
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
      // Pre-select oldest up to allowedCount
      const oldest = [...n.resources].reverse().slice(0, n.allowedCount);
      init[n.id] = new Set(oldest.map((r) => r.id));
    }
    setSelected(init);
  }

  useEffect(() => {
    void load();
  }, []);

  function toggle(noticeId: string, resourceId: string, max: number) {
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
        <p className="text-muted-foreground text-sm">
          Nothing is deleted. If you don&apos;t choose, newest items pause at
          the deadline.
        </p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {msg && <p className="text-sm text-green-700">{msg}</p>}
      {notices.length === 0 && (
        <p className="text-sm text-muted-foreground">No pending choices.</p>
      )}
      {notices.map((n) => (
        <Card key={n.id}>
          <CardHeader>
            <CardTitle>
              {n.featureKey.replace(/_/g, " ")} — keep {n.allowedCount}
            </CardTitle>
            <CardDescription>
              Deadline {new Date(n.deadlineAt).toLocaleString()} · selected{" "}
              {(selected[n.id] || new Set()).size}/{n.allowedCount}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {n.resources.map((r) => (
              <label key={r.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={(selected[n.id] || new Set()).has(r.id)}
                  onChange={() => toggle(n.id, r.id, n.allowedCount)}
                />
                {r.label}
              </label>
            ))}
            <Button onClick={() => void submit(n.id)}>Save choices</Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
