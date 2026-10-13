import { cn } from "@/lib/utils";

/** R1 table chrome — sticky header, hover, pagination footer. Wire columns in R2. */
export function DataTableShell({
  children,
  footer,
  className,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card",
        className
      )}
    >
      <div className="overflow-x-auto">{children}</div>
      {footer ? (
        <div className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

export function dataTableHeaderClassName() {
  return "sticky top-0 z-[1] bg-muted/80 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur";
}

export function dataTableRowClassName() {
  return "border-t border-border hover:bg-muted/40 transition-colors";
}
