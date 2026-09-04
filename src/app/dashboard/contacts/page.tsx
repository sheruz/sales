import { Suspense } from "react";
import { redirect } from "next/navigation";
import { contactService } from "@/services/contact.service";
import { ContactsList } from "@/components/contacts/contacts-list";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth/session";
import { hasAnyOrgPermission } from "@/lib/tenant/scope";

interface PageProps {
  searchParams: Promise<{ search?: string; page?: string }>;
}

export default async function ContactsPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user?.organizationId) redirect("/dashboard");
  if (!hasAnyOrgPermission(user, ["opportunities.view", "leads.view"])) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const page = Number(params.page) || 1;
  const search = params.search?.trim() || undefined;

  const result = await contactService.list(user.organizationId, {
    page,
    limit: 25,
    search,
  });

  const serialized = {
    items: result.items.map((item) => ({
      id: item.id,
      fullName: item.fullName,
      title: item.title,
      email: item.email,
      phone: item.phone,
      company: item.company,
      _count: item._count,
    })),
    pagination: result.pagination,
    filters: { search: params.search ?? "", page },
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Contacts</h2>
        <p className="text-muted-foreground">
          People at prospect and customer companies
          {user.organizationName ? ` · ${user.organizationName}` : ""}.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <ContactsList initialData={serialized} />
      </Suspense>
    </div>
  );
}
