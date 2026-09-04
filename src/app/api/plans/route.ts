import { NextResponse } from "next/server";
import { entitlementService } from "@/services/entitlement.service";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

/** Public plan catalog for signup + authenticated billing UI */
export async function GET() {
  try {
    const plans = await entitlementService.listPlans();
    return NextResponse.json(
      apiSuccess(
        plans.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          price: Number(p.price),
          currency: p.currency,
          billingInterval: p.billingInterval,
          isDefault: p.isDefault,
          sortOrder: p.sortOrder,
          hasStripePrice: Boolean(p.stripePriceId),
          features: p.features.map((f) => ({
            featureKey: f.featureKey,
            limitValue: f.limitValue,
            enabled: f.enabled,
          })),
        }))
      )
    );
  } catch (error) {
    return handleApiError(error);
  }
}
