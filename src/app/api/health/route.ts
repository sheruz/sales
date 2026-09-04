import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { env } from "@/lib/config/env";

/** Liveness + dependency health for monitoring/alerting */
export async function GET() {
  try {
    const started = Date.now();
    let database: "ok" | "error" = "ok";
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      database = "error";
    }

    const [aiUsage24h, emailSent24h, connectorErrors, jobFailures] =
      await Promise.all([
        prisma.aIUsageLog.count({
          where: { createdAt: { gte: new Date(Date.now() - 86400000) } },
        }),
        prisma.emailEvent.count({
          where: {
            type: "SENT",
            createdAt: { gte: new Date(Date.now() - 86400000) },
          },
        }),
        prisma.sourceConnector.count({ where: { status: "ERROR" } }),
        prisma.jobLog.count({
          where: {
            status: "FAILED",
            createdAt: { gte: new Date(Date.now() - 86400000) },
          },
        }),
      ]);

    const healthy = database === "ok";
    return NextResponse.json(
      apiSuccess({
        status: healthy ? "healthy" : "degraded",
        version: "0.1.0",
        env: env.NODE_ENV,
        database,
        latencyMs: Date.now() - started,
        metrics: {
          aiUsage24h,
          emailSent24h,
          connectorErrors,
          jobFailures24h: jobFailures,
        },
        checks: {
          stripeConfigured: Boolean(env.STRIPE_SECRET_KEY),
          cronSecretConfigured: Boolean(env.CRON_SECRET),
          encryptionConfigured: Boolean(env.ENCRYPTION_KEY),
        },
      }),
      { status: healthy ? 200 : 503 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
