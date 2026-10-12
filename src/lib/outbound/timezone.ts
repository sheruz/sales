/**
 * IANA timezone derivation for outbound send windows.
 * Never guess when uncertain — return null so the send is HELD.
 */

import { find as findTz } from "geo-tz";

const COUNTRY_DEFAULT_TZ: Record<string, string> = {
  US: "America/Chicago",
  USA: "America/Chicago",
  "UNITED STATES": "America/Chicago",
  "UNITED STATES OF AMERICA": "America/Chicago",
  CA: "America/Toronto",
  CANADA: "America/Toronto",
  GB: "Europe/London",
  UK: "Europe/London",
  "UNITED KINGDOM": "Europe/London",
  AU: "Australia/Sydney",
  AUSTRALIA: "Australia/Sydney",
};

/** Valid IANA-ish check (Area/Location). */
export function isValidIanaTimezone(tz: string | null | undefined): boolean {
  if (!tz?.trim()) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz.trim() });
    return true;
  } catch {
    return false;
  }
}

export function timezoneFromLatLng(
  lat: number | null | undefined,
  lng: number | null | undefined
): string | null {
  if (
    lat == null ||
    lng == null ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return null;
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  try {
    const zones = findTz(lat, lng);
    const tz = zones[0] ?? null;
    return isValidIanaTimezone(tz) ? tz : null;
  } catch {
    return null;
  }
}

/**
 * Prefer lat/lng. Do not use country default for send decisions —
 * country default is only for soft backfill hints, returned separately.
 */
export function deriveCompanyTimezone(input: {
  lat?: number | null;
  lng?: number | null;
  country?: string | null;
}): { timezone: string | null; from: "latlng" | "none" } {
  const fromLat = timezoneFromLatLng(input.lat, input.lng);
  if (fromLat) return { timezone: fromLat, from: "latlng" };
  return { timezone: null, from: "none" };
}

/** Soft hint only — never use for send window when lat/lng missing. */
export function countryTimezoneHint(country: string | null | undefined): string | null {
  if (!country?.trim()) return null;
  const key = country.trim().toUpperCase();
  const tz = COUNTRY_DEFAULT_TZ[key] ?? null;
  return isValidIanaTimezone(tz) ? tz : null;
}

/**
 * Next Mon–Fri 08:00–11:00 slot in prospect TZ, returned as UTC Date.
 * Random minute offset within the window for natural spacing.
 * Returns null if timezone invalid.
 */
export function nextSendWindowUtc(
  timezone: string,
  from: Date = new Date(),
  opts?: { preferImmediate?: boolean }
): Date | null {
  if (!isValidIanaTimezone(timezone)) return null;

  // Walk up to 14 days looking for Mon–Fri 8–11 local
  for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
    const probe = new Date(from.getTime() + dayOffset * 86_400_000);
    const localParts = getTzParts(probe, timezone);
    if (!localParts) continue;
    const dow = localParts.weekday; // 1=Mon … 7=Sun (ISO)
    if (dow > 5) continue; // Sat/Sun

    const hour = localParts.hour;
    const inWindow = hour >= 8 && hour < 11;

    if (dayOffset === 0 && inWindow && opts?.preferImmediate !== false) {
      // Schedule a few minutes from now within remaining window
      const gapMs = (2 + Math.floor(Math.random() * 5)) * 60_000; // 2–6 min
      const candidate = new Date(from.getTime() + gapMs);
      const cParts = getTzParts(candidate, timezone);
      if (cParts && cParts.weekday <= 5 && cParts.hour >= 8 && cParts.hour < 11) {
        return candidate;
      }
    }

    if (dayOffset === 0 && hour >= 11) continue; // today's window passed

    // Build 08:00 + random 0–179 minutes in that local day
    const localYmd = `${localParts.year}-${pad(localParts.month)}-${pad(localParts.day)}`;
    const randomMin = Math.floor(Math.random() * 180); // 0–179 → 08:00–10:59
    const hh = 8 + Math.floor(randomMin / 60);
    const mm = randomMin % 60;
    const utc = zonedTimeToUtc(
      `${localYmd}T${pad(hh)}:${pad(mm)}:00`,
      timezone
    );
    if (utc && utc.getTime() >= from.getTime()) return utc;
  }
  return null;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function getTzParts(date: Date, timeZone: string) {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      hourCycle: "h23",
    });
    const parts = Object.fromEntries(
      fmt.formatToParts(date).map((p) => [p.type, p.value])
    );
    const weekdayMap: Record<string, number> = {
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
      Sun: 7,
    };
    return {
      year: Number(parts.year),
      month: Number(parts.month),
      day: Number(parts.day),
      hour: Number(parts.hour),
      minute: Number(parts.minute),
      weekday: weekdayMap[parts.weekday ?? ""] ?? 0,
    };
  } catch {
    return null;
  }
}

/** Parse local wall time in a timezone → UTC Date (approximation via iterative offset). */
function zonedTimeToUtc(localIso: string, timeZone: string): Date | null {
  const asUtc = new Date(`${localIso}Z`);
  if (Number.isNaN(asUtc.getTime())) return null;
  const parts = getTzParts(asUtc, timeZone);
  if (!parts) return null;
  const wanted = new Date(`${localIso}Z`);
  // Adjust by difference between intended local and what TZ shows for that instant
  const shown = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute
  );
  const intended = Date.UTC(
    wanted.getUTCFullYear(),
    wanted.getUTCMonth(),
    wanted.getUTCDate(),
    wanted.getUTCHours(),
    wanted.getUTCMinutes()
  );
  const diff = intended - shown;
  return new Date(asUtc.getTime() + diff);
}
