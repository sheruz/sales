/**
 * ICP-style Google Places sourcing for "US Nonprofits $250k-$5M".
 * Same call the app uses: Places Text Search (New), business type × region.
 * Appends new places to the public sheet. Skips place IDs and website
 * domains already on the sheet.
 *
 * Places does not return revenue, headcount, or job titles, so the
 * $250k-$5M / decision-maker filters cannot be applied here.
 *
 * Usage (PowerShell):
 *   $env:GOOGLE_PLACES_API_KEY="..."
 *   $env:GOOGLE_SHEETS_TOKEN="..."   # OAuth access token with spreadsheets scope
 *   node scripts/icp-us-nonprofits-to-sheet.mjs
 *
 * Optional: $env:MAX_PAGES="1"   (1–3, default 1)
 */
const SHEET_ID = "1Lska2f3Sioku0CRC2pKhRM5NDAfEza16pCOrg02TPeQ";
const PLACES_URL = "https://places.googleapis.com/v1/places:searchText";
const FIELD_MASK = [
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

const INDUSTRIES = [
  "Charity",
  "Community Organization",
  "Food Bank",
  "Youth Organization",
  "Education Nonprofit",
  "Health Nonprofit",
  "Social Services",
  "Arts and Culture",
  "Animal Welfare",
  "Environmental Nonprofit",
  "Religious Organization",
  "Islamic Center",
  "Church",
  "Faith-based Charity",
  "Immigrant Services",
  "Housing Nonprofit",
];

const REGIONS = [
  "Alabama",
  "Alaska",
  "Arizona",
  "Arkansas",
  "California",
  "Colorado",
  "Connecticut",
  "Delaware",
  "District of Columbia",
  "Florida",
  "Georgia",
  "Hawaii",
  "Idaho",
  "Illinois",
  "Indiana",
  "Iowa",
  "Kansas",
  "Kentucky",
  "Louisiana",
  "Maine",
  "Maryland",
  "Massachusetts",
  "Michigan",
  "Minnesota",
  "Mississippi",
  "Missouri",
  "Montana",
  "Nebraska",
  "Nevada",
  "New Hampshire",
  "New Jersey",
  "New Mexico",
  "New York",
  "North Carolina",
  "North Dakota",
  "Ohio",
  "Oklahoma",
  "Oregon",
  "Pennsylvania",
  "Rhode Island",
  "South Carolina",
  "South Dakota",
  "Tennessee",
  "Texas",
  "Utah",
  "Vermont",
  "Virginia",
  "Washington",
  "West Virginia",
  "Wisconsin",
  "Wyoming",
];

const EXCLUDED_TYPES = new Set([
  "hospital",
  "university",
  "local_government_office",
  "city_hall",
  "courthouse",
  "embassy",
  "government_office",
]);

const EXCLUDED_NAME =
  /\b(hospital|medical center|university|college|city hall|county of|state of)\b/i;

const HEADERS = [
  "created_at",
  "company_name",
  "website",
  "company_phone",
  "address",
  "city",
  "state_province",
  "country",
  "industry",
  "source",
  "rating",
  "google_place_id",
  "search_query",
];

const placesKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
const sheetsToken = process.env.GOOGLE_SHEETS_TOKEN?.trim();
const maxPages = Math.min(
  3,
  Math.max(1, Number(process.env.MAX_PAGES || 1) || 1)
);

if (!placesKey || !sheetsToken) {
  console.error(
    "Set GOOGLE_PLACES_API_KEY and GOOGLE_SHEETS_TOKEN, then run again."
  );
  process.exit(1);
}

function domainOf(website) {
  if (!website) return "";
  try {
    const raw = website.includes("://") ? website : `https://${website}`;
    return new URL(raw).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function parseUsAddress(address) {
  if (!address) return { city: "", state: "" };
  const parts = address.split(",").map((p) => p.trim());
  let state = "";
  let stateIdx = -1;
  for (let i = 0; i < parts.length; i++) {
    const match = parts[i].match(/^([A-Z]{2})(?:\s+\d{5}(?:-\d{4})?)?$/);
    if (match) {
      state = match[1];
      stateIdx = i;
      break;
    }
  }
  const city = stateIdx > 0 ? parts[stateIdx - 1] : "";
  return { city, state };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sheets(path, options = {}) {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}${path}`,
    {
      ...options,
      headers: {
        Authorization: `Bearer ${sheetsToken}`,
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    }
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      json.error?.message || `Google Sheets failed (${res.status})`
    );
  }
  return json;
}

async function textSearch(textQuery, pageToken) {
  const body = { textQuery, pageSize: 20 };
  if (pageToken) body.pageToken = pageToken;
  const res = await fetch(PLACES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": placesKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      json.error?.message || `Places Text Search failed (${res.status})`
    );
  }
  return json;
}

function mapPlace(raw) {
  const id = typeof raw.id === "string" ? raw.id : "";
  const name = raw.displayName?.text?.trim() || "";
  if (!id || !name) return null;
  const placeId = id.startsWith("places/") ? id.slice("places/".length) : id;
  const types = Array.isArray(raw.types) ? raw.types : [];
  return {
    placeId,
    name,
    website: typeof raw.websiteUri === "string" ? raw.websiteUri : "",
    phone:
      raw.nationalPhoneNumber || raw.internationalPhoneNumber || "",
    address: typeof raw.formattedAddress === "string" ? raw.formattedAddress : "",
    rating: typeof raw.rating === "number" ? String(raw.rating) : "",
    types,
  };
}

async function main() {
  const searches = INDUSTRIES.length * REGIONS.length;
  console.log(
    `ICP US Nonprofits: ${INDUSTRIES.length} industries × ${REGIONS.length} regions = ${searches} searches, up to ${maxPages} page(s) each.`
  );
  console.log(
    "About $35 per 1,000 Places Text Search calls. A monthly Google Maps credit often covers the first run at 1 page."
  );

  const meta = await sheets("?fields=sheets.properties.title");
  const title = meta.sheets?.[0]?.properties?.title || "Sheet1";
  const range = encodeURIComponent(`${title}!A:Z`);
  const existing = await sheets(`/values/${range}`);
  const grid = existing.values || [];

  const seenPlaces = new Set();
  const seenDomains = new Set();
  let headers = HEADERS;
  let headerRow = false;

  if (grid.length && grid[0].some((cell) => String(cell).trim())) {
    headers = grid[0].map((cell) => String(cell).trim());
    headerRow = true;
    const idCol = headers.indexOf("google_place_id");
    const webCol = headers.indexOf("website");
    for (const row of grid.slice(1)) {
      if (idCol >= 0 && row[idCol]) seenPlaces.add(String(row[idCol]).trim());
      const domain = domainOf(webCol >= 0 ? row[webCol] : "");
      if (domain) seenDomains.add(domain);
    }
  }

  console.log(
    `Sheet "${title}" already has ${seenPlaces.size} place ids and ${seenDomains.size} domains. Those will be skipped.`
  );

  const pending = [];
  let calls = 0;
  let skipped = 0;
  let excluded = 0;
  let index = 0;

  for (const industry of INDUSTRIES) {
    for (const region of REGIONS) {
      index += 1;
      const textQuery = `${industry} in ${region}, United States`;
      let pageToken = null;
      for (let page = 0; page < maxPages; page++) {
        if (pageToken) await sleep(2000);
        const json = await textSearch(textQuery, pageToken);
        calls += 1;
        const places = (json.places || [])
          .map(mapPlace)
          .filter(Boolean);
        for (const place of places) {
          if (place.types.some((t) => EXCLUDED_TYPES.has(t))) {
            excluded += 1;
            continue;
          }
          if (EXCLUDED_NAME.test(place.name)) {
            excluded += 1;
            continue;
          }
          const domain = domainOf(place.website);
          if (seenPlaces.has(place.placeId) || (domain && seenDomains.has(domain))) {
            skipped += 1;
            continue;
          }
          seenPlaces.add(place.placeId);
          if (domain) seenDomains.add(domain);
          const geo = parseUsAddress(place.address);
          const record = {
            created_at: new Date().toISOString(),
            company_name: place.name,
            website: place.website,
            company_phone: place.phone,
            address: place.address,
            city: geo.city,
            state_province: geo.state,
            country: "United States",
            industry,
            source: "google_places",
            rating: place.rating,
            google_place_id: place.placeId,
            search_query: textQuery,
            notes: textQuery,
          };
          pending.push(headers.map((h) => record[h] ?? ""));
        }
        pageToken = json.nextPageToken || null;
        if (!pageToken) break;
      }
      if (index % 25 === 0 || index === searches) {
        console.log(
          `${index}/${searches} ${textQuery} · new ${pending.length} · skipped ${skipped} · excluded ${excluded} · calls ${calls}`
        );
      }
      await sleep(200);
    }
  }

  if (!pending.length) {
    console.log("No new places to add.");
    return;
  }

  if (!headerRow) {
    await sheets(
      `/values/${encodeURIComponent(`${title}!A1`)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      { method: "POST", body: JSON.stringify({ values: [HEADERS] }) }
    );
  }

  for (let i = 0; i < pending.length; i += 200) {
    const chunk = pending.slice(i, i + 200);
    await sheets(
      `/values/${encodeURIComponent(`${title}!A1`)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      { method: "POST", body: JSON.stringify({ values: chunk }) }
    );
    console.log(`Wrote ${Math.min(i + chunk.length, pending.length)}/${pending.length}`);
  }

  console.log(
    `Done. Added ${pending.length} leads. Skipped ${skipped} already on the sheet. Excluded ${excluded}. Places calls: ${calls}.`
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
