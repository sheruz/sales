"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, Sparkles, Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface Recommendation {
  id: string;
  title: string;
  description: string | null;
  reason: string;
  priority: string;
  confidence: number;
  expectedImpact: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  status: string;
  type: string;
}

export function DailyRevenueCopilot() {
  const [items, setItems] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/ai-recommendations?today=1");
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message);
      setItems(data.data);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function generate(force = false) {
    setGenerating(true);
    try {
      const res = await fetch("/api/ai-recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message);
      setItems(data.data.recommendations ?? data.data);
      toast.success(
        data.data.cached
          ? "Showing today's plan"
          : "Daily revenue plan ready"
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate plan");
    } finally {
      setGenerating(false);
    }
  }

  async function setStatus(id: string, status: "ACCEPTED" | "DISMISSED" | "COMPLETED") {
    try {
      const res = await fetch(`/api/ai-recommendations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message);
      setItems((prev) => prev.filter((i) => i.id !== id));
      toast.success(status === "ACCEPTED" ? "Accepted" : status === "COMPLETED" ? "Done" : "Dismissed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4" />
            AI Daily Revenue Copilot
          </CardTitle>
          <CardDescription>
            What should you do today to increase your chance of hitting your
            revenue target?
          </CardDescription>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => generate(items.length > 0)}
          disabled={generating}
        >
          {generating ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          {items.length ? "Refresh" : "Generate today"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No priorities yet. Generate today&apos;s plan from your pipeline,
            goals, and learning history.
          </p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="rounded-md border p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{item.title}</span>
                <Badge variant="outline">{item.priority}</Badge>
                <Badge variant="secondary">{item.confidence}% conf.</Badge>
                <Badge variant="outline">{item.type}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                <strong>Reason:</strong> {item.reason}
              </p>
              {item.expectedImpact && (
                <p className="text-xs text-muted-foreground">
                  <strong>Impact:</strong> {item.expectedImpact}
                </p>
              )}
              <p className="text-sm">
                <strong>Action:</strong> {item.action}
              </p>
              <div className="flex flex-wrap gap-2">
                {item.entityType === "opportunity" && item.entityId && (
                  <Link href={`/dashboard/opportunities/${item.entityId}`}>
                    <Button size="sm" variant="secondary">
                      Open opportunity
                    </Button>
                  </Link>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setStatus(item.id, "ACCEPTED")}
                >
                  <Check className="mr-1 h-3 w-3" /> Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setStatus(item.id, "COMPLETED")}
                >
                  Done
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setStatus(item.id, "DISMISSED")}
                >
                  <X className="mr-1 h-3 w-3" /> Dismiss
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
