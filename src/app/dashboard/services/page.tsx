import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { serviceCatalogService } from "@/services/service-catalog.service";
import { ServicesPageClient } from "@/components/business-brain/services-page-client";

export default async function ServicesPage() {
  const user = await getCurrentUser();
  if (!user?.organizationId) redirect("/dashboard");

  const services = await serviceCatalogService.list(user.organizationId, true);

  const serialized = services.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    category: s.category,
    status: s.status,
    idealCustomer: s.idealCustomer,
    pricingModel: s.pricingModel,
    minBudget: s.minBudget != null ? Number(s.minBudget) : null,
    maxBudget: s.maxBudget != null ? Number(s.maxBudget) : null,
    currency: s.currency,
    typicalTimeline: s.typicalTimeline,
    problemsSolved: s.problemsSolved,
    technologies: s.technologies,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Services</h2>
        <p className="text-muted-foreground">
          Full service catalog for pricing, ICPs, and AI outreach.
        </p>
      </div>
      <ServicesPageClient initialServices={serialized} />
    </div>
  );
}
