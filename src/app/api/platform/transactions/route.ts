import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSuperAdmin } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { billingTransactionService } from "@/services/billing/billing-transaction.service";
import {
  PLATFORM_BILLING_ENV_COOKIE,
  parsePlatformBillingEnv,
} from "@/lib/platform/environment-preference";

export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin();
    const sp = request.nextUrl.searchParams;
    const format = sp.get("format");
    const jar = await cookies();
    const cookieEnv = parsePlatformBillingEnv(
      jar.get(PLATFORM_BILLING_ENV_COOKIE)?.value
    );
    const envRaw = sp.get("environment");
    const environment =
      envRaw === "all"
        ? undefined
        : envRaw || cookieEnv;
    const result = await billingTransactionService.list({
      environment,
      organizationId: sp.get("organizationId") || undefined,
      provider: sp.get("provider") || undefined,
      status: sp.get("status") || undefined,
      kind: sp.get("kind") || undefined,
      take: Number(sp.get("take") || 100),
      skip: Number(sp.get("skip") || 0),
    });

    if (format === "csv") {
      const header = [
        "date",
        "org",
        "kind",
        "amount",
        "fee",
        "net",
        "currency",
        "status",
        "provider",
        "environment",
        "externalId",
      ].join(",");
      const lines = result.rows.map((r) =>
        [
          r.occurredAt.toISOString(),
          JSON.stringify(r.organization.name),
          r.kind,
          r.amount,
          r.feeAmount ?? "",
          r.netAmount ?? "",
          r.currency,
          r.status,
          r.provider,
          r.environment,
          r.externalId ?? "",
        ].join(",")
      );
      return new NextResponse([header, ...lines].join("\n"), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="transactions.csv"',
        },
      });
    }

    return NextResponse.json(apiSuccess(result));
  } catch (error) {
    return handleApiError(error);
  }
}
