import Link from "next/link";
import { Lock } from "lucide-react";
import { appHome } from "@/lib/app-paths";
import { getModuleDef, type ModuleKey } from "@/lib/billing/modules";
/** Shown when a module is off on the current plan (not a broken empty page). */
export function ModuleUpgradeCard({ moduleKey }: { moduleKey: ModuleKey }) {
  const def = getModuleDef(moduleKey);
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-6 py-20 text-center">
      <Lock className="mb-4 h-10 w-10 text-muted-foreground" />
      <h1 className="text-2xl font-semibold tracking-tight">
        {def?.label ?? moduleKey}
      </h1>
      <p className="mt-3 text-muted-foreground">
        Available on {def?.availableOn ?? "a higher plan"}. Upgrade to unlock
        this module — your data stays safe.
      </p>
      <Link
        href={appHome("/billing/choose-plan")}
        className="mt-8 inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/80"
      >
        View plans
      </Link>
    </div>
  );
}
