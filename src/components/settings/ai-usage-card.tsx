"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface UsageData {
  periodDays: number;
  totalCalls: number;
  totalTokens: number;
  byFeature: Array<{ feature: string; calls: number; tokens: number }>;
}

export function AiUsageCard() {
  const [usage, setUsage] = useState<UsageData | null>(null);

  useEffect(() => {
    fetch("/api/ai/usage")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setUsage(d.data);
      })
      .catch(() => {});
  }, []);

  if (!usage) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">AI usage (last {usage.periodDays} days)</CardTitle>
        <CardDescription>Usage from your connected API key — billed by your provider</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p>Total calls: {usage.totalCalls}</p>
        <p>Total tokens: {usage.totalTokens.toLocaleString()}</p>
        {usage.byFeature.length > 0 && (
          <ul className="mt-2 space-y-1 text-muted-foreground">
            {usage.byFeature.map((f) => (
              <li key={f.feature}>
                {f.feature}: {f.calls} calls, {f.tokens.toLocaleString()} tokens
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
