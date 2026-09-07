/**
 * Helpers for inbound inbox sync (Gmail/Outlook) — pure functions for tests.
 */

export function normalizeMessageId(id: string | null | undefined): string | null {
  if (!id) return null;
  const trimmed = id.trim();
  if (!trimmed) return null;
  return trimmed.replace(/^<|>$/g, "").toLowerCase();
}

export function extractEmailAddress(raw: string | null | undefined): string {
  if (!raw) return "";
  const match = raw.match(/<([^>]+)>/);
  return (match?.[1] || raw).trim().toLowerCase();
}

export function parseMessageIdList(header: string | null | undefined): string[] {
  if (!header?.trim()) return [];
  return header
    .split(/\s+/)
    .map((part) => normalizeMessageId(part))
    .filter((id): id is string => Boolean(id));
}

/** Contact lookup where clause — never require Lead. */
export function contactEmailMatchWhere(
  organizationId: string,
  fromEmail: string
): {
  organizationId: string;
  OR: Array<
    | { email: { equals: string; mode: "insensitive" } }
    | { normalizedEmail: string }
  >;
} {
  const from = fromEmail.trim().toLowerCase();
  return {
    organizationId,
    OR: [
      { email: { equals: from, mode: "insensitive" } },
      { normalizedEmail: from },
    ],
  };
}

/**
 * Recursively extract text/plain and text/html from Gmail payload parts.
 */
export function extractGmailBodies(payload: {
  mimeType?: string;
  body?: { data?: string };
  parts?: Array<{
    mimeType?: string;
    body?: { data?: string };
    parts?: unknown[];
  }>;
} | null | undefined): { text: string | null; html: string | null } {
  let text: string | null = null;
  let html: string | null = null;

  function decode(data?: string) {
    if (!data) return null;
    try {
      return Buffer.from(
        data.replace(/-/g, "+").replace(/_/g, "/"),
        "base64"
      ).toString("utf8");
    } catch {
      return null;
    }
  }

  function walk(part: {
    mimeType?: string;
    body?: { data?: string };
    parts?: Array<{
      mimeType?: string;
      body?: { data?: string };
      parts?: unknown[];
    }>;
  } | null | undefined) {
    if (!part) return;
    const mime = (part.mimeType || "").toLowerCase();
    if (mime === "text/plain" && part.body?.data && !text) {
      text = decode(part.body.data);
    }
    if (mime === "text/html" && part.body?.data && !html) {
      html = decode(part.body.data);
    }
    if (Array.isArray(part.parts)) {
      for (const child of part.parts) {
        walk(child as typeof part);
      }
    }
  }

  walk(payload);
  if (!text && !html && payload?.body?.data) {
    text = decode(payload.body.data);
  }
  return { text, html };
}

export function summarizeSyncResults(
  results: Array<{
    synced?: number;
    total?: number;
    error?: string;
    accountId?: string;
  }>,
  meta: { smtpAccountsSkipped?: number; oauthAccountCount: number }
): {
  synced: number;
  fetched: number;
  errors: number;
  warning: string | null;
  successMessage: string;
} {
  const synced = results.reduce((n, r) => n + (r.synced ?? 0), 0);
  const fetched = results.reduce((n, r) => n + (r.total ?? 0), 0);
  const errors = results.filter((r) => r.error).length;

  if (meta.oauthAccountCount === 0) {
    const warning =
      (meta.smtpAccountsSkipped ?? 0) > 0
        ? "SMTP is outbound-only. Connect Gmail or Outlook (OAuth) in Settings → Integrations to sync inbound replies."
        : "No Gmail or Outlook account connected. Connect one in Settings → Integrations to sync inbox.";
    return {
      synced: 0,
      fetched: 0,
      errors: 0,
      warning,
      successMessage: warning,
    };
  }

  if (errors && synced === 0) {
    return {
      synced,
      fetched,
      errors,
      warning: "Inbox sync failed for one or more accounts. Check Integrations.",
      successMessage: "Inbox sync completed with errors",
    };
  }

  return {
    synced,
    fetched,
    errors,
    warning: null,
    successMessage:
      synced > 0
        ? `Imported ${synced} new message(s)`
        : "Inbox synced — no new messages",
  };
}
