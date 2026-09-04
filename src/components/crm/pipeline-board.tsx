"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { OpportunityStage } from "@prisma/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OPPORTUNITY_STAGE_LABELS, scoreBadgeVariant } from "@/lib/constants/opportunities";

interface BoardItem {
  id: string;
  stage: OpportunityStage;
  score: number;
  estimatedValue: unknown;
  currency: string;
  company: { id: string; name: string };
  primaryContact: { id: string; fullName: string } | null;
  owner: { id: string; firstName: string; lastName: string } | null;
}

interface Column {
  stage: OpportunityStage;
  items: BoardItem[];
}

export function PipelineBoard() {
  const router = useRouter();
  const [columns, setColumns] = useState<Column[]>([]);
  const [totalValue, setTotalValue] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/deals?board=1");
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message);
      setColumns(data.data.columns);
      setTotalValue(data.data.totalValue ?? 0);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load pipeline");
    } finally {
      setLoading(false);
    }
  }

  async function moveStage(opportunityId: string, stage: OpportunityStage) {
    try {
      const res = await fetch(`/api/opportunities/${opportunityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message);
      toast.success(`Moved to ${OPPORTUNITY_STAGE_LABELS[stage]}`);
      await load();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update stage");
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading pipeline…</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Pipeline value (open + closed):{" "}
        <span className="font-medium text-foreground">
          ${totalValue.toLocaleString()}
        </span>
      </p>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {columns.map((col) => (
          <Card key={col.stage} className="min-w-[240px] max-w-[260px] shrink-0">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-sm">
                <span>{OPPORTUNITY_STAGE_LABELS[col.stage] ?? col.stage}</span>
                <Badge variant="secondary">{col.items.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[70vh] overflow-y-auto">
              {col.items.length === 0 ? (
                <p className="text-xs text-muted-foreground">Empty</p>
              ) : (
                col.items.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-md border p-2 space-y-2 bg-background"
                  >
                    <Link
                      href={`/dashboard/opportunities/${item.id}`}
                      className="text-sm font-medium hover:underline"
                    >
                      {item.company.name}
                    </Link>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant={scoreBadgeVariant(item.score)} className="text-xs">
                        {item.score}
                      </Badge>
                      {item.primaryContact && (
                        <span className="text-xs text-muted-foreground truncate">
                          {item.primaryContact.fullName}
                        </span>
                      )}
                    </div>
                    <select
                      className="w-full rounded border bg-background px-2 py-1 text-xs"
                      value={item.stage}
                      onChange={(e) =>
                        moveStage(item.id, e.target.value as OpportunityStage)
                      }
                    >
                      {Object.values(OpportunityStage).map((s) => (
                        <option key={s} value={s}>
                          {OPPORTUNITY_STAGE_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
