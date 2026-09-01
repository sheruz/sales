import { LinkedInVoyagerClient } from "./voyager-client";
import type { LinkedInSearchOptions, LinkedInSearchResult } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseSearchResults(data: any): LinkedInSearchResult[] {
  const results: LinkedInSearchResult[] = [];
  const included = data?.included ?? [];

  const profiles = included.filter(
    (item: { $type?: string }) =>
      item.$type === "com.linkedin.voyager.dash.identity.profile.Profile"
  );

  for (const profile of profiles) {
    const urn = profile.entityUrn ?? profile["*miniProfile"];
    const publicId = profile.publicIdentifier;
    if (!publicId) continue;

    const firstName = profile.firstName ?? "";
    const lastName = profile.lastName ?? "";
    const headline = profile.headline ?? profile.occupation ?? "";

    results.push({
      profileUrn: urn ?? `urn:li:fsd_profile:${publicId}`,
      publicIdentifier: publicId,
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`.trim(),
      headline,
      location: profile.locationName ?? profile.geoLocationName ?? "",
      linkedInUrl: `https://www.linkedin.com/in/${publicId}`,
    });
  }

  // Fallback: parse from elements/clusters structure
  if (results.length === 0) {
    const elements = data?.data?.elements ?? data?.elements ?? [];
    for (const element of elements) {
      const items = element?.items ?? element?.results ?? [];
      for (const item of items) {
        const hit = item?.itemUnion?.entityResult ?? item?.entityResult ?? item;
        const title = hit?.title?.text ?? hit?.name?.text ?? "";
        const subtitle = hit?.primarySubtitle?.text ?? hit?.headline?.text ?? "";
        const navUrl = hit?.navigationUrl ?? hit?.navigationContext?.url ?? "";
        const match = navUrl.match(/linkedin\.com\/in\/([^/?]+)/);
        if (!match) continue;

        const parts = title.split(" ");
        results.push({
          profileUrn: hit?.trackingUrn ?? `urn:li:fsd_profile:${match[1]}`,
          publicIdentifier: match[1],
          firstName: parts[0] ?? "",
          lastName: parts.slice(1).join(" ") ?? "",
          fullName: title,
          headline: subtitle,
          location: hit?.secondarySubtitle?.text ?? "",
          linkedInUrl: `https://www.linkedin.com/in/${match[1]}`,
        });
      }
    }
  }

  return results;
}

export async function searchPeople(
  client: LinkedInVoyagerClient,
  options: LinkedInSearchOptions
): Promise<LinkedInSearchResult[]> {
  const { keywords, start = 0, count = 25 } = options;

  const query = encodeURIComponent(
    `(keywords:${keywords},flagshipSearchIntent:SEARCH_SRP,queryParameters:(resultType:List(PEOPLE),network:List(F,O)),includeFiltersInResponse:false)`
  );

  const path = `/search/dash/clusters?decorationId=com.linkedin.voyager.dash.deco.search.SearchClusterCollection-175&count=${count}&origin=GLOBAL_SEARCH_HEADER&q=all&query=${query}&start=${start}`;

  const data = await client.get(path);
  return parseSearchResults(data);
}

export async function getProfile(
  client: LinkedInVoyagerClient,
  publicIdentifier: string
) {
  const path = `/identity/dash/profiles?q=memberIdentity&memberIdentity=${publicIdentifier}&decorationId=com.linkedin.voyager.dash.deco.identity.profile.FullProfileWithEntities-91`;
  const data = await client.get(path);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const included = (data as any)?.included ?? [];
  const profile = included.find(
    (i: { publicIdentifier?: string }) => i.publicIdentifier === publicIdentifier
  );

  const position = included.find(
    (i: { $type?: string }) =>
      i.$type === "com.linkedin.voyager.dash.identity.profile.Position"
  );

  return {
    publicIdentifier,
    firstName: profile?.firstName ?? "",
    lastName: profile?.lastName ?? "",
    fullName: `${profile?.firstName ?? ""} ${profile?.lastName ?? ""}`.trim(),
    headline: profile?.headline ?? "",
    summary: profile?.summary ?? "",
    jobTitle: position?.title ?? profile?.headline ?? "",
    companyName: position?.companyName ?? "",
    industry: profile?.industryName ?? "",
    location: profile?.locationName ?? "",
    linkedInUrl: `https://www.linkedin.com/in/${publicIdentifier}`,
    profileUrn: profile?.entityUrn ?? "",
  };
}
