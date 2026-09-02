import prisma from "@/lib/db/prisma";
import { ValidationError } from "@/lib/api/response";
import { AUTOPILOT_SAFE_DEFAULTS } from "@/lib/constants/autopilot-limits";

export async function resetAutopilotDailyIfNeeded(userId: string) {
  const config = await prisma.autopilotConfig.findUnique({ where: { userId } });
  if (!config) return null;

  const now = new Date();
  const lastReset = config.dailyResetAt ?? config.createdAt;
  const hoursSinceReset = (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60);

  if (hoursSinceReset >= 24) {
    return prisma.autopilotConfig.update({
      where: { userId },
      data: {
        dailyLeadsCreated: 0,
        dailyEmailsSent: 0,
        dailyAiCalls: 0,
        dailyResetAt: now,
      },
    });
  }

  return config;
}

export async function getAutopilotUsage(userId: string) {
  const config = await resetAutopilotDailyIfNeeded(userId);
  if (!config) return null;

  const linkedIn = await prisma.linkedInAccount.findUnique({ where: { userId } });

  return {
    dailyLeadsCreated: config.dailyLeadsCreated,
    maxLeadsPerDay: config.maxLeadsPerDay,
    maxLeadsPerRun: config.maxLeadsPerRun,
    dailyAiCalls: config.dailyAiCalls,
    maxAiCallsPerDay: config.maxAiCallsPerDay,
    dailyMessageCount: config.dailyEmailsSent,
    dailyMessageLimit: config.dailyMessageLimit,
    dailySearchCount: linkedIn?.dailySearchCount ?? 0,
    dailySearchLimit: config.dailySearchLimit,
    remainingLeadsToday: Math.max(0, config.maxLeadsPerDay - config.dailyLeadsCreated),
    remainingAiCallsToday: Math.max(0, config.maxAiCallsPerDay - config.dailyAiCalls),
    remainingEmailsToday: Math.max(0, config.dailyMessageLimit - config.dailyEmailsSent),
  };
}

export async function incrementAutopilotEmails(userId: string, count = 1) {
  await resetAutopilotDailyIfNeeded(userId);
  await prisma.autopilotConfig.update({
    where: { userId },
    data: { dailyEmailsSent: { increment: count } },
  });
}

export async function incrementAutopilotLeads(userId: string, count: number) {
  await resetAutopilotDailyIfNeeded(userId);
  await prisma.autopilotConfig.update({
    where: { userId },
    data: { dailyLeadsCreated: { increment: count } },
  });
}

export async function incrementAutopilotAiCalls(userId: string, count = 1) {
  await resetAutopilotDailyIfNeeded(userId);
  await prisma.autopilotConfig.update({
    where: { userId },
    data: { dailyAiCalls: { increment: count } },
  });
}

export async function assertAutopilotCanRun(userId: string) {
  const config = await resetAutopilotDailyIfNeeded(userId);
  if (!config) throw new ValidationError("Autopilot not configured");

  if (config.dailyLeadsCreated >= config.maxLeadsPerDay) {
    throw new ValidationError(
      `Daily lead limit reached (${config.maxLeadsPerDay}/day). Resets in 24h. Disable autopilot to stop cron.`
    );
  }

  if (config.dailyAiCalls >= config.maxAiCallsPerDay) {
    throw new ValidationError(
      `Daily AI call limit reached (${config.maxAiCallsPerDay}/day). Protects your Claude account.`
    );
  }

  if (config.nextRunAt && config.nextRunAt > new Date()) {
    const waitMin = Math.ceil((config.nextRunAt.getTime() - Date.now()) / 60000);
    throw new ValidationError(`Please wait ${waitMin} minutes before next autopilot run.`);
  }

  return config;
}

export function effectiveRunLimit(config: {
  maxLeadsPerRun: number;
  maxLeadsPerDay: number;
  dailyLeadsCreated: number;
  dailySearchLimit: number;
}) {
  const remainingToday = config.maxLeadsPerDay - config.dailyLeadsCreated;
  return Math.max(
    0,
    Math.min(config.maxLeadsPerRun, config.dailySearchLimit, remainingToday)
  );
}

export { AUTOPILOT_SAFE_DEFAULTS };
