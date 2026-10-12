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

  let result;
  try {
    result = await companyService.list(user.organizationId, {
      page,
      limit: 25,
      search,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[companies] list failed", msg);
    const needsMigrate =
      /enrichment_|cron_tick|CompanyEnrichment|SOURCED|does not exist/i.test(
        msg
      );
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">Companies</h2>
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm space-y-2">
          <p className="font-medium">
            {needsMigrate
              ? "Database schema is behind this deploy (Phase 2 migrate not run)."
              : "Failed to load companies."}
          </p>
          {needsMigrate ? (
            <pre className="overflow-x-auto rounded bg-muted p-3 text-xs">
              {`cd /var/www/html/sales
npm run db:migrate:hunter-enrichment
pm2 restart all`}
            </pre>
          ) : null}
          <p className="text-xs text-muted-foreground break-all">{msg}</p>
        </div>
      </div>
    );
  }

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
