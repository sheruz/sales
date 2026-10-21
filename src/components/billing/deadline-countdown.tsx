"use client";

import { useEffect, useState } from "react";
import { formatCountdown } from "@/lib/billing/countdown";

export function DeadlineCountdown({
  deadlineAt,
  className,
}: {
  deadlineAt: string;
  className?: string;
}) {
  const [label, setLabel] = useState(() => formatCountdown(deadlineAt).label);

  useEffect(() => {
    const tick = () => setLabel(formatCountdown(deadlineAt).label);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadlineAt]);

  return (
    <span className={className} data-countdown>
      {label}
    </span>
  );
}
