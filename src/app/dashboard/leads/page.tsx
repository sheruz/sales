import { Suspense } from "react";
import { leadService } from "@/services/lead.service";
import { LeadsList } from "@/components/leads/leads-list";
import { Skeleton } from "@/components/ui/skeleton";

interface PageProps {
  searchParams: Promise<{
    search?: string;
    status?: string;
    score?: string;
    page?: string;
  }>;
}

export default async function LeadsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const status =
    params.status && params.status !== "all" ? params.status : undefined;
  const scoreCategory =
    params.score && params.score !== "all"
      ? (params.score as import("@prisma/client").LeadScoreCategory)
      : undefined;

  const result = await leadService.list({
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
        <h2 className="text-2xl font-bold tracking-tight">Leads</h2>
        <p className="text-muted-foreground">
          Manage and track your sales leads.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <LeadsList initialData={serialized} />
      </Suspense>
    </div>
  );
}
