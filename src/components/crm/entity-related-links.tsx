import Link from "next/link";
import { Button } from "@/components/ui/button";

export type RelatedLink = {
  href: string;
  label: string;
};

/** Compact strip of related-entity navigation links. */
export function EntityRelatedLinks({ links }: { links: RelatedLink[] }) {
  if (!links.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {links.map((l) => (
        <Link key={`${l.href}-${l.label}`} href={l.href}>
          <Button variant="outline" size="sm">
            {l.label}
          </Button>
        </Link>
      ))}
    </div>
  );
}
