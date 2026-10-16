import { env } from "@/lib/config/env";

type Ga4Event = {
  name: string;
  params?: Record<string, string | number | boolean>;
};

/**
 * Fire-and-forget GA4 Measurement Protocol.
 * No-ops when GA4_MEASUREMENT_ID / GA4_API_SECRET are unset.
 */
export async function sendGa4Event(input: {
  clientId: string;
  events: Ga4Event[];
}): Promise<{ ok: boolean; skipped?: boolean }> {
  const measurementId = env.GA4_MEASUREMENT_ID;
  const apiSecret = env.GA4_API_SECRET;
  if (!measurementId || !apiSecret) {
    return { ok: true, skipped: true };
  }

  try {
    const url = new URL("https://www.google-analytics.com/mp/collect");
    url.searchParams.set("measurement_id", measurementId);
    url.searchParams.set("api_secret", apiSecret);

    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: input.clientId,
        events: input.events.map((e) => ({
          name: e.name,
          params: {
            engagement_time_msec: 1,
            ...e.params,
          },
        })),
      }),
    });
    return { ok: res.ok };
  } catch (err) {
    console.warn(
      "[ga4-mp] send failed",
      err instanceof Error ? err.message : err
    );
    return { ok: false };
  }
}
