import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { billingGateway } from "@/services/billing-gateway.service";

export async function GET() {
  try {
    await requireSuperAdmin();
    const w = billingGateway.enforcementEnvWarning();
    return NextResponse.json(
      apiSuccess({
        explicit: w.explicit,
        enabled: w.enabled,
        message: w.message,
      })
    );
  } catch (error) {
    return handleApiError(error);
  }
}
