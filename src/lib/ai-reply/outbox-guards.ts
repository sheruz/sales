/**
 * Mirrors the DB CHECK `email_outbox_purpose_fields_check`:
 *   (purpose = 'SEQUENCE' AND enrollment_id IS NOT NULL AND step_order IS NOT NULL)
 *   OR (purpose = 'AI_REPLY' AND inbound_message_id IS NOT NULL)
 *
 * Phase 4 keeps `@@unique([enrollmentId, stepOrder])` — a SEQUENCE step can only
 * ever be queued once per enrollment. AI_REPLY rows have null enrollment/step
 * (Postgres treats NULLs as distinct) and are deduped by inboundMessageId instead.
 */
export type OutboxPurposeRow = {
  purpose: "SEQUENCE" | "AI_REPLY";
  enrollmentId: string | null;
  stepOrder: number | null;
  inboundMessageId: string | null;
};

export function assertOutboxPurposeFields(row: OutboxPurposeRow): boolean {
  if (row.purpose === "SEQUENCE") {
    return row.enrollmentId != null && row.stepOrder != null;
  }
  if (row.purpose === "AI_REPLY") {
    return row.inboundMessageId != null;
  }
  return false;
}

/** Composite unique key string for `@@unique([enrollmentId, stepOrder])`; null for AI_REPLY rows. */
export function sequenceOutboxUniqueKey(row: OutboxPurposeRow): string | null {
  if (row.purpose !== "SEQUENCE") return null;
  if (row.enrollmentId == null || row.stepOrder == null) return null;
  return `${row.enrollmentId}:${row.stepOrder}`;
}
