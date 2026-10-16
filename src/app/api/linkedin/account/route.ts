import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { linkedInAccountService } from "@/services/linkedin-account.service";
import {
  isLinkedInSessionEnabled,
  LINKEDIN_SESSION_DISABLED_MESSAGE,
} from "@/lib/linkedin/session-mode";
import { requireOrgPermission } from "@/lib/auth/api-auth";
import { apiSuccess, ValidationError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

const connectSchema = z.object({
  liAt: z.string().min(10),
  jsessionId: z.string().min(5),
  linkedInEmail: z.string().email().optional(),
});

export async function GET() {
  try {
    const user = await requireOrgPermission("integrations.manage");
    const status = await linkedInAccountService.getStatus(user.id);
    return NextResponse.json(apiSuccess(status));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireOrgPermission("integrations.manage");
    if (!isLinkedInSessionEnabled()) {
      throw new ValidationError(LINKEDIN_SESSION_DISABLED_MESSAGE);
    }
    const body = await request.json();
    const input = connectSchema.parse(body);
    const account = await linkedInAccountService.saveAccount(user.id, input);
    // Never return ciphertext / cookies / tokens
    return NextResponse.json(apiSuccess({ connected: true, id: account.id }));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE() {
  try {
    const user = await requireOrgPermission("integrations.manage");
    await linkedInAccountService.disconnect(user.id);
    return NextResponse.json(apiSuccess({ disconnected: true }));
  } catch (error) {
    return handleApiError(error);
  }
}
