"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { appHome } from "@/lib/app-paths";
import { SetupChecklist } from "@/components/dashboard/setup-checklist";
import type { getUserReadiness } from "@/lib/integrations/readiness";

type Readiness = Awaited<ReturnType<typeof getUserReadiness>>;

/**
 * Fetches onboarding + readiness and mounts SetupChecklist in the sidebar
 * until the wizard is dismissed (complete or skipped) AND readiness is 100%.
 */
export function SidebarSetupChecklist() {
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [dismissed, setDismissed] = useState(true);
  const [wizardHref, setWizardHref] = useState(appHome("/onboarding"));

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/onboarding");
      const json = await res.json();
      if (!json.success) return;
      setDismissed(Boolean(json.data.dismissed));
      setReadiness(json.data.readiness || null);
      setWizardHref(json.data.checklistHref || appHome("/onboarding"));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (dismissed && readiness && readiness.percentComplete >= 100) return null;
  if (!readiness) return null;

  // While wizard not dismissed, always show compact checklist + resume link
  if (!dismissed) {
    return (
      <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/30 p-2.5 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Setup
          </p>
          <Link
            href={wizardHref}
            className="text-[11px] font-medium underline"
          >
            Resume
          </Link>
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary"
            style={{ width: `${readiness.percentComplete}%` }}
          />
        </div>
        <p className="text-[11px] text-muted-foreground">
          {readiness.completedCount}/{readiness.totalSteps} ·{" "}
          {readiness.percentComplete}%
        </p>
      </div>
    );
  }

  return <SetupChecklist readiness={readiness} />;
}
