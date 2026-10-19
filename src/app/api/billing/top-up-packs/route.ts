import { NextResponse } from "next/server";
import { requireOrgPermission } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { topUpPackService } from "@/services/top-up-pack.service";

/** Tenant-facing: packs with Contact us (no checkout until B3). */
export async function GET() {
  try {
    await requireOrgPermission("billing.manage");
    const packs = await topUpPackService.list(false);
    return NextResponse.json(
      apiSuccess({
        packs: packs.filter((p) => p.active),
        purchaseMode: "contact_us",
        message: "Contact us to buy — online top-up checkout comes in B3.",
      })
    );
  } catch (error) {
    return handleApiError(error);
  }
}
