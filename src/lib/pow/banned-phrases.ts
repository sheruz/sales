/**
 * Flattery / soft openers banned in PoW emails (code-enforced).
 * Matched case-insensitively as whole phrases.
 */
export const POW_BANNED_PHRASES = [
  "impressive",
  "we were impressed",
  "i was impressed",
  "i came across",
  "i stumbled upon",
  "i noticed your amazing",
  "great work",
  "love what you're doing",
  "love what you are doing",
  "congratulations on",
  "kudos",
  "hi there",
  "hope this finds you well",
  "just reaching out",
  "wanted to touch base",
  "synergy",
] as const;

export function findBannedPhrases(text: string): string[] {
  const lower = text.toLowerCase();
  const hits: string[] = [];
  for (const phrase of POW_BANNED_PHRASES) {
    if (lower.includes(phrase.toLowerCase())) {
      hits.push(phrase);
    }
  }
  return hits;
}
