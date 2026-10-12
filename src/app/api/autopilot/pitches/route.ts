import { NextResponse } from "next/server";
import { websiteAuditService } from "@/services/website-audit.service";
import {
  requireAnyOrgPermission,
  requireOrganizationContext,
} from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

const SOURCING_PERMS = [
  "integrations.manage",
  "campaigns.manage",
  "business_brain.manage",
] as const;

export async function GET() {
  try {
    await requireAnyOrgPermission([...SOURCING_PERMS]);
    const user = await requireOrganizationContext();
    const pitches = await websiteAuditService.listDraftPitches(
      user.organizationId
    );
    return NextResponse.json(
      apiSuccess({
        pitches: pitches.map((p) => ({
          id: p.id,
          status: p.status,
          personalizedFirstLine: p.personalizedFirstLine,
          shortPitch: p.shortPitch,
          topIssue: p.topIssue,
          recommendedService: p.recommendedService,
          confidence: p.confidence,
          editedByUser: p.editedByUser,
          missingVars: p.missingVars,
          createdAt: p.createdAt.toISOString(),
          company: p.company,
          contact: p.contact,
          findings: p.websiteAudit.findings,
          pageSpeedMobile: p.websiteAudit.pageSpeedMobile,
          auditId: p.websiteAudit.id,
          auditAt: p.websiteAudit.createdAt.toISOString(),
        })),
      })
    );
  } catch (error) {
    return handleApiError(error);
  }
}
