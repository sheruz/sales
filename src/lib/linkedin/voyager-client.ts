import type { LinkedInSession } from "./types";

const BASE_URL = "https://www.linkedin.com/voyager/api";

export class LinkedInVoyagerClient {
  constructor(private session: LinkedInSession) {}

  private get headers(): Record<string, string> {
    const jsession = this.session.jsessionId.replace(/^"|"$/g, "");
    return {
      Cookie: `li_at=${this.session.liAt}; JSESSIONID="${jsession}"`,
      "csrf-token": this.session.csrfToken || `ajax:${jsession}`,
      "x-restli-protocol-version": "2.0.0",
      "x-li-lang": "en_US",
      Accept: "application/vnd.linkedin.normalized+json+2.1",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    };
  }

  async get<T>(path: string): Promise<T> {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: "GET",
      headers: this.headers,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`LinkedIn API ${response.status}: ${text.slice(0, 200)}`);
    }

    return response.json() as Promise<T>;
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: {
        ...this.headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`LinkedIn API ${response.status}: ${text.slice(0, 200)}`);
    }

    if (response.status === 204) return {} as T;
    return response.json() as Promise<T>;
  }

  async verifySession(): Promise<{ name: string; urn: string }> {
    const data = await this.get<{
      miniProfile?: { firstName: string; lastName: string; entityUrn: string };
    }>("/me");

    const profile = data.miniProfile;
    if (!profile) throw new Error("Invalid LinkedIn session — could not fetch profile");

    return {
      name: `${profile.firstName} ${profile.lastName}`,
      urn: profile.entityUrn,
    };
  }
}

export function buildSession(liAt: string, jsessionId: string): LinkedInSession {
  const cleanJsession = jsessionId.replace(/^"|"$/g, "");
  return {
    liAt,
    jsessionId: cleanJsession,
    csrfToken: `ajax:${cleanJsession}`,
  };
}
