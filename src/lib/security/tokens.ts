import { createHash } from "crypto";

/** Hash opaque tokens (sessions, etc.) before DB storage / lookup */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
