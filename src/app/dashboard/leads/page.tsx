import { Suspense } from "react";
import { redirect } from "next/navigation";
import { leadService } from "@/services/lead.service";
import { LeadsList } from "@/components/leads/leads-list";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth/session";
import { hasOrgPermission } from "@/lib/tenant/scope";
import { getFeatureFlags } from "@/lib/features/flags";
import { LegacyBadge } from "@/components/crm/legacy-badge";

interface PageProps {
  searchParams: Promise<{
    search?: string;
    status?: string;
    score?: string;
    page?: string;
  }>;
}

export default async function LeadsPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user?.organizationId) redirect("/dashboard");
  if (!hasOrgPermission(user, "leads.view")) redirect("/dashboard");

  const flags = await getFeatureFlags(user.organizationId);
  if (!flags.legacy_enabled) {
    redirect("/dashboard/companies");
  }

  const params = await searchParams;
  const page = Number(params.page) || 1;
  const status =
    params.status && params.status !== "all" ? params.status : undefined;
  const scoreCategory =
    params.score && params.score !== "all"
      ? (params.score as import("@prisma/client").LeadScoreCategory)
      : undefined;

  const result = await leadService.list(user.organizationId, {
    page,
    limit: 20,
    search: params.search,
    status: status as import("@prisma/client").LeadStatus | undefined,
    scoreCategory,
    sortBy: "createdAt",
    sortOrder: "desc",
  });

  const serialized = {
    leads: result.leads.map((lead) => ({
      ...lead,
      createdAt: lead.createdAt.toISOString(),
      updatedAt: lead.updatedAt.toISOString(),
      estimatedBudget: lead.estimatedBudget
        ? Number(lead.estimatedBudget)
        : null,
    })),
    pagination: result.pagination,
    filters: {
      search: params.search ?? "",
      status: params.status ?? "all",
      score: params.score ?? "all",
      page,
    },
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold tracking-tight">Leads</h2>
          <LegacyBadge />
        </div>
        <p className="text-muted-foreground">
          Legacy lead compatibility. Prefer Companies â†’ Contacts â†’ Opportunities
          for new work
          {user.organizationName ? ` Â· ${user.organizationName}` : ""}.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <LeadsList initialData={serialized} />
      </Suspense>
    </div>
  );
}
