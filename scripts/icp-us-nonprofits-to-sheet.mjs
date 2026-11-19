/**
 * ICP-style Google Places sourcing for "US Nonprofits $250k-$5M".
 * Same call the app uses: Places Text Search (New), business type × region.
 * Writes a CSV on this server. Skips place IDs and website domains already
 * in that file, so a second run does not copy old leads.
 *
 * Places does not return revenue, headcount, or job titles, so the
 * $250k-$5M / decision-maker filters cannot be applied here.
 *
 * Usage (from the project folder):
 *   node scripts/icp-us-nonprofits-to-sheet.mjs
 *
 * Optional: MAX_PAGES=1   (1–3, default 1)
 *
 * Download: storage/exports/us-nonprofits-250k-5m.csv
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT_FILE = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "storage",
  "exports",
  "us-nonprofits-250k-5m.csv"
);
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

const placesKey = "AIzaSyAcvYgV974NfBIRawyCJd4Q0w2LNvEAtZk";
const maxPages = Math.min(
  3,
  Math.max(1, Number(process.env.MAX_PAGES || 1) || 1)
);

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

function csvEscape(value) {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") {
      cell += ch;
    }
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
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
    phone: raw.nationalPhoneNumber || raw.internationalPhoneNumber || "",
    address:
      typeof raw.formattedAddress === "string" ? raw.formattedAddress : "",
    rating: typeof raw.rating === "number" ? String(raw.rating) : "",
    types,
  };
}

function loadExisting() {
  const seenPlaces = new Set();
  const seenDomains = new Set();
  if (!existsSync(OUT_FILE)) return { seenPlaces, seenDomains, hasHeader: false };
  const grid = parseCsv(readFileSync(OUT_FILE, "utf8"));
  if (!grid.length) return { seenPlaces, seenDomains, hasHeader: false };
  const headers = grid[0].map((cell) => cell.trim());
  const idCol = headers.indexOf("google_place_id");
  const webCol = headers.indexOf("website");
  for (const row of grid.slice(1)) {
    if (idCol >= 0 && row[idCol]) seenPlaces.add(String(row[idCol]).trim());
    const domain = domainOf(webCol >= 0 ? row[webCol] : "");
    if (domain) seenDomains.add(domain);
  }
  return { seenPlaces, seenDomains, hasHeader: true };
}

async function main() {
  const searches = INDUSTRIES.length * REGIONS.length;
  console.log(
    `ICP US Nonprofits: ${INDUSTRIES.length} industries × ${REGIONS.length} regions = ${searches} searches, up to ${maxPages} page(s) each.`
  );
  console.log(
    "About $35 per 1,000 Places Text Search calls. A monthly Google Maps credit often covers the first run at 1 page."
  );
  console.log(`File: ${OUT_FILE}`);

  mkdirSync(dirname(OUT_FILE), { recursive: true });
  const existing = loadExisting();
  const seenPlaces = existing.seenPlaces;
  const seenDomains = existing.seenDomains;
  if (!existing.hasHeader) {
    appendFileSync(OUT_FILE, `${HEADERS.join(",")}\n`, "utf8");
  }
  console.log(
    `Already in the file: ${seenPlaces.size} place ids, ${seenDomains.size} domains. Those will be skipped.`
  );

  let added = 0;
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
        const places = (json.places || []).map(mapPlace).filter(Boolean);
        const lines = [];
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
          if (
            seenPlaces.has(place.placeId) ||
            (domain && seenDomains.has(domain))
          ) {
            skipped += 1;
            continue;
          }
          seenPlaces.add(place.placeId);
          if (domain) seenDomains.add(domain);
          const geo = parseUsAddress(place.address);
          const record = [
            new Date().toISOString(),
            place.name,
            place.website,
            place.phone,
            place.address,
            geo.city,
            geo.state,
            "United States",
            industry,
            "google_places",
            place.rating,
            place.placeId,
            textQuery,
          ];
          lines.push(record.map(csvEscape).join(","));
          added += 1;
        }
        if (lines.length) {
          appendFileSync(OUT_FILE, `${lines.join("\n")}\n`, "utf8");
        }
        pageToken = json.nextPageToken || null;
        if (!pageToken) break;
      }
      if (index % 25 === 0 || index === searches) {
        console.log(
          `${index}/${searches} ${textQuery} · new ${added} · skipped ${skipped} · excluded ${excluded} · calls ${calls}`
        );
      }
      await sleep(200);
    }
  }

  console.log(
    `Done. Added ${added} leads. Skipped ${skipped} already in the file. Excluded ${excluded}. Places calls: ${calls}.`
  );
  console.log(`Download: ${OUT_FILE}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
