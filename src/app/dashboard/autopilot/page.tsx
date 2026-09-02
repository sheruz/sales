import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import prisma from "@/lib/db/prisma";
import { autopilotService } from "@/services/autopilot.service";
import { userIntegrationService } from "@/services/user-integration.service";
import { isAiConfigured } from "@/lib/integrations/readiness";
import { AutopilotPanel } from "@/components/autopilot/autopilot-panel";

export default async function AutopilotPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasPermission(user.role, "ai:use")) redirect("/dashboard");

  const [config, services, usage] = await Promise.all([
    autopilotService.getOrCreateConfig(user.id),
    prisma.service.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    autopilotService.getUsage(user.id),
  ]);

  const [emailConfigured, aiConfigured] = await Promise.all([
    userIntegrationService.isEmailConfigured(user.id),
    isAiConfigured(user.id),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">AI Autopilot</h2>
        <p className="text-muted-foreground">
          Finds companies posting freelance/dev jobs, creates leads with email, and sends outreach via SMTP only.
        </p>
      </div>
      <AutopilotPanel
        initialConfig={{
          ...config,
          maxLeadsPerRun: config.maxLeadsPerRun ?? 5,
          maxLeadsPerDay: config.maxLeadsPerDay ?? 10,
          maxAiCallsPerDay: config.maxAiCallsPerDay ?? 15,
          lastRunAt: config.lastRunAt?.toISOString() ?? null,
          nextRunAt: config.nextRunAt?.toISOString() ?? null,
          lastRunResult: config.lastRunResult as {
            profilesFound?: number;
            newLeadsCreated?: number;
            leadsProcessed?: number;
            emailsSent?: number;
            discoveryMode?: string;
            log?: string[];
            status?: string;
            error?: string;
          } | null,
        }}
        usage={usage}
        services={services}
        emailConfigured={emailConfigured}
        aiConfigured={aiConfigured}
      />
    </div>
  );
}
