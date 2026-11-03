import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  requireSuperAdmin,
  requireSuperAdminWrite,
} from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { organizationService } from "@/services/organization.service";
import {
  getPowSendGlobalEnabled,
  getPowSendTenantOverride,
  setPowSendGlobalEnabled,
  setPowSendTenantOverride,
} from "@/lib/pow/send-gate";

function envForcesOff(): boolean {
  const raw = process.env.POW_SEND_ENABLED;
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return false;
  }
  const t = String(raw).trim().toLowerCase();
  return t === "false" || t === "0" || t === "no" || t === "off";
}

const patchSchema = z.object({
  scope: z.enum(["global", "tenant"]),
  organizationId: z.string().uuid().optional(),
  /** null clears tenant override (inherit global) */
  enabled: z.boolean().nullable(),
  reason: z.string().max(500).optional(),
});

export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin();
    const orgId = request.nextUrl.searchParams.get("organizationId");
    const globalEnabled = await getPowSendGlobalEnabled();
    const tenantOverride = orgId
      ? await getPowSendTenantOverride(orgId)
      : null;
    return NextResponse.json(
      apiSuccess({
        globalEnabled,
        tenantOverride,
        envForcesOff: envForcesOff(),
        effectiveForTenant:
          orgId && !envForcesOff()
            ? tenantOverride === null
              ? globalEnabled
              : tenantOverride
            : null,
      })
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireSuperAdminWrite();
    const body = patchSchema.parse(await request.json());

    if (body.scope === "global") {
      if (body.enabled === null) {
        return NextResponse.json(
          { success: false, error: { message: "Global enabled cannot be null" } },
          { status: 400 }
        );
      }
      const before = await getPowSendGlobalEnabled();
      await setPowSendGlobalEnabled(body.enabled, user.id);
      await organizationService.writePlatformAudit({
        actorUserId: user.id,
        action: "pow_send.global_set",
        targetType: "platform_setting",
        targetId: "pow_send_enabled",
        before: { enabled: before },
        after: { enabled: body.enabled },
        reason: body.reason,
      });
      return NextResponse.json(
        apiSuccess({
          globalEnabled: body.enabled,
          envForcesOff: envForcesOff(),
        })
      );
    }

    if (!body.organizationId) {
      return NextResponse.json(
        {
          success: false,
          error: { message: "organizationId required for tenant scope" },
        },
        { status: 400 }
      );
    }
    const before = await getPowSendTenantOverride(body.organizationId);
    await setPowSendTenantOverride(
      body.organizationId,
      body.enabled,
      user.id
    );
    await organizationService.writePlatformAudit({
      actorUserId: user.id,
      action: "pow_send.tenant_set",
      targetType: "organization",
      targetId: body.organizationId,
      organizationId: body.organizationId,
      before: { enabled: before },
      after: { enabled: body.enabled },
      reason: body.reason,
    });
    return NextResponse.json(
      apiSuccess({
        organizationId: body.organizationId,
        tenantOverride: body.enabled,
        envForcesOff: envForcesOff(),
      })
    );
  } catch (error) {
    return handleApiError(error);
  }
}
