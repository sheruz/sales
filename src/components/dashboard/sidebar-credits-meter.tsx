"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { appHome } from "@/lib/app-paths";
import { cn } from "@/lib/utils";

type CreditsSnap = {
  balance: number;
  isOwner?: boolean;
  unlimited?: boolean;
  monthlyCredits?: number | null;
};

export function SidebarCreditsMeter() {
  const [data, setData] = useState<CreditsSnap | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/billing/credits?take=1")
      .then((r) => r.json())
      .then((json) => {
        if (cancelled || !json.success) return;
        setData({
          balance: json.data.balance ?? 0,
          isOwner: json.data.isOwner,
          unlimited: json.data.isOwner,
          monthlyCredits: json.data.monthlyCredits ?? null,
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data) return null;

  if (data.isOwner || data.unlimited) {
    return (
      <Link
        href={appHome("/settings?tab=billing")}
        className="block rounded-lg border border-sidebar-border bg-sidebar-accent/30 px-3 py-2 text-[11px] text-muted-foreground hover:bg-sidebar-accent"
      >
        <span className="font-medium text-sidebar-foreground">
          Owner — Unlimited
        </span>
      </Link>
    );
  }

  const monthly = data.monthlyCredits && data.monthlyCredits > 0
    ? data.monthlyCredits
    : null;
  const used = monthly != null ? Math.max(0, monthly - data.balance) : null;
  const pctLeft =
    monthly != null && monthly > 0
      ? Math.max(0, Math.min(100, (data.balance / monthly) * 100))
      : null;
  const barColor =
    pctLeft == null
      ? "bg-muted-foreground/40"
      : pctLeft <= 5
        ? "bg-red-500"
        : pctLeft <= 20
          ? "bg-amber-500"
          : "bg-emerald-600";

  return (
    <Link
      href={appHome("/settings?tab=billing")}
      className="block rounded-lg border border-sidebar-border bg-sidebar-accent/30 px-3 py-2 hover:bg-sidebar-accent"
    >
      <div className="flex items-baseline justify-between gap-2 text-[11px]">
        <span className="font-medium text-sidebar-foreground">Credits</span>
        <span className="tabular-nums text-muted-foreground">
          {used != null && monthly != null
            ? `${used} / ${monthly}`
            : `${data.balance} left`}
        </span>
      </div>
      {pctLeft != null && (
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-sidebar-border">
          <div
            className={cn("h-full transition-all", barColor)}
            style={{ width: `${100 - pctLeft}%` }}
          />
        </div>
      )}
      {data.balance < 0 && (
        <p className="mt-1 text-[10px] text-red-500">Negative balance</p>
      )}
    </Link>
  );
}
