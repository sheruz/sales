import { Suspense } from "react";
import { redirect } from "next/navigation";
import {
  opportunityService,
  type OpportunityListFilter,
} from "@/services/opportunity.service";
import { OpportunitiesListClient } from "@/components/opportunities/opportunities-list-client";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth/session";
import { OPPORTUNITY_FILTERS } from "@/lib/constants/opportunities";

interface PageProps {
  searchParams: Promise<{
    filter?: string;
    search?: string;
    page?: string;
  }>;
}

const VALID_FILTERS = new Set(OPPORTUNITY_FILTERS.map((f) => f.value));

function parseFilter(raw?: string): OpportunityListFilter {
  if (raw && VALID_FILTERS.has(raw as OpportunityListFilter)) {
    return raw as OpportunityListFilter;
  }
  return "all";
}

export default async function OpportunitiesPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user?.organizationId) redirect("/dashboard");

  const params = await searchParams;
  const page = Number(params.page) || 1;
  const filter = parseFilter(params.filter);
  const search = params.search?.trim() || undefined;

  const result = await opportunityService.list(user.organizationId, {
    page,
    limit: 25,
    filter,
    search,
  });

  const serialized = {
    items: result.items.map((item) => ({
      id: item.id,
      score: item.score,
      stage: item.stage,
      whyNow: item.whyNow,
      updatedAt: item.updatedAt.toISOString(),
      company: { id: item.company.id, name: item.company.name },
      primarySignal: item.primarySignal
        ? { id: item.primarySignal.id, title: item.primarySignal.title }
        : null,
      owner: item.owner
        ? {
            id: item.owner.id,
            firstName: item.owner.firstName,
            lastName: item.owner.lastName,
          }
        : null,
    })),
    pagination: result.pagination,
    filters: {
      filter,
      search: params.search ?? "",
      page,
    },
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Opportunities</h2>
        <p className="text-muted-foreground">
          Signal-driven opportunities ranked by fit and urgency
          {user.organizationName ? ` · ${user.organizationName}` : ""}.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <OpportunitiesListClient initialData={serialized} />
      </Suspense>
    </div>
  );
}
