import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSuperAdmin } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { revenueMetricsService } from "@/services/billing/revenue-metrics.service";
import {
  PLATFORM_BILLING_ENV_COOKIE,
  parsePlatformBillingEnv,
} from "@/lib/platform/environment-preference";

export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin();
    const jar = await cookies();
    const cookieEnv = parsePlatformBillingEnv(
      jar.get(PLATFORM_BILLING_ENV_COOKIE)?.value
    );
    const envParam =
      request.nextUrl.searchParams.get("environment") || cookieEnv;
    const environment =
      envParam === "sandbox" || envParam === "test" ? "sandbox" : "production";
    const live = await revenueMetricsService.snapshot("production");
    const test = await revenueMetricsService.snapshot("sandbox");
    return NextResponse.json(
      apiSuccess({
        primary: environment === "sandbox" ? test : live,
        live,
        test,
        preferred: cookieEnv,
      })
    );
  } catch (error) {
    return handleApiError(error);
  }
}
