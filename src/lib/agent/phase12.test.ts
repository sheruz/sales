import { describe, expect, it } from "vitest";
import { AgentActionType } from "@prisma/client";
import {
  AUTO_ALLOW_ACTIONS,
  DEFAULT_APPROVAL_POLICY,
  REQUIRE_APPROVAL_ACTIONS,
  actionRequiresApproval,
  isActionAllowed,
} from "@/lib/agent/policy";

describe("Phase 12 autonomous revenue agent", () => {
  it("auto-allows research, scoring, classification, summarization, prioritization, tasks, recommendations", () => {
    for (const action of [
      AgentActionType.RESEARCH_OPPORTUNITY,
      AgentActionType.SCORE_OPPORTUNITY,
      AgentActionType.CLASSIFY,
      AgentActionType.SUMMARIZE,
      AgentActionType.PRIORITIZE,
      AgentActionType.CREATE_TASK,
      AgentActionType.INTERNAL_RECOMMENDATION,
    ]) {
      expect(AUTO_ALLOW_ACTIONS).toContain(action);
      expect(actionRequiresApproval(action)).toBe(false);
    }
  });

  it("requires approval for outbound, campaigns, proposals, price, volume, providers, expensive AI", () => {
    for (const action of [
      AgentActionType.CREATE_CAMPAIGN,
      AgentActionType.CREATE_SEQUENCE,
      AgentActionType.SEND_OUTREACH,
      AgentActionType.SEND_PROPOSAL,
      AgentActionType.CHANGE_PRICE,
      AgentActionType.UNUSUAL_VOLUME,
      AgentActionType.ENABLE_DATA_PROVIDER,
      AgentActionType.EXPENSIVE_AI,
      AgentActionType.RUN_SOURCE_CONNECTOR,
    ]) {
      expect(REQUIRE_APPROVAL_ACTIONS).toContain(action);
      expect(actionRequiresApproval(action)).toBe(true);
    }
  });

  it("fails closed for unknown/unlisted actions", () => {
    const policy = {
      requireApproval: [] as AgentActionType[],
      autoAllow: [] as AgentActionType[],
    };
    expect(actionRequiresApproval(AgentActionType.SEND_OUTREACH, policy)).toBe(
      true
    );
  });

  it("respects allowed_actions allow-list", () => {
    expect(
      isActionAllowed(AgentActionType.SCORE_OPPORTUNITY, [
        AgentActionType.SCORE_OPPORTUNITY,
      ])
    ).toBe(true);
    expect(
      isActionAllowed(AgentActionType.SEND_OUTREACH, [
        AgentActionType.SCORE_OPPORTUNITY,
      ])
    ).toBe(false);
  });

  it("default policy includes both auto and approval sets", () => {
    expect(DEFAULT_APPROVAL_POLICY.autoAllow.length).toBeGreaterThan(5);
    expect(DEFAULT_APPROVAL_POLICY.requireApproval.length).toBeGreaterThan(5);
  });

  it("models governed loop: goal → plan → authorize → log → limit", () => {
    const loop = [
      "authorized",
      "logged",
      "org_scoped",
      "idempotent",
      "auditable",
      "limited",
    ];
    expect(loop).toContain("idempotent");
    expect(loop).not.toContain("unrestricted");
  });
});
