import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { hasAnyOrgPermission } from "@/lib/tenant/scope";
import prisma from "@/lib/db/prisma";
import { autopilotService } from "@/services/autopilot.service";
import { userIntegrationService } from "@/services/user-integration.service";
import { isAiConfigured } from "@/lib/integrations/readiness";
import { AutopilotPanel } from "@/components/autopilot/autopilot-panel";
import { LegacyBadge } from "@/components/crm/legacy-badge";

export default async function AutopilotPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.organizationId) redirect("/dashboard");
  // Mirror sidebar: campaigns.manage | agent.manage
  if (!hasAnyOrgPermission(user, ["campaigns.manage", "agent.manage"])) {
    redirect("/dashboard");
  }

  const [config, services, usage] = await Promise.all([
    autopilotService.getOrCreateConfig(user.organizationId, user.id),
    prisma.service.findMany({
      where: { organizationId: user.organizationId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    autopilotService.getUsage(user.organizationId, user.id),
  ]);

  const [emailConfigured, aiConfigured] = await Promise.all([
    userIntegrationService.isEmailConfigured(user.organizationId, user.id),
    isAiConfigured(user.organizationId, user.id),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold tracking-tight">AI Autopilot</h2>
          <LegacyBadge />
        </div>
        <p className="text-muted-foreground">
          Legacy automation. Prefer Campaigns → Sequences → Enrollments for
          canonical outreach.
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
