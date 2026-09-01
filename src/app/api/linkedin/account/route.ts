import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { linkedInAccountService } from "@/services/linkedin-account.service";
import { requirePermission } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

const connectSchema = z.object({
  liAt: z.string().min(10),
  jsessionId: z.string().min(5),
  linkedInEmail: z.string().email().optional(),
});

export async function GET() {
  try {
    const user = await requirePermission("settings:write");
    const status = await linkedInAccountService.getStatus(user.id);
    return NextResponse.json(apiSuccess(status));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("settings:write");
    const body = await request.json();
    const input = connectSchema.parse(body);
    const account = await linkedInAccountService.saveAccount(user.id, input);
    return NextResponse.json(apiSuccess({ connected: true, id: account.id }));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE() {
  try {
    const user = await requirePermission("settings:write");
    await linkedInAccountService.disconnect(user.id);
    return NextResponse.json(apiSuccess({ disconnected: true }));
  } catch (error) {
    return handleApiError(error);
  }
}
