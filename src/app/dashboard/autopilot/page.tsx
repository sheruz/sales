import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import prisma from "@/lib/db/prisma";
import { autopilotService } from "@/services/autopilot.service";
import { linkedInAccountService } from "@/services/linkedin-account.service";
import { AutopilotPanel } from "@/components/autopilot/autopilot-panel";

export default async function AutopilotPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasPermission(user.role, "ai:use")) redirect("/dashboard");

  const [config, services, linkedInStatus] = await Promise.all([
    autopilotService.getOrCreateConfig(user.id),
    prisma.service.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    linkedInAccountService.getStatus(user.id),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">AI Autopilot</h2>
        <p className="text-muted-foreground">
          Fully automated LinkedIn prospecting — search, create leads, research, and outreach.
        </p>
      </div>
      <AutopilotPanel
        initialConfig={{
          ...config,
          lastRunAt: config.lastRunAt?.toISOString() ?? null,
          lastRunResult: config.lastRunResult as {
            profilesFound?: number;
            leadsProcessed?: number;
            automated?: number;
            log?: string[];
          } | null,
        }}
        services={services}
        linkedInConnected={linkedInStatus?.isActive ?? false}
      />
    </div>
  );
}
