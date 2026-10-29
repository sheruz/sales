import { mainNav } from "@/content/navigation";

export type NavMeta = { title: string; description: string; group: string };

/** Look up a nav link's title/description/section heading by href. */
export function getNavMeta(href: string): NavMeta | undefined {
  for (const top of mainNav) {
    for (const section of top.sections ?? []) {
      for (const link of section.links) {
        if (link.href === href) {
          return {
            title: link.title,
            description: link.description,
            group: section.heading,
          };
        }
      }
    }
  }
  return undefined;
}

/** First sentence of a paragraph, for short card copy. */
export function firstSentence(text: string): string {
  const match = text.match(/^.*?[.!?](?=\s|$)/);
  return (match ? match[0] : text).trim();
}
