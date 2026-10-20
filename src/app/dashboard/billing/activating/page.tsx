"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { appHome } from "@/lib/app-paths";

export default function ActivatingPage() {
  const router = useRouter();
  const [elapsed, setElapsed] = useState(0);
  const [status, setStatus] = useState("NONE");
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const started = Date.now();
    const tick = setInterval(() => {
      setElapsed(Math.floor((Date.now() - started) / 1000));
    }, 500);
    const poll = setInterval(async () => {
      try {
        const res = await fetch("/api/billing/activating");
        const json = await res.json();
        if (json.success) {
          setStatus(json.data.status);
          if (json.data.active) {
            clearInterval(poll);
            clearInterval(tick);
            router.replace(appHome());
          }
        }
      } catch {
        // keep polling
      }
      if (Date.now() - started > 60_000) setSlow(true);
    }, 2000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [router]);

  return (
    <div className="mx-auto max-w-md px-6 py-20 text-center space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">
        Activating your workspace…
      </h1>
      <p className="text-muted-foreground text-sm">
        Waiting for payment confirmation ({elapsed}s). Status: {status}
      </p>
      {slow && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
          Payment received, activation is taking longer than usual. Your Super
          Admin can use &quot;Resync from Paddle&quot; on the tenant page if this
          continues.
        </p>
      )}
    </div>
  );
}
