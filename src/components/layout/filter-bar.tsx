"use client";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

/** Instant filters — labeled selects, no Apply button (R1 shell). */
export function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder = "Search…",
  children,
  className,
}: {
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3",
        className
      )}
    >
      {onSearchChange ? (
        <Input
          value={search ?? ""}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="h-9 max-w-xs"
        />
      ) : null}
      {children}
    </div>
  );
}

export function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-2 text-xs text-muted-foreground">
      <span className="whitespace-nowrap font-medium">{label}:</span>
      <select
        className="bg-transparent text-sm text-foreground outline-none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
