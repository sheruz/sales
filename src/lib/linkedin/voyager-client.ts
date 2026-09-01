import type { LinkedInSession } from "./types";

const BASE_URL = "https://www.linkedin.com/voyager/api";

/**
 * Normalize LinkedIn session cookies.
 * JSESSIONID value is typically "ajax:1234567890" — csrf-token header must match exactly.
 */
export function buildSession(liAt: string, jsessionId: string): LinkedInSession {
  let jsession = jsessionId.trim().replace(/^["']|["']$/g, "");

  // Remove accidental double-ajax prefix
  if (jsession.startsWith("ajax:ajax:")) {
    jsession = jsession.replace(/^ajax:/, "");
  }

  // csrf-token must exactly equal the JSESSIONID cookie value
  const csrfToken = jsession.startsWith("ajax:") ? jsession : `ajax:${jsession}`;
  const cookieValue = jsession.startsWith("ajax:") ? jsession : csrfToken;

  return {
    liAt: liAt.trim(),
    jsessionId: cookieValue,
    csrfToken,
  };
}

export class LinkedInVoyagerClient {
  constructor(private session: LinkedInSession) {}

  private get headers(): Record<string, string> {
    return {
      Cookie: `li_at=${this.session.liAt}; JSESSIONID="${this.session.jsessionId}"`,
      "csrf-token": this.session.csrfToken,
      "x-restli-protocol-version": "2.0.0",
      "x-li-lang": "en_US",
      Accept: "application/vnd.linkedin.normalized+json+2.1",
      Referer: "https://www.linkedin.com/feed/",
      Origin: "https://www.linkedin.com",
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
      included?: Array<{
        firstName?: string;
        lastName?: string;
        entityUrn?: string;
        $type?: string;
      }>;
    }>("/me");

    const profile = data.miniProfile ?? data.included?.find(
      (i) => i.$type?.includes("MiniProfile") || i.firstName
    );

    if (!profile?.firstName) {
      throw new Error(
        "Invalid LinkedIn session — refresh cookies from browser (li_at + JSESSIONID)"
      );
    }

    return {
      name: `${profile.firstName} ${profile.lastName}`,
      urn: profile.entityUrn ?? "",
    };
  }
}
