/**
 * Human-like AI reply send windows: random 10–40 min delay,
 * only Mon–Fri 08:00–19:00 in prospect timezone.
 */

export function randomJitterMinutes(min = 10, max = 40): number {
  const a = Math.min(min, max);
  const b = Math.max(min, max);
  return a + Math.floor(Math.random() * (b - a + 1));
}

/** Get wall-clock parts in a timezone. */
export function zonedParts(
  date: Date,
  timeZone: string
): { weekday: number; hour: number; minute: number; y: number; m: number; d: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timeZone || "UTC",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(date).map((p) => [p.type, p.value])
  );
  const wd: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    weekday: wd[parts.weekday || "Mon"] ?? 1,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    y: Number(parts.year),
    m: Number(parts.month),
    d: Number(parts.day),
  };
}

/**
 * Advance `from` by jitter, then snap forward into Mon-Fri 08:00-19:00 local.
 * Steps in 15-minute increments (up to ~9 days) so overnight / weekend sends
 * always land on the next open window instead of falling out of it.
 */
export function nextAiReplySendAt(
  from: Date,
  timeZone: string,
  jitterMinutes = randomJitterMinutes()
): Date {
  const tz = timeZone || "UTC";
  const STEP_MS = 15 * 60_000;
  const MAX_STEPS = 9 * 24 * 4;
  const open = 8 * 60;
  const close = 19 * 60;
  let candidate = new Date(from.getTime() + jitterMinutes * 60_000);

  for (let i = 0; i < MAX_STEPS; i++) {
    const p = zonedParts(candidate, tz);
    const mins = p.hour * 60 + p.minute;
    if (p.weekday >= 1 && p.weekday <= 5 && mins >= open && mins < close) {
      return candidate;
    }
    candidate = new Date(candidate.getTime() + STEP_MS);
  }

  return candidate;
}