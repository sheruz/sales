"use client";
import { appHome } from "@/lib/app-paths";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { OpportunityStage } from "@prisma/client";
import { toast } from "sonner";
import { OPPORTUNITY_STAGE_LABELS } from "@/lib/constants/opportunities";

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

/** Reference board columns, each grouping the existing pipeline stages. */
const BOARD_COLUMNS: {
  key: string;
  label: string;
  stages: OpportunityStage[];
  emptyText?: string;
}[] = [
  {
    key: "replied",
    label: "Replied",
    stages: [
      OpportunityStage.NEW,
      OpportunityStage.QUALIFIED,
      OpportunityStage.CONTACTED,
      OpportunityStage.REPLIED,
      OpportunityStage.DISCOVERY,
    ],
  },
  {
    key: "positive",
    label: "Positive",
    stages: [OpportunityStage.POSITIVE_REPLY],
  },
  { key: "meeting", label: "Meeting", stages: [OpportunityStage.MEETING] },
  {
    key: "proposal",
    label: "Proposal",
    stages: [OpportunityStage.PROPOSAL, OpportunityStage.NEGOTIATION],
  },
  { key: "won", label: "Won", stages: [OpportunityStage.WON] },
  {
    key: "lost",
    label: "Lost",
    stages: [OpportunityStage.LOST],
    emptyText: "Move a deal here when it's lost. The AI learns from the reason.",
  },
];

function toNumber(value: unknown): number {
  const n = value == null ? 0 : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatMoney(amount: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `$${amount.toLocaleString()}`;
  }
}

function formatCompact(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return `$${Math.round(amount)}`;
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
    return <p className="muted">Loading pipeline…</p>;
  }

  const allItems = new Map<string, BoardItem>();
  for (const col of columns) {
    for (const item of col.items) allItems.set(item.id, item);
  }

  return (
    <div className="stack">
      <p className="muted">
        Pipeline value (open + closed):{" "}
        <b style={{ color: "var(--dx-text)" }}>
          ${totalValue.toLocaleString()}
        </b>
      </p>
      <div className="board">
        {BOARD_COLUMNS.map((col) => {
          const items = Array.from(allItems.values()).filter((i) =>
            col.stages.includes(i.stage)
          );
          const sum = items.reduce((s, i) => s + toNumber(i.estimatedValue), 0);
          const multiStage = col.stages.length > 1;
          return (
            <div key={col.key} className="col">
              <div className="col-head">
                {col.label} <span className="n">{items.length}</span>
                {sum > 0 ? <span className="sum">{formatCompact(sum)}</span> : null}
              </div>
              {items.length === 0 ? (
                <div className="empty-col">
                  {col.emptyText ?? "No deals in this stage yet."}
                </div>
              ) : (
                items.map((item) => {
                  const value = toNumber(item.estimatedValue);
                  const contact = item.primaryContact?.fullName;
                  return (
                    <div key={item.id} className="deal">
                      <div className="deal-name">
                        <Link href={appHome(`/opportunities/${item.id}`)}>
                          {item.company.name}
                        </Link>
                      </div>
                      <div className="deal-meta">
                        {contact ? `${contact} · ` : ""}
                        score {item.score}
                        {multiStage
                          ? ` · ${OPPORTUNITY_STAGE_LABELS[item.stage] ?? item.stage}`
                          : ""}
                      </div>
                      <div className="deal-foot">
                        <span className="deal-val">
                          {value > 0 ? formatMoney(value, item.currency) : "—"}
                        </span>
                        {col.key === "won" ? (
                          <span className="badge ok">Won</span>
                        ) : (
                          <span className="mini-av">
                            {(contact ?? item.company.name).charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <select
                        aria-label={`Move ${item.company.name} to stage`}
                        value={item.stage}
                        onChange={(e) =>
                          moveStage(item.id, e.target.value as OpportunityStage)
                        }
                      >
                        {Object.values(OpportunityStage)
                          .filter((s) => s !== OpportunityStage.SOURCED)
                          .map((s) => (
                            <option key={s} value={s}>
                              {OPPORTUNITY_STAGE_LABELS[s]}
                            </option>
                          ))}
                      </select>
                    </div>
                  );
                })
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
