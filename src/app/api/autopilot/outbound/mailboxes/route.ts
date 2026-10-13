import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { OutboundMailboxStatus } from "@prisma/client";
import { mailboxPoolService } from "@/services/mailbox-pool.service";
import {
  requireAnyOrgPermission,
  requireOrganizationContext,
} from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

const PERMS = [
  "integrations.manage",
  "campaigns.manage",
  "business_brain.manage",
] as const;

export async function GET() {
  try {
    await requireAnyOrgPermission([...PERMS]);
    const user = await requireOrganizationContext();
    const [pool, available] = await Promise.all([
      mailboxPoolService.list(user.organizationId),
      mailboxPoolService.listAvailableAccounts(user.organizationId),
    ]);
    return NextResponse.json(apiSuccess({ pool, available }));
  } catch (error) {
    return handleApiError(error);
  }
}

const postSchema = z.object({
  emailAccountId: z.string().uuid(),
  dailyCap: z.number().int().min(1).max(100).optional(),
});

export async function POST(request: NextRequest) {
  try {
    await requireAnyOrgPermission([...PERMS]);
    const user = await requireOrganizationContext();
    const body = postSchema.parse(await request.json());
    const result = await mailboxPoolService.addToPool(
      user.organizationId,
      body.emailAccountId,
      { dailyCap: body.dailyCap }
    );
    return NextResponse.json(apiSuccess(result));
  } catch (error) {
    return handleApiError(error);
  }
}

const patchSchema = z.object({
  mailboxId: z.string().uuid(),
  action: z.enum(["pause", "activate", "remove", "refresh_dns", "test"]),
});

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAnyOrgPermission([...PERMS]);
    await requireOrganizationContext();
    const body = patchSchema.parse(await request.json());

    if (body.action === "remove") {
      return NextResponse.json(
        apiSuccess(
          await mailboxPoolService.removeFromPool(
            user.organizationId,
            body.mailboxId
          )
        )
      );
    }
    if (body.action === "refresh_dns") {
      return NextResponse.json(
        apiSuccess(
          await mailboxPoolService.refreshDns(
            user.organizationId,
            body.mailboxId
          )
        )
      );
    }
    if (body.action === "test") {
      return NextResponse.json(
        apiSuccess(
          await mailboxPoolService.sendTestToSelf(
            user.organizationId,
            body.mailboxId,
            user.id
          )
        )
      );
    }
    if (body.action === "pause") {
      return NextResponse.json(
        apiSuccess(
          await mailboxPoolService.setStatus(
            user.organizationId,
            body.mailboxId,
            OutboundMailboxStatus.PAUSED
          )
        )
      );
    }
    // activate: re-check DNS first (clears stale Gmail/Outlook DKIM pause)
    return NextResponse.json(
      apiSuccess(
        await mailboxPoolService.refreshDns(
          user.organizationId,
          body.mailboxId
        )
      )
    );
  } catch (error) {
    return handleApiError(error);
  }
}
