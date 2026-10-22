import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import prisma from "@/lib/db/prisma";
import {
  requireAnyOrgPermission,
  requireOrganizationContext,
} from "@/lib/auth/api-auth";
import { handleApiError } from "@/lib/api/error-handler";
import { resolveEvidencePath } from "@/lib/audit/evidence-store";

export const dynamic = "force-dynamic";

/**
 * Authenticated evidence serve — never under public/.
 * Tokenized preview (PoW3) will add a separate public path later.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAnyOrgPermission([
      "integrations.manage",
      "campaigns.manage",
      "business_brain.manage",
    ]);
    await requireOrganizationContext();
    const { id } = await context.params;

    const row = await prisma.auditEvidence.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const abs = resolveEvidencePath(user.organizationId, row.relativePath);
    const buf = await readFile(abs);
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": row.contentType,
        "Content-Length": String(buf.byteLength),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
