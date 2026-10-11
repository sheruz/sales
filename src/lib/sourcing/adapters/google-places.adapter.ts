/** Field mask for Places API (New) Text Search — keep costs low. */
export const PLACES_TEXT_SEARCH_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.websiteUri",
  "places.rating",
  "places.types",
  "places.location",
  "nextPageToken",
].join(",");

export type GooglePlaceResult = {
  googlePlaceId: string;
  name: string;
  website: string | null;
  phone: string | null;
  address: string | null;
  rating: number | null;
  types: string[];
  lat: number | null;
  lng: number | null;
};

export type TextSearchResponse = {
  places: GooglePlaceResult[];
  nextPageToken: string | null;
  rawStatus: number;
};

export interface GooglePlacesAdapter {
  textSearch(input: {
    apiKey: string;
    textQuery: string;
    pageToken?: string | null;
  }): Promise<TextSearchResponse>;
}

function mapPlace(raw: Record<string, unknown>): GooglePlaceResult | null {
  const id = typeof raw.id === "string" ? raw.id : null;
  const displayName = raw.displayName as { text?: string } | undefined;
  const name = displayName?.text?.trim();
  if (!id || !name) return null;

  const location = raw.location as { latitude?: number; longitude?: number } | undefined;

  return {
    googlePlaceId: id.startsWith("places/") ? id.slice("places/".length) : id,
    name,
    website: typeof raw.websiteUri === "string" ? raw.websiteUri : null,
    phone:
      (typeof raw.nationalPhoneNumber === "string"
        ? raw.nationalPhoneNumber
        : null) ||
      (typeof raw.internationalPhoneNumber === "string"
        ? raw.internationalPhoneNumber
        : null),
    address:
      typeof raw.formattedAddress === "string" ? raw.formattedAddress : null,
    rating: typeof raw.rating === "number" ? raw.rating : null,
    types: Array.isArray(raw.types)
      ? raw.types.filter((t): t is string => typeof t === "string")
      : [],
    lat: typeof location?.latitude === "number" ? location.latitude : null,
    lng: typeof location?.longitude === "number" ? location.longitude : null,
  };
}

export class GooglePlacesApiAdapter implements GooglePlacesAdapter {
  async textSearch(input: {
    apiKey: string;
    textQuery: string;
    pageToken?: string | null;
  }): Promise<TextSearchResponse> {
    const body: Record<string, unknown> = {
      textQuery: input.textQuery,
      pageSize: 20,
    };
    if (input.pageToken) body.pageToken = input.pageToken;

    const res = await fetch(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": input.apiKey,
          "X-Goog-FieldMask": PLACES_TEXT_SEARCH_FIELD_MASK,
        },
        body: JSON.stringify(body),
      }
    );

    const json = (await res.json().catch(() => ({}))) as {
      places?: Record<string, unknown>[];
      nextPageToken?: string;
      error?: { message?: string };
    };

    if (!res.ok) {
      throw new Error(
        json.error?.message || `Google Places Text Search failed (${res.status})`
      );
    }

    const places = (json.places ?? [])
      .map(mapPlace)
      .filter((p): p is GooglePlaceResult => Boolean(p));

    return {
      places,
      nextPageToken: json.nextPageToken ?? null,
      rawStatus: res.status,
    };
  }
}

export const googlePlacesAdapter = new GooglePlacesApiAdapter();
