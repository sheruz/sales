/**
 * Approximate Google Places API (New) pricing for spend visibility.
 * Update if Google changes list prices — estimates only, not invoices.
 * @see https://developers.google.com/maps/billing-and-pricing/pricing
 */
export const GOOGLE_PLACES_COST_USD = {
  /** Text Search (IDs Only) Pro — used with field mask for Essentials-ish fields */
  textSearchPerRequest: 0.032,
} as const;

export function estimateTextSearchCostUsd(units = 1): number {
  return Number(
    (GOOGLE_PLACES_COST_USD.textSearchPerRequest * Math.max(1, units)).toFixed(
      6
    )
  );
}
