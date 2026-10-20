import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { revenueMetricsService } from "@/services/billing/revenue-metrics.service";

export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin();
    const envParam =
      request.nextUrl.searchParams.get("environment") || "production";
    const environment =
      envParam === "sandbox" || envParam === "test" ? "sandbox" : "production";
    const live = await revenueMetricsService.snapshot("production");
    const test = await revenueMetricsService.snapshot("sandbox");
    return NextResponse.json(
      apiSuccess({
        primary: environment === "sandbox" ? test : live,
        live,
        test,
      })
    );
  } catch (error) {
    return handleApiError(error);
  }
}
