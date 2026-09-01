import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  AppError,
  apiError,
  type ApiResponse,
} from "@/lib/api/response";
import { logger } from "@/lib/logger";

export function handleApiError(error: unknown): NextResponse<ApiResponse<never>> {
  if (error instanceof AppError) {
    return NextResponse.json(
      apiError(error.message, error.code, error.details),
      { status: error.statusCode }
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      apiError("Validation failed", "VALIDATION_ERROR", error.flatten().fieldErrors),
      { status: 400 }
    );
  }

  logger.error("Unhandled API error", {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });

  return NextResponse.json(
    apiError("Internal server error", "INTERNAL_ERROR"),
    { status: 500 }
  );
}
