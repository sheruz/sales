import { env } from "@/lib/config/env";
import { UnauthorizedError } from "@/lib/api/response";

/**
 * Cron/webhook internal auth — fail closed in production.
 */
export function assertCronAuthorized(request: Request): void {
  const secret = env.CRON_SECRET;
  const header =
    request.headers.get("authorization") ||
    request.headers.get("x-cron-secret") ||
    "";

  if (env.NODE_ENV === "production") {
    if (!secret) {
      throw new UnauthorizedError("CRON_SECRET must be configured in production");
    }
  }

  if (!secret) {
    // Non-production convenience only
    return;
  }

  const bearer = header.startsWith("Bearer ")
    ? header.slice(7)
    : header;
  const xCron = request.headers.get("x-cron-secret") || "";

  if (bearer !== secret && xCron !== secret && header !== `Bearer ${secret}`) {
    throw new UnauthorizedError("Invalid cron credentials");
  }
}
