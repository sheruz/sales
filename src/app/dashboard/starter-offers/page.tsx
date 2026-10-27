import { appHome } from "@/lib/app-paths";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { hasOrgPermission } from "@/lib/tenant/scope";
import { starterOfferService } from "@/services/starter-offer.service";
import { StarterOffersPageClient } from "@/components/business-brain/starter-offers-page-client";

export default async function StarterOffersPage() {
  const user = await getCurrentUser();
  if (!user?.organizationId) redirect(appHome());
  if (!hasOrgPermission(user, "business_brain.manage")) redirect(appHome());

  const offers = await starterOfferService.list(user.organizationId, true);
  const serialized = offers.map((o) => ({
    id: o.id,
    name: o.name,
    price: Number(o.price),
    currency: o.currency,
    deliveryDays: o.deliveryDays,
    includes: o.includes,
    findingTypes: o.findingTypes,
    status: o.status,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Starter offers</h2>
        <p className="text-muted-foreground">
          Fixed-price packages for Proof-of-Work Day 7 emails. Matched by finding
          type from deep audits.
        </p>
      </div>
      <StarterOffersPageClient initialOffers={serialized} />
    </div>
  );
}
