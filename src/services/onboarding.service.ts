/**
 * B5d: OnboardingProgress — skip / resume / complete + checklist helpers.
 */

import prisma from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import { getUserReadiness } from "@/lib/integrations/readiness";
import { appHome } from "@/lib/app-paths";
import {
  ONBOARDING_STEPS,
  ONBOARDING_STEP_META,
  isOnboardingStep,
  nextStep,
  type OnboardingStep,
} from "@/lib/onboarding/steps";
import { getIcpTemplate, type IcpTemplateId } from "@/lib/onboarding/icp-templates";
import { tenantAccessService } from "@/services/tenant-access.service";
import { MODULE_KEYS } from "@/lib/billing/modules";

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

function asPayload(v: unknown): Record<string, unknown> {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return {};
}

export class OnboardingService {
  async getOrCreate(organizationId: string) {
    return prisma.onboardingProgress.upsert({
      where: { organizationId },
      create: { organizationId },
      update: {},
    });
  }

  async get(organizationId: string) {
    return this.getOrCreate(organizationId);
  }

  /** True when wizard finished or explicitly skipped */
  async isDismissed(organizationId: string): Promise<boolean> {
    const row = await this.getOrCreate(organizationId);
    return Boolean(row.skipped || row.completedAt);
  }

  async patch(
    organizationId: string,
    input: {
      currentStep?: string;
      completedSteps?: string[];
      skipped?: boolean;
      complete?: boolean;
      payload?: Record<string, unknown>;
    }
  ) {
    const existing = await this.getOrCreate(organizationId);
    const completed = input.completedSteps
      ? input.completedSteps.filter(isOnboardingStep)
      : asStringArray(existing.completedSteps);
    let current =
      input.currentStep && isOnboardingStep(input.currentStep)
        ? input.currentStep
        : (existing.currentStep as OnboardingStep);

    const payload = {
      ...asPayload(existing.payload),
      ...(input.payload || {}),
    };

    let skipped = existing.skipped;
    let completedAt = existing.completedAt;

    if (input.skipped === true) {
      skipped = true;
      completedAt = completedAt ?? new Date();
    }
    if (input.complete === true) {
      completedAt = new Date();
      skipped = false;
      for (const s of ONBOARDING_STEPS) {
        if (!completed.includes(s)) completed.push(s);
      }
      current = "start_autopilot";
    }

    return prisma.onboardingProgress.update({
      where: { organizationId },
      data: {
        currentStep: current,
        completedSteps: completed,
        payload: payload as Prisma.InputJsonValue,
        skipped,
        completedAt,
      },
    });
  }

  async markStepDone(organizationId: string, step: OnboardingStep) {
    const row = await this.getOrCreate(organizationId);
    const completed = asStringArray(row.completedSteps);
    if (!completed.includes(step)) completed.push(step);
    const nxt = nextStep(step);
    return prisma.onboardingProgress.update({
      where: { organizationId },
      data: {
        completedSteps: completed,
        currentStep: nxt || step,
      },
    });
  }

  async applyIcpTemplate(
    organizationId: string,
    templateId: IcpTemplateId
  ) {
    const tpl = getIcpTemplate(templateId);
    if (!tpl) throw new Error("Unknown ICP template");
    const icp = await prisma.icp.create({
      data: {
        organizationId,
        name: tpl.name,
        description: tpl.description,
        industries: tpl.industries,
        countries: tpl.countries,
        companySizes: tpl.companySizes,
        decisionMakerTitles: tpl.decisionMakerTitles,
        buyingSignals: tpl.buyingSignals,
      },
    });
    await this.patch(organizationId, {
      payload: { icpTemplateId: templateId, icpId: icp.id },
      completedSteps: undefined,
    });
    await this.markStepDone(organizationId, "target_customers");
    return icp;
  }

  async snapshot(organizationId: string, userId: string) {
    const { emailBrandingService } = await import(
      "@/services/email-branding.service"
    );
    const [progress, readiness, access, profile, services, icps, mailboxes, branding] =
      await Promise.all([
        this.getOrCreate(organizationId),
        getUserReadiness(organizationId, userId),
        tenantAccessService.getAccess(organizationId),
        prisma.businessProfile.findUnique({ where: { organizationId } }),
        prisma.service.count({ where: { organizationId, isActive: true } }),
        prisma.icp.count({
          where: { organizationId, pausedAt: null },
        }),
        prisma.outboundMailbox.count({ where: { organizationId } }),
        emailBrandingService.get(organizationId),
      ]);

    const allowedIntegrations = [
      { id: "openai", label: "OpenAI", allowed: true },
      { id: "anthropic", label: "Anthropic", allowed: true },
      {
        id: "linkedin",
        label: "LinkedIn",
        allowed: Boolean(access.modules[MODULE_KEYS.LINKEDIN_ASSIST]),
      },
      { id: "email_smtp", label: "Email (SMTP)", allowed: true },
    ];

    const completed = asStringArray(progress.completedSteps);
    const wizardSteps = ONBOARDING_STEPS.map((id) => ({
      id,
      ...ONBOARDING_STEP_META[id],
      done: completed.includes(id) || Boolean(progress.completedAt),
    }));

    return {
      progress: {
        currentStep: progress.currentStep,
        completedSteps: completed,
        skipped: progress.skipped,
        completedAt: progress.completedAt,
        payload: asPayload(progress.payload),
      },
      dismissed: Boolean(progress.skipped || progress.completedAt),
      readiness,
      review: {
        hasProfile: Boolean(profile?.companyName),
        servicesCount: services,
        icpsCount: icps,
        mailboxesCount: mailboxes,
        hasBrandingAddress: Boolean(branding.businessAddress?.trim()),
        aiReady: readiness.readyForAutopilot,
      },
      allowedIntegrations,
      wizardSteps,
      checklistHref: appHome("/onboarding"),
    };
  }
}

export const onboardingService = new OnboardingService();
