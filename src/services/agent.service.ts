import { createHash } from "crypto";
import prisma from "@/lib/db/prisma";
import {
  AgentActionStatus,
  AgentActionType,
  AgentGoalStatus,
  AgentRunStatus,
  OpportunityStatus,
  RevenueGoalStatus,
  type Prisma,
} from "@prisma/client";
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/lib/api/response";
import {
  DEFAULT_ALLOWED_ACTIONS,
  DEFAULT_ALLOWED_CHANNELS,
  DEFAULT_APPROVAL_POLICY,
  actionRequiresApproval,
  isActionAllowed,
  type ApprovalPolicy,
} from "@/lib/agent/policy";
import { businessBrainService } from "@/services/business-brain.service";
import { opportunityService } from "@/services/opportunity.service";
import { opportunityIntelligenceService } from "@/services/opportunity-intelligence.service";
import { sourceConnectorService } from "@/services/source-connector.service";
import { taskService } from "@/services/task.service";
import { learningService } from "@/services/learning.service";
import { aiRecommendationService } from "@/services/ai-recommendation.service";
import { inboxService } from "@/services/inbox.service";

function dayStartUtc(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function parsePolicy(raw: unknown): ApprovalPolicy {
  if (!raw || typeof raw !== "object") return DEFAULT_APPROVAL_POLICY;
  const obj = raw as Partial<ApprovalPolicy>;
  return {
    requireApproval: Array.isArray(obj.requireApproval)
      ? (obj.requireApproval as AgentActionType[])
      : DEFAULT_APPROVAL_POLICY.requireApproval,
    autoAllow: Array.isArray(obj.autoAllow)
      ? (obj.autoAllow as AgentActionType[])
      : DEFAULT_APPROVAL_POLICY.autoAllow,
  };
}

function actionKey(
  runId: string,
  actionType: AgentActionType,
  entityId?: string | null,
  salt = ""
): string {
  return createHash("sha256")
    .update(`${runId}|${actionType}|${entityId || ""}|${salt}`)
    .digest("hex")
    .slice(0, 48);
}

export class AgentService {
  async listGoals(organizationId: string) {
    return prisma.agentGoal.findMany({
      where: { organizationId },
      include: {
        revenueGoal: {
          select: {
            id: true,
            name: true,
            targetRevenue: true,
            currency: true,
            status: true,
            targetRegions: true,
            targetIndustries: true,
          },
        },
        _count: { select: { runs: true, actions: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  async getGoal(organizationId: string, id: string) {
    const goal = await prisma.agentGoal.findFirst({
      where: { id, organizationId },
      include: {
        revenueGoal: true,
        runs: { orderBy: { createdAt: "desc" }, take: 10 },
      },
    });
    if (!goal) throw new NotFoundError("Agent goal not found");
    return goal;
  }

  async createGoal(
    organizationId: string,
    userId: string,
    input: {
      revenueGoalId: string;
      name?: string;
      objective?: string;
      constraints?: Record<string, unknown>;
      allowedChannels?: string[];
      allowedActions?: string[];
      maxDailyActions?: number;
      maxDailySpend?: number;
      activate?: boolean;
    }
  ) {
    const revenueGoal = await prisma.revenueGoal.findFirst({
      where: { id: input.revenueGoalId, organizationId },
    });
    if (!revenueGoal) throw new NotFoundError("Revenue goal not found");
    if (revenueGoal.status !== RevenueGoalStatus.ACTIVE && input.activate) {
      throw new ValidationError(
        "Activate the Revenue Goal first before activating the agent"
      );
    }

    const objective =
      input.objective?.trim() ||
      revenueGoal.sourcePrompt ||
      `Generate ${revenueGoal.currency} ${Number(revenueGoal.targetRevenue)} toward ${revenueGoal.name}`;

    return prisma.agentGoal.create({
      data: {
        organizationId,
        revenueGoalId: revenueGoal.id,
        name: (input.name || `Agent: ${revenueGoal.name}`).trim(),
        objective,
        constraints: (input.constraints ?? {
          regions: revenueGoal.targetRegions,
          industries: revenueGoal.targetIndustries,
          services: revenueGoal.targetServices,
        }) as Prisma.InputJsonValue,
        allowedChannels: input.allowedChannels?.length
          ? input.allowedChannels
          : revenueGoal.preferredChannels.length
            ? revenueGoal.preferredChannels
            : [...DEFAULT_ALLOWED_CHANNELS],
        allowedActions: input.allowedActions?.length
          ? input.allowedActions
          : DEFAULT_ALLOWED_ACTIONS,
        approvalPolicy: DEFAULT_APPROVAL_POLICY as unknown as Prisma.InputJsonValue,
        maxDailyActions: input.maxDailyActions ?? 50,
        maxDailySpend: input.maxDailySpend ?? 0,
        status:
          input.activate && revenueGoal.status === RevenueGoalStatus.ACTIVE
            ? AgentGoalStatus.ACTIVE
            : AgentGoalStatus.DRAFT,
        createdById: userId,
      },
      include: { revenueGoal: true },
    });
  }

  async updateGoal(
    organizationId: string,
    id: string,
    input: Partial<{
      name: string;
      objective: string;
      constraints: Record<string, unknown>;
      allowedChannels: string[];
      allowedActions: string[];
      maxDailyActions: number;
      maxDailySpend: number;
      status: AgentGoalStatus;
    }>
  ) {
    await this.getGoal(organizationId, id);
    if (input.status === AgentGoalStatus.ACTIVE) {
      const goal = await prisma.agentGoal.findFirst({
        where: { id, organizationId },
        include: { revenueGoal: true },
      });
      if (goal?.revenueGoal.status !== RevenueGoalStatus.ACTIVE) {
        throw new ValidationError(
          "Revenue Goal must be ACTIVE before the agent can run"
        );
      }
    }

    return prisma.agentGoal.update({
      where: { id },
      data: {
        name: input.name?.trim(),
        objective: input.objective?.trim(),
        constraints: input.constraints as Prisma.InputJsonValue | undefined,
        allowedChannels: input.allowedChannels,
        allowedActions: input.allowedActions,
        maxDailyActions: input.maxDailyActions,
        maxDailySpend: input.maxDailySpend,
        status: input.status,
      },
      include: { revenueGoal: true },
    });
  }

  async listPendingApprovals(organizationId: string) {
    return prisma.agentAction.findMany({
      where: {
        organizationId,
        status: AgentActionStatus.AWAITING_APPROVAL,
        requiresApproval: true,
      },
      include: {
        agentGoal: { select: { id: true, name: true } },
        agentRun: { select: { id: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async listRuns(organizationId: string, agentGoalId?: string) {
    return prisma.agentRun.findMany({
      where: {
        organizationId,
        ...(agentGoalId ? { agentGoalId } : {}),
      },
      include: {
        agentGoal: { select: { id: true, name: true } },
        _count: { select: { actions: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  async getRun(organizationId: string, runId: string) {
    const run = await prisma.agentRun.findFirst({
      where: { id: runId, organizationId },
      include: {
        agentGoal: true,
        actions: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!run) throw new NotFoundError("Agent run not found");
    return run;
  }

  /**
   * Start a controlled agent run against an ACTIVE agent goal + ACTIVE revenue goal.
   * Plans actions, auto-executes safe ones, parks approval-required ones.
   */
  async startRun(
    organizationId: string,
    agentGoalId: string,
    userId: string,
    opts?: { idempotencyKey?: string; triggeredBy?: string }
  ) {
    const goal = await prisma.agentGoal.findFirst({
      where: { id: agentGoalId, organizationId },
      include: { revenueGoal: true },
    });
    if (!goal) throw new NotFoundError("Agent goal not found");
    if (goal.status !== AgentGoalStatus.ACTIVE) {
      throw new ValidationError("Agent goal must be ACTIVE to run");
    }
    if (goal.revenueGoal.status !== RevenueGoalStatus.ACTIVE) {
      throw new ValidationError("Linked Revenue Goal must be ACTIVE");
    }

    await this.assertDailyActionBudget(organizationId, goal.id, goal.maxDailyActions);

    const idempotencyKey =
      opts?.idempotencyKey ||
      `run:${agentGoalId}:${dayStartUtc().toISOString().slice(0, 10)}:${Date.now()}`;

    const existing = await prisma.agentRun.findUnique({
      where: {
        organizationId_idempotencyKey: { organizationId, idempotencyKey },
      },
      include: { actions: true },
    });
    if (existing) return existing;

    const run = await prisma.agentRun.create({
      data: {
        organizationId,
        agentGoalId: goal.id,
        status: AgentRunStatus.RUNNING,
        triggeredBy: opts?.triggeredBy || "USER",
        idempotencyKey,
        startedAt: new Date(),
      },
    });

    try {
      const plan = await this.planActions(organizationId, userId, goal, run.id);
      let successful = 0;
      let failed = 0;
      let awaiting = 0;

      for (const step of plan) {
        const action = await this.enqueueAction({
          organizationId,
          agentRunId: run.id,
          agentGoalId: goal.id,
          actionType: step.actionType,
          entityType: step.entityType,
          entityId: step.entityId,
          input: step.input,
          policy: parsePolicy(goal.approvalPolicy),
          allowedActions: goal.allowedActions,
        });

        if (action.status === AgentActionStatus.DENIED) {
          failed++;
          continue;
        }

        if (action.requiresApproval) {
          awaiting++;
          continue;
        }

        const executed = await this.executeAction(organizationId, userId, action.id);
        if (executed.status === AgentActionStatus.SUCCEEDED) successful++;
        else if (executed.status === AgentActionStatus.FAILED) failed++;
        else if (executed.status === AgentActionStatus.SKIPPED) {
          /* skip */
        }
      }

      const finalStatus =
        awaiting > 0
          ? AgentRunStatus.AWAITING_APPROVAL
          : failed > 0 && successful === 0
            ? AgentRunStatus.FAILED
            : AgentRunStatus.COMPLETED;

      return prisma.agentRun.update({
        where: { id: run.id },
        data: {
          status: finalStatus,
          completedAt:
            finalStatus === AgentRunStatus.AWAITING_APPROVAL
              ? null
              : new Date(),
          actionsCount: plan.length,
          successfulActions: successful,
          failedActions: failed,
          summary: `Planned ${plan.length} actions · ${successful} succeeded · ${awaiting} awaiting approval · ${failed} failed/denied`,
        },
        include: { actions: { orderBy: { createdAt: "asc" } } },
      });
    } catch (error) {
      await prisma.agentRun.update({
        where: { id: run.id },
        data: {
          status: AgentRunStatus.FAILED,
          completedAt: new Date(),
          error: error instanceof Error ? error.message : "run_failed",
        },
      });
      throw error;
    }
  }

  async approveAction(
    organizationId: string,
    actionId: string,
    userId: string,
    decision: "approve" | "deny"
  ) {
    const action = await prisma.agentAction.findFirst({
      where: { id: actionId, organizationId },
    });
    if (!action) throw new NotFoundError("Agent action not found");
    if (action.status !== AgentActionStatus.AWAITING_APPROVAL) {
      throw new ValidationError("Action is not awaiting approval");
    }

    if (decision === "deny") {
      return prisma.agentAction.update({
        where: { id: actionId },
        data: {
          status: AgentActionStatus.DENIED,
          approvedById: userId,
          approvedAt: new Date(),
          result: { decision: "denied" },
        },
      });
    }

    await prisma.agentAction.update({
      where: { id: actionId },
      data: {
        status: AgentActionStatus.AUTHORIZED,
        approvedById: userId,
        approvedAt: new Date(),
      },
    });

    const executed = await this.executeAction(organizationId, userId, actionId);
    await this.refreshRunStatus(organizationId, action.agentRunId);
    return executed;
  }

  private async refreshRunStatus(organizationId: string, runId: string) {
    const actions = await prisma.agentAction.findMany({
      where: { organizationId, agentRunId: runId },
    });
    const awaiting = actions.filter(
      (a) => a.status === AgentActionStatus.AWAITING_APPROVAL
    ).length;
    const succeeded = actions.filter(
      (a) => a.status === AgentActionStatus.SUCCEEDED
    ).length;
    const failed = actions.filter(
      (a) =>
        a.status === AgentActionStatus.FAILED ||
        a.status === AgentActionStatus.DENIED
    ).length;

    await prisma.agentRun.update({
      where: { id: runId },
      data: {
        status:
          awaiting > 0
            ? AgentRunStatus.AWAITING_APPROVAL
            : AgentRunStatus.COMPLETED,
        completedAt: awaiting > 0 ? null : new Date(),
        successfulActions: succeeded,
        failedActions: failed,
        actionsCount: actions.length,
        summary: `${succeeded} succeeded · ${awaiting} awaiting · ${failed} failed/denied`,
      },
    });
  }

  private async assertDailyActionBudget(
    organizationId: string,
    agentGoalId: string,
    maxDailyActions: number
  ) {
    const start = dayStartUtc();
    const count = await prisma.agentAction.count({
      where: {
        organizationId,
        agentGoalId,
        createdAt: { gte: start },
        status: {
          in: [
            AgentActionStatus.SUCCEEDED,
            AgentActionStatus.RUNNING,
            AgentActionStatus.AWAITING_APPROVAL,
            AgentActionStatus.AUTHORIZED,
            AgentActionStatus.QUEUED,
          ],
        },
      },
    });
    if (count >= maxDailyActions) {
      throw new ForbiddenError(
        `Daily agent action limit reached (${count}/${maxDailyActions})`
      );
    }
  }

  private async enqueueAction(input: {
    organizationId: string;
    agentRunId: string;
    agentGoalId: string;
    actionType: AgentActionType;
    entityType?: string;
    entityId?: string | null;
    input?: Record<string, unknown>;
    policy: ApprovalPolicy;
    allowedActions: string[];
  }) {
    const idempotencyKey = actionKey(
      input.agentRunId,
      input.actionType,
      input.entityId,
      JSON.stringify(input.input ?? {})
    );

    const existing = await prisma.agentAction.findUnique({
      where: {
        organizationId_idempotencyKey: {
          organizationId: input.organizationId,
          idempotencyKey,
        },
      },
    });
    if (existing) return existing;

    if (!isActionAllowed(input.actionType, input.allowedActions)) {
      return prisma.agentAction.create({
        data: {
          organizationId: input.organizationId,
          agentRunId: input.agentRunId,
          agentGoalId: input.agentGoalId,
          actionType: input.actionType,
          entityType: input.entityType,
          entityId: input.entityId,
          input: (input.input ?? {}) as Prisma.InputJsonValue,
          status: AgentActionStatus.DENIED,
          requiresApproval: true,
          idempotencyKey,
          error: "Action not in allowed_actions for this agent goal",
          result: { reason: "not_allowed" },
        },
      });
    }

    const requiresApproval = actionRequiresApproval(
      input.actionType,
      input.policy
    );

    return prisma.agentAction.create({
      data: {
        organizationId: input.organizationId,
        agentRunId: input.agentRunId,
        agentGoalId: input.agentGoalId,
        actionType: input.actionType,
        entityType: input.entityType,
        entityId: input.entityId,
        input: (input.input ?? {}) as Prisma.InputJsonValue,
        status: requiresApproval
          ? AgentActionStatus.AWAITING_APPROVAL
          : AgentActionStatus.AUTHORIZED,
        requiresApproval,
        idempotencyKey,
      },
    });
  }

  private async planActions(
    organizationId: string,
    userId: string,
    goal: {
      id: string;
      objective: string;
      allowedChannels: string[];
      constraints: unknown;
      revenueGoal: {
        id: string;
        name: string;
        targetRevenue: { toString(): string } | number;
        currency: string;
        targetIndustries: string[];
        targetRegions: string[];
      };
    },
    runId: string
  ) {
    const steps: Array<{
      actionType: AgentActionType;
      entityType?: string;
      entityId?: string | null;
      input?: Record<string, unknown>;
    }> = [];

    steps.push({
      actionType: AgentActionType.READ_CONTEXT,
      input: { revenueGoalId: goal.revenueGoal.id, objective: goal.objective },
    });

    steps.push({
      actionType: AgentActionType.ENSURE_ICP,
      input: {
        industries: goal.revenueGoal.targetIndustries,
        regions: goal.revenueGoal.targetRegions,
      },
    });

    steps.push({
      actionType: AgentActionType.MEASURE_REVENUE,
      entityType: "revenue_goal",
      entityId: goal.revenueGoal.id,
    });

    const connectors = await prisma.sourceConnector.findMany({
      where: { organizationId, status: "CONNECTED" },
      take: 5,
      select: { id: true, name: true, type: true },
    });
    for (const c of connectors) {
      steps.push({
        actionType: AgentActionType.RUN_SOURCE_CONNECTOR,
        entityType: "source_connector",
        entityId: c.id,
        input: { connectorName: c.name, connectorType: c.type },
      });
    }

    const opportunities = await prisma.opportunity.findMany({
      where: {
        organizationId,
        status: OpportunityStatus.OPEN,
      },
      orderBy: [{ score: "desc" }, { updatedAt: "desc" }],
      take: 8,
      select: {
        id: true,
        score: true,
        companyId: true,
        primaryContactId: true,
        stage: true,
      },
    });

    steps.push({
      actionType: AgentActionType.PRIORITIZE,
      input: {
        opportunityIds: opportunities.map((o) => o.id),
        count: opportunities.length,
      },
    });

    for (const opp of opportunities.slice(0, 5)) {
      steps.push({
        actionType: AgentActionType.SCORE_OPPORTUNITY,
        entityType: "opportunity",
        entityId: opp.id,
      });
    }

    for (const opp of opportunities.slice(0, 3)) {
      steps.push({
        actionType: AgentActionType.RESEARCH_OPPORTUNITY,
        entityType: "opportunity",
        entityId: opp.id,
      });
      steps.push({
        actionType: AgentActionType.RECOMMEND_SERVICE,
        entityType: "opportunity",
        entityId: opp.id,
      });
      steps.push({
        actionType: AgentActionType.FIND_DECISION_MAKER,
        entityType: "opportunity",
        entityId: opp.id,
      });
      steps.push({
        actionType: AgentActionType.CREATE_TASK,
        entityType: "opportunity",
        entityId: opp.id,
        input: {
          title: `Agent follow-up: review scored opportunity`,
        },
      });
      steps.push({
        actionType: AgentActionType.DRAFT_OUTREACH,
        entityType: "opportunity",
        entityId: opp.id,
        input: { channels: goal.allowedChannels },
      });
      steps.push({
        actionType: AgentActionType.SEND_OUTREACH,
        entityType: "opportunity",
        entityId: opp.id,
        input: {
          note: "Outbound requires human approval",
          channels: goal.allowedChannels,
        },
      });
    }

    if (opportunities[0]) {
      steps.push({
        actionType: AgentActionType.PREPARE_PROPOSAL,
        entityType: "opportunity",
        entityId: opportunities[0].id,
        input: { draftOnly: true },
      });
    }

    steps.push({
      actionType: AgentActionType.INTERNAL_RECOMMENDATION,
      input: { source: "agent_run", runId },
    });

    steps.push({
      actionType: AgentActionType.LEARN,
      input: { mode: "discover_patterns" },
    });

    // Volume guard: if planning more than soft threshold, require unusual volume approval
    if (steps.length > 40) {
      steps.unshift({
        actionType: AgentActionType.UNUSUAL_VOLUME,
        input: { plannedActions: steps.length },
      });
    }

    return steps;
  }

  async executeAction(
    organizationId: string,
    userId: string,
    actionId: string
  ) {
    const action = await prisma.agentAction.findFirst({
      where: { id: actionId, organizationId },
    });
    if (!action) throw new NotFoundError("Agent action not found");

    if (
      action.status !== AgentActionStatus.AUTHORIZED &&
      !(
        action.status === AgentActionStatus.AWAITING_APPROVAL &&
        !action.requiresApproval
      )
    ) {
      if (
        action.status === AgentActionStatus.SUCCEEDED ||
        action.status === AgentActionStatus.FAILED ||
        action.status === AgentActionStatus.DENIED ||
        action.status === AgentActionStatus.SKIPPED
      ) {
        return action; // idempotent
      }
      if (action.requiresApproval && !action.approvedAt) {
        throw new ForbiddenError("Action requires approval before execution");
      }
    }

    await prisma.agentAction.update({
      where: { id: actionId },
      data: { status: AgentActionStatus.RUNNING },
    });

    try {
      const result = await this.dispatch(organizationId, userId, action);
      return prisma.agentAction.update({
        where: { id: actionId },
        data: {
          status: AgentActionStatus.SUCCEEDED,
          result: result as Prisma.InputJsonValue,
          executedAt: new Date(),
          error: null,
        },
      });
    } catch (error) {
      return prisma.agentAction.update({
        where: { id: actionId },
        data: {
          status: AgentActionStatus.FAILED,
          error: error instanceof Error ? error.message : "action_failed",
          executedAt: new Date(),
        },
      });
    }
  }

  private async dispatch(
    organizationId: string,
    userId: string,
    action: {
      id: string;
      actionType: AgentActionType;
      entityId: string | null;
      entityType: string | null;
      input: unknown;
      idempotencyKey: string;
    }
  ): Promise<Record<string, unknown>> {
    const input = (action.input || {}) as Record<string, unknown>;

    switch (action.actionType) {
      case AgentActionType.READ_CONTEXT: {
        const brain = await businessBrainService.getSafeContext(organizationId);
        return {
          services: brain.services.length,
          icps: brain.icps.length,
          activeGoals: brain.activeGoals.length,
          hasProfile: Boolean(brain.profile),
        };
      }

      case AgentActionType.ENSURE_ICP: {
        const icps = await prisma.icp.count({
          where: { organizationId, status: "ACTIVE" },
        });
        return {
          activeIcps: icps,
          note:
            icps > 0
              ? "ICP present"
              : "No active ICP — create one in Business Brain / ICP",
        };
      }

      case AgentActionType.MEASURE_REVENUE: {
        const goalId = action.entityId;
        const goal = goalId
          ? await prisma.revenueGoal.findFirst({
              where: { id: goalId, organizationId },
            })
          : null;
        const won = await prisma.opportunity.aggregate({
          where: { organizationId, status: "WON" },
          _sum: { estimatedValue: true },
          _count: true,
        });
        return {
          revenueGoal: goal
            ? {
                id: goal.id,
                name: goal.name,
                target: Number(goal.targetRevenue),
                currency: goal.currency,
              }
            : null,
          wonCount: won._count,
          wonValue: Number(won._sum.estimatedValue || 0),
        };
      }

      case AgentActionType.RUN_SOURCE_CONNECTOR: {
        if (!action.entityId) throw new ValidationError("connector id required");
        const run = await sourceConnectorService.run(
          organizationId,
          action.entityId,
          userId,
          { count: 5 }
        );
        return { sourceRun: run };
      }

      case AgentActionType.SCORE_OPPORTUNITY: {
        if (!action.entityId) throw new ValidationError("opportunity id required");
        const score = await opportunityService.scoreOpportunity(
          organizationId,
          action.entityId
        );
        return { score };
      }

      case AgentActionType.RESEARCH_OPPORTUNITY:
      case AgentActionType.RECOMMEND_SERVICE:
      case AgentActionType.FIND_DECISION_MAKER: {
        if (!action.entityId) throw new ValidationError("opportunity id required");
        const research = await opportunityIntelligenceService.research(
          organizationId,
          action.entityId,
          userId
        );
        return {
          cached: "cached" in research ? research.cached : false,
          opportunityId: action.entityId,
          action: action.actionType,
        };
      }

      case AgentActionType.PRIORITIZE: {
        const ids = (input.opportunityIds as string[]) || [];
        return { prioritized: ids.slice(0, 10), count: ids.length };
      }

      case AgentActionType.CREATE_TASK: {
        if (!action.entityId) throw new ValidationError("opportunity id required");
        const task = await taskService.create(
          organizationId,
          {
            title: String(input.title || "Agent follow-up"),
            description: String(
              input.description || "Created by autonomous revenue agent"
            ),
            opportunityId: action.entityId,
          },
          userId
        );
        return { taskId: task.id };
      }

      case AgentActionType.DRAFT_OUTREACH: {
        return {
          draft: true,
          opportunityId: action.entityId,
          channels: input.channels || ["email"],
          note: "Draft prepared — SEND_OUTREACH still requires approval",
        };
      }

      case AgentActionType.SEND_OUTREACH: {
        const toEmail = String(input.toEmail || "");
        const subject = String(input.subject || "");
        const body = String(input.body || "");
        if (!toEmail || !subject || !body) {
          return {
            skipped: true,
            reason:
              "Approved but missing toEmail/subject/body — attach payload on approve or send from Inbox",
            opportunityId: action.entityId,
          };
        }
        const sent = await inboxService.sendOutreach({
          organizationId,
          userId,
          toEmail,
          subject,
          body,
          opportunityId: action.entityId,
          idempotencyKey: `agent-action:${action.idempotencyKey}`,
        });
        return { sent: true, conversationId: sent.conversationId ?? null };
      }

      case AgentActionType.PREPARE_PROPOSAL:
      case AgentActionType.SEND_PROPOSAL:
      case AgentActionType.BOOK_MEETING:
      case AgentActionType.CREATE_CAMPAIGN:
      case AgentActionType.CREATE_SEQUENCE:
      case AgentActionType.CHANGE_PRICE:
      case AgentActionType.CREATE_OPPORTUNITY:
      case AgentActionType.ENABLE_DATA_PROVIDER:
      case AgentActionType.EXPENSIVE_AI:
      case AgentActionType.UNUSUAL_VOLUME: {
        return {
          acknowledged: true,
          actionType: action.actionType,
          note: "Approval recorded — execute via product UI or attach execution payload",
          input,
        };
      }

      case AgentActionType.INTERNAL_RECOMMENDATION: {
        try {
          const plan = await aiRecommendationService.generateDailyPlan(
            organizationId,
            userId
          );
          return {
            recommendations: plan.recommendations.length,
            generatedAt: plan.generatedAt,
          };
        } catch (err) {
          return {
            recommendations: 0,
            note: err instanceof Error ? err.message : "no_plan",
          };
        }
      }

      case AgentActionType.LEARN: {
        try {
          const patterns = await learningService.discoverPatterns(organizationId);
          return {
            patterns: Array.isArray(patterns)
              ? patterns.length
              : (patterns as { patterns?: unknown[] })?.patterns?.length ?? 0,
            requiresApproval: true,
          };
        } catch (err) {
          return {
            skipped: true,
            note: err instanceof Error ? err.message : "learning_unavailable",
          };
        }
      }

      case AgentActionType.WATCH_REPLIES:
      case AgentActionType.SUGGEST_FOLLOW_UP:
      case AgentActionType.TRACK_DEAL:
      case AgentActionType.CLASSIFY:
      case AgentActionType.SUMMARIZE:
        return { ok: true, actionType: action.actionType, deferred: true };

      default:
        throw new ValidationError(`Unsupported action: ${action.actionType}`);
    }
  }
}

export const agentService = new AgentService();
