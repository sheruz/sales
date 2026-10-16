import { NextRequest, NextResponse } from "next/server";
import {
  requireOrgPermission,
  requireOrganizationContext,
} from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { creditLedgerService } from "@/services/credit-ledger.service";
import prisma from "@/lib/db/prisma";

export async function GET(request: NextRequest) {
  try {
    await requireOrgPermission("billing.manage");
    const user = await requireOrganizationContext();
    const cursor = request.nextUrl.searchParams.get("cursor") ?? undefined;
    const take = Number(request.nextUrl.searchParams.get("take") ?? "40");

    const [org, ledger, byAction, isOwner] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: user.organizationId },
        select: {
          creditBalanceCached: true,
          billingEnforcementEnabled: true,
          creditsWarnedAt20: true,
          creditsWarnedAt5: true,
          creditsWarnedAt0: true,
        },
      }),
      creditLedgerService.listLedger(user.organizationId, { cursor, take }),
      creditLedgerService.consumedThisMonthByAction(user.organizationId),
      creditLedgerService.isOwnerOrg(user.organizationId),
    ]);

    const hasMore = ledger.length > take;
    const entries = hasMore ? ledger.slice(0, take) : ledger;

    return NextResponse.json(
      apiSuccess({
        balance: org?.creditBalanceCached ?? 0,
        billingEnforcementEnabled: org?.billingEnforcementEnabled ?? false,
        isOwner,
        warnings: {
          at20: org?.creditsWarnedAt20 ?? null,
          at5: org?.creditsWarnedAt5 ?? null,
          at0: org?.creditsWarnedAt0 ?? null,
        },
        consumedThisMonth: byAction,
        ledger: entries,
        nextCursor: hasMore ? entries[entries.length - 1]?.id : null,
      })
    );
  } catch (error) {
    return handleApiError(error);
  }
}
