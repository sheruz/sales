import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  requirePlatformRead,
  requirePlatformOutreachWrite,
} from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { platformOutreachService } from "@/services/platform-outreach.service";

export async function GET() {
  try {
    await requirePlatformRead();
    const data = await platformOutreachService.listAccounts();
    return NextResponse.json(apiSuccess(data));
  } catch (error) {
    return handleApiError(error);
  }
}

const testSchema = z.object({
  mailboxId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requirePlatformOutreachWrite();
    const body = testSchema.parse(await request.json());
    const result = await platformOutreachService.testAccount(
      body.mailboxId,
      user.id
    );
    return NextResponse.json(apiSuccess(result));
  } catch (error) {
    return handleApiError(error);
  }
}
