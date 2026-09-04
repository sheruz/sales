import { Suspense } from "react";
import { redirect } from "next/navigation";
import { companyService } from "@/services/company.service";
import { CompaniesList } from "@/components/companies/companies-list";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth/session";
import { hasAnyOrgPermission } from "@/lib/tenant/scope";

interface PageProps {
  searchParams: Promise<{ search?: string; page?: string }>;
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

  const result = await companyService.list(user.organizationId, {
    page,
    limit: 25,
    search,
  });

  const serialized = {
    items: result.items.map((item) => ({
      id: item.id,
      name: item.name,
      domain: item.domain,
      status: item.status,
      industry: item.industry,
      _count: item._count,
      signals: item.signals.map((s) => ({
        id: s.id,
        title: s.title,
        detectedAt: s.detectedAt.toISOString(),
      })),
      opportunities: item.opportunities.map((o) => ({
        id: o.id,
        stage: o.stage,
        updatedAt: o.updatedAt.toISOString(),
      })),
    })),
    pagination: result.pagination,
    filters: { search: params.search ?? "", page },
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Companies</h2>
        <p className="text-muted-foreground">
          Canonical prospect and customer organizations
          {user.organizationName ? ` · ${user.organizationName}` : ""}.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <CompaniesList initialData={serialized} />
      </Suspense>
    </div>
  );
}
