import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * Client Autopilot control surface.
 * Phase 0: placeholder only — Google sourcing lands in Phase 1.
 * Legacy Autopilot panel is hidden (legacy_enabled=false by default).
 */
export default async function AutopilotPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.organizationId) redirect("/dashboard");

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-12 text-center">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Autopilot</h2>
        <p className="mt-2 text-muted-foreground">
          Coming in Phase 1 — Google business sourcing, enrichment, and
          outbound control will live here.
        </p>
      </div>
      <div className="rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">What&apos;s next</p>
        <ul className="mt-3 space-y-1 text-left">
          <li>Phase 1 — Google Places sourcing from your ICP</li>
          <li>Phase 2 — Decision-maker enrichment</li>
          <li>Phase 3+ — Audit, outbound, AI replies, Zoom, Meta Lead Ads</li>
        </ul>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Link href="/dashboard/icp">
          <Button variant="outline" size="sm">
            Configure ICP
          </Button>
        </Link>
        <Link href="/dashboard/business-brain">
          <Button variant="outline" size="sm">
            Business Brain
          </Button>
        </Link>
        <Link href="/dashboard/settings">
          <Button variant="outline" size="sm">
            Settings
          </Button>
        </Link>
      </div>
    </div>
  );
}
