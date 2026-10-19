"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { appHome } from "@/lib/app-paths";

type Notice = {
  id: string;
  featureKey: string;
  allowedCount: number;
  deadlineAt: string;
};

export function PlanLimitNoticeBanner() {
  const [notices, setNotices] = useState<Notice[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/billing/plan-limit-notices");
        const json = await res.json();
        if (json.success) setNotices(json.data.notices || []);
      } catch {
        // ignore — banner is best-effort
      }
    })();
  }, []);

  if (notices.length === 0) return null;
  const n = notices[0];

  return (
    <div className="border-b border-amber-300 bg-amber-50 text-amber-950 px-4 py-2 text-sm">
      Your plan now allows {n.allowedCount} {n.featureKey.replace(/_/g, " ")} —
      choose which stay active before{" "}
      {new Date(n.deadlineAt).toLocaleString()}.{" "}
      <Link
        href={appHome("/billing/choose-what-stays")}
        className="underline font-medium"
      >
        Choose now
      </Link>
      {notices.length > 1 ? ` (+${notices.length - 1} more)` : ""}
    </div>
  );
}
