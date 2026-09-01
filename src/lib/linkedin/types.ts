export interface LinkedInSession {
  liAt: string;
  jsessionId: string;
  csrfToken: string;
}

export interface LinkedInSearchResult {
  profileUrn: string;
  publicIdentifier: string;
  firstName: string;
  lastName: string;
  fullName: string;
  headline: string;
  location: string;
  linkedInUrl: string;
  profilePicture?: string;
}

export interface LinkedInProfile extends LinkedInSearchResult {
  companyName?: string;
  jobTitle?: string;
  industry?: string;
  summary?: string;
}

export interface LinkedInSearchOptions {
  keywords: string;
  start?: number;
  count?: number;
}
