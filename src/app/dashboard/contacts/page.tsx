import { appHome } from "@/lib/app-paths";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { contactService } from "@/services/contact.service";
import { ContactsList } from "@/components/contacts/contacts-list";
import { LeadsHubHeader } from "@/components/leads/leads-hub-header";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth/session";
import { hasAnyOrgPermission } from "@/lib/tenant/scope";

interface PageProps {
  searchParams: Promise<{ search?: string; page?: string; companyId?: string }>;
}

export default async function ContactsPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user?.organizationId) redirect(appHome());
  if (!hasAnyOrgPermission(user, ["opportunities.view", "leads.view"])) {
    redirect(appHome());
  }

  const params = await searchParams;
  const page = Number(params.page) || 1;
  const search = params.search?.trim() || undefined;

  const result = await contactService.list(user.organizationId, {
    page,
    limit: 25,
    search,
    companyId: params.companyId,
  });

  const serialized = {
    items: result.items.map((item) => ({
      id: item.id,
      fullName: item.fullName,
      title: item.title,
      email: item.email,
      emailStatus: item.emailStatus,
      source: item.source,
      company: item.company,
      opportunityStage: item.primaryOpportunities[0]?.stage ?? null,
    })),
    pagination: result.pagination,
    filters: { search: params.search ?? "", page },
  };

  return (
    <div className="dx">
      <div className="page">
        <LeadsHubHeader user={user} active="contacts" />
        <Suspense fallback={<Skeleton className="h-96 w-full" />}>
          <ContactsList initialData={serialized} />
        </Suspense>
      </div>
    </div>
  );
}
