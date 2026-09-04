import { AgentActionType } from "@prisma/client";

/** Actions that may run automatically without human approval (initial policy). */
export const AUTO_ALLOW_ACTIONS: AgentActionType[] = [
  AgentActionType.READ_CONTEXT,
  AgentActionType.ENSURE_ICP,
  AgentActionType.SCORE_OPPORTUNITY,
  AgentActionType.RESEARCH_OPPORTUNITY,
  AgentActionType.RECOMMEND_SERVICE,
  AgentActionType.FIND_DECISION_MAKER,
  AgentActionType.WATCH_REPLIES,
  AgentActionType.SUGGEST_FOLLOW_UP,
  AgentActionType.TRACK_DEAL,
  AgentActionType.MEASURE_REVENUE,
  AgentActionType.LEARN,
  AgentActionType.CREATE_TASK,
  AgentActionType.INTERNAL_RECOMMENDATION,
  AgentActionType.PRIORITIZE,
  AgentActionType.CLASSIFY,
  AgentActionType.SUMMARIZE,
  AgentActionType.DRAFT_OUTREACH,
];

/** Actions that always require human approval (initial policy). */
export const REQUIRE_APPROVAL_ACTIONS: AgentActionType[] = [
  AgentActionType.CREATE_CAMPAIGN,
  AgentActionType.CREATE_SEQUENCE,
  AgentActionType.SEND_OUTREACH,
  AgentActionType.SEND_PROPOSAL,
  AgentActionType.BOOK_MEETING,
  AgentActionType.PREPARE_PROPOSAL,
  AgentActionType.CHANGE_PRICE,
  AgentActionType.CREATE_OPPORTUNITY,
  AgentActionType.RUN_SOURCE_CONNECTOR,
  AgentActionType.ENABLE_DATA_PROVIDER,
  AgentActionType.EXPENSIVE_AI,
  AgentActionType.UNUSUAL_VOLUME,
];

export type ApprovalPolicy = {
  requireApproval: AgentActionType[];
  autoAllow: AgentActionType[];
};

export const DEFAULT_APPROVAL_POLICY: ApprovalPolicy = {
  requireApproval: [...REQUIRE_APPROVAL_ACTIONS],
  autoAllow: [...AUTO_ALLOW_ACTIONS],
};

export const DEFAULT_ALLOWED_CHANNELS = ["email"] as const;

export const DEFAULT_ALLOWED_ACTIONS: AgentActionType[] = [
  ...AUTO_ALLOW_ACTIONS,
  ...REQUIRE_APPROVAL_ACTIONS,
];

export function actionRequiresApproval(
  actionType: AgentActionType,
  policy: ApprovalPolicy = DEFAULT_APPROVAL_POLICY
): boolean {
  if (policy.requireApproval.includes(actionType)) return true;
  if (policy.autoAllow.includes(actionType)) return false;
  // Fail closed: unknown / unlisted actions need approval
  return true;
}

export function isActionAllowed(
  actionType: AgentActionType,
  allowedActions: string[]
): boolean {
  if (!allowedActions.length) return true;
  return allowedActions.includes(actionType);
}
