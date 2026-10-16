import { env } from "@/lib/config/env";

/** Cookie/Voyager SESSION mode — OFF by default (S1). OAuth is unaffected. */
export function isLinkedInSessionEnabled(): boolean {
  return env.LINKEDIN_SESSION_ENABLED === true;
}

export const LINKEDIN_SESSION_DISABLED_MESSAGE =
  "LinkedIn cookie/session mode is disabled. Connect LinkedIn with official OAuth in Settings → Integrations.";
