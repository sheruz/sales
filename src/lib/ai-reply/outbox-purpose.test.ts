import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  assertOutboxPurposeFields,
  sequenceOutboxUniqueKey,
} from "@/lib/ai-reply/outbox-guards";
import { enrollmentStepIdempotencyKey } from "@/lib/sequences/runtime";

describe("Phase 5 — email_outbox purpose CHECK (assertOutboxPurposeFields)", () => {
  it("SEQUENCE requires enrollmentId and stepOrder", () => {
    expect(
      assertOutboxPurposeFields({
        purpose: "SEQUENCE",
        enrollmentId: "en-1",
        stepOrder: 0,
        inboundMessageId: null,
      })
    ).toBe(true);
    expect(
      assertOutboxPurposeFields({
        purpose: "SEQUENCE",
        enrollmentId: null,
        stepOrder: 0,
        inboundMessageId: null,
      })
    ).toBe(false);
    expect(
      assertOutboxPurposeFields({
        purpose: "SEQUENCE",
        enrollmentId: "en-1",
        stepOrder: null,
        inboundMessageId: null,
      })
    ).toBe(false);
    // an inbound message id does not rescue a SEQUENCE row
    expect(
      assertOutboxPurposeFields({
        purpose: "SEQUENCE",
        enrollmentId: null,
        stepOrder: null,
        inboundMessageId: "msg-1",
      })
    ).toBe(false);
  });

  it("AI_REPLY requires inboundMessageId (enrollment/step stay null)", () => {
    expect(
      assertOutboxPurposeFields({
        purpose: "AI_REPLY",
        enrollmentId: null,
        stepOrder: null,
        inboundMessageId: "msg-1",
      })
    ).toBe(true);
    expect(
      assertOutboxPurposeFields({
        purpose: "AI_REPLY",
        enrollmentId: null,
        stepOrder: null,
        inboundMessageId: null,
      })
    ).toBe(false);
  });
});

describe("Phase 5 — sequence double-send unique key", () => {
  const seq = (enrollmentId: string, stepOrder: number) => ({
    purpose: "SEQUENCE" as const,
    enrollmentId,
    stepOrder,
    inboundMessageId: null,
  });

  it("uses `${enrollmentId}:${stepOrder}` as the composite unique key", () => {
    expect(sequenceOutboxUniqueKey(seq("en-1", 2))).toBe("en-1:2");
  });

  it("two SEQUENCE rows for the same enrollment+step collide", () => {
    const seen = new Set<string>();
    const first = sequenceOutboxUniqueKey(seq("en-1", 0))!;
    seen.add(first);
    expect(seen.has(sequenceOutboxUniqueKey(seq("en-1", 0))!)).toBe(true);
    expect(seen.has(sequenceOutboxUniqueKey(seq("en-1", 1))!)).toBe(false);
    expect(seen.has(sequenceOutboxUniqueKey(seq("en-2", 0))!)).toBe(false);
  });

  it("AI_REPLY rows never participate in the sequence unique key", () => {
    expect(
      sequenceOutboxUniqueKey({
        purpose: "AI_REPLY",
        enrollmentId: null,
        stepOrder: null,
        inboundMessageId: "msg-1",
      })
    ).toBeNull();
  });

  it("the Phase 4 idempotency key per enrollment step is unchanged", () => {
    expect(enrollmentStepIdempotencyKey("en-1", 0)).toBe("seq-enroll:en-1:step:0");
    expect(enrollmentStepIdempotencyKey("en-1", 1)).not.toBe(
      enrollmentStepIdempotencyKey("en-1", 0)
    );
  });
});

// ── Sequence stop on reply is still wired ───────────────────────────────────
const stopForContactReply = vi.fn().mockResolvedValue({ stopped: 1 });
const findFirst = vi.fn();

vi.mock("@/lib/db/prisma", () => ({
  default: {
    inboxConversation: { findFirst: (...a: unknown[]) => findFirst(...a) },
  },
}));

vi.mock("@/services/sequence-enrollment.service", () => ({
  sequenceEnrollmentService: {
    stopForContactReply: (...a: unknown[]) => stopForContactReply(...a),
  },
}));

describe("Phase 5 — sequence stop on reply", () => {
  beforeEach(() => {
    stopForContactReply.mockClear();
    findFirst.mockReset();
  });

  it("stopForContactReply is exposed by the sequence enrollment service", async () => {
    const { sequenceEnrollmentService } = await import(
      "@/services/sequence-enrollment.service"
    );
    expect(typeof sequenceEnrollmentService.stopForContactReply).toBe("function");
  });

  it("handleInbound still stops the sequence even if the AI pipeline throws", async () => {
    findFirst.mockRejectedValue(new Error("db down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { aiReplyService } = await import("@/services/ai-reply.service");

    const result = await aiReplyService.handleInbound({
      organizationId: "org-1",
      message: {
        id: "m-1",
        direction: "INBOUND",
        body: "Sounds interesting",
        subject: "Re: hi",
        fromEmail: "p@example.com",
      } as never,
      conversation: { id: "c-1", contactId: "contact-1" } as never,
    });

    expect(result.outcome).toBe("error");
    expect(stopForContactReply).toHaveBeenCalledWith("org-1", "contact-1");
  });
});
