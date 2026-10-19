import { NextRequest, NextResponse } from "next/server";
import { requireOrganizationContext } from "@/lib/auth/api-auth";
import { hasOrgPermission } from "@/lib/tenant/scope";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { creditLedgerService } from "@/services/credit-ledger.service";
import prisma from "@/lib/db/prisma";

export async function GET(request: NextRequest) {
  try {
    // Balance meter: any org member. Full ledger: billing.manage.
    const user = await requireOrganizationContext();
    const canManage = hasOrgPermission(user, "billing.manage");
    const cursor = request.nextUrl.searchParams.get("cursor") ?? undefined;
    const take = Number(request.nextUrl.searchParams.get("take") ?? "40");

    const [org, isOwner, sub] = await Promise.all([
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
      creditLedgerService.isOwnerOrg(user.organizationId),
      prisma.subscription.findUnique({
        where: { organizationId: user.organizationId },
        select: { plan: { select: { monthlyCredits: true } } },
      }),
    ]);

    if (!canManage) {
      return NextResponse.json(
        apiSuccess({
          balance: org?.creditBalanceCached ?? 0,
          billingEnforcementEnabled: org?.billingEnforcementEnabled ?? false,
          isOwner,
          monthlyCredits: sub?.plan.monthlyCredits ?? null,
          warnings: {},
          consumedThisMonth: [],
          ledger: [],
          nextCursor: null,
        })
      );
    }

    const [ledger, byAction] = await Promise.all([
      creditLedgerService.listLedger(user.organizationId, { cursor, take }),
      creditLedgerService.consumedThisMonthByAction(user.organizationId),
    ]);

    const hasMore = ledger.length > take;
    const entries = hasMore ? ledger.slice(0, take) : ledger;

    return NextResponse.json(
      apiSuccess({
        balance: org?.creditBalanceCached ?? 0,
        billingEnforcementEnabled: org?.billingEnforcementEnabled ?? false,
        isOwner,
        monthlyCredits: sub?.plan.monthlyCredits ?? null,
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
