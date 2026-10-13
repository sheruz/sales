import { Suspense } from "react";
import { redirect } from "next/navigation";
import { companyService } from "@/services/company.service";
import { CompaniesList } from "@/components/companies/companies-list";
import { LeadsHubHeader } from "@/components/leads/leads-hub-header";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth/session";
import { hasAnyOrgPermission } from "@/lib/tenant/scope";

interface PageProps {
  searchParams: Promise<{
    search?: string;
    page?: string;
    source?: string;
    city?: string;
    crawlStatus?: string;
    enrichmentStatus?: string;
    funnel?: string;
    sort?: string;
  }>;
}

export default async function CompaniesPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user?.organizationId) redirect("/dashboard");
  if (!hasAnyOrgPermission(user, ["opportunities.view", "leads.view"])) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const page = Number(params.page) || 1;
  const search = params.search?.trim() || undefined;

  let result;
  try {
    result = await companyService.list(user.organizationId, {
      page,
      limit: 25,
      search,
      source: params.source?.trim() || undefined,
      city: params.city?.trim() || undefined,
      crawlStatus: params.crawlStatus?.trim() || undefined,
      enrichmentStatus: params.enrichmentStatus?.trim() || undefined,
      funnel: params.funnel?.trim() || undefined,
      sort: params.sort === "createdAt" || params.sort === "city" ? params.sort : "name",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[companies] list failed", msg);
    return (
      <div className="dx">
        <div className="page">
          <LeadsHubHeader user={user} active="companies" />
          <div className="banner">
            <div className="t">
              <div className="cell-main">Failed to load companies.</div>
              <div className="cell-sub" style={{ wordBreak: "break-all" }}>
                {msg}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const serialized = {
    items: result.items.map((item) => ({
      id: item.id,
      name: item.name,
      domain: item.domain,
      city: item.city,
      country: item.country,
      source: item.source,
      crawlStatus: item.crawlStatus,
      enrichmentStatus: item.enrichmentStatus,
      createdAt: item.createdAt.toISOString(),
      funnelStage: item.funnelStage,
      _count: item._count,
      bestContact: item.bestContact
        ? {
            id: item.bestContact.id,
            fullName: item.bestContact.fullName,
            email: item.bestContact.email,
            emailStatus: item.bestContact.emailStatus,
            title: item.bestContact.title,
          }
        : null,
    })),
    pagination: result.pagination,
    filters: {
      search: params.search ?? "",
      page,
      source: params.source,
      city: params.city,
      crawlStatus: params.crawlStatus,
      enrichmentStatus: params.enrichmentStatus,
      funnel: params.funnel,
      sort: params.sort,
    },
  };

  return (
    <div className="dx">
      <div className="page">
        <LeadsHubHeader user={user} active="companies" />
        <Suspense fallback={<Skeleton className="h-96 w-full" />}>
          <CompaniesList initialData={serialized} />
        </Suspense>
      </div>
    </div>
  );
}
