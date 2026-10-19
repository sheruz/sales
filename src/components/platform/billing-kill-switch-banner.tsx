"use client";

import { useEffect, useState } from "react";

/** Super-admin banner when BILLING_ENFORCEMENT_ENABLED is unset or false. */
export function BillingKillSwitchBanner() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/platform/billing-enforcement-status")
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data?.message) {
          setMessage(json.data.message);
        }
      })
      .catch(() => undefined);
  }, []);

  if (!message) return null;

  return (
    <div className="border-b border-amber-500/40 bg-amber-500/15 px-4 py-2 text-center text-xs text-amber-950 dark:text-amber-100">
      {message}
    </div>
  );
}
