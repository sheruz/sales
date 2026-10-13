"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export type AppTab = {
  label: string;
  href: string;
  /** Match query ?tab= */
  tab?: string;
};

/** Underline-style tabs matching Delvix reference. */
export function AppTabs({
  tabs,
  className,
}: {
  tabs: AppTab[];
  className?: string;
}) {
  const pathname = usePathname();
  const search = useSearchParams();
  const currentTab = search.get("tab");

  return (
    <div
      className={cn(
        "flex gap-1 border-b border-border overflow-x-auto",
        className
      )}
    >
      {tabs.map((t) => {
        const active = t.tab
          ? currentTab === t.tab ||
            (!currentTab && t.tab === tabs[0]?.tab)
          : pathname === t.href || pathname.startsWith(`${t.href}/`);
        return (
          <Link
            key={t.href + (t.tab ?? "")}
            href={t.href}
            className={cn(
              "shrink-0 px-3 py-2 text-sm font-medium text-muted-foreground border-b-2 border-transparent -mb-px transition-colors",
              active && "text-foreground border-primary"
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
