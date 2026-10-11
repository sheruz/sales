import type { SourceConnectorAdapter } from "@/lib/connectors/types";
import { hiringSignalConnector } from "@/lib/connectors/adapters/hiring";
import { fundingSignalConnector } from "@/lib/connectors/adapters/funding";
import { webResearchConnector } from "@/lib/connectors/adapters/web-research";
import { rfpTenderConnector } from "@/lib/connectors/adapters/rfp-tender";
import { csvCrmConnector } from "@/lib/connectors/adapters/csv-crm";
import { linkedInSignalConnector } from "@/lib/connectors/adapters/linkedin";
import { metaSignalConnector } from "@/lib/connectors/adapters/meta";
import { instagramSignalConnector } from "@/lib/connectors/adapters/instagram";
import { websiteVisitorsConnector } from "@/lib/connectors/adapters/website-visitors";
import {
  hubspotConnector,
  salesforceConnector,
  pipedriveConnector,
} from "@/lib/connectors/adapters/crm";

const adapters: SourceConnectorAdapter[] = [
  hiringSignalConnector,
  fundingSignalConnector,
  webResearchConnector,
  rfpTenderConnector,
  csvCrmConnector,
  linkedInSignalConnector,
  metaSignalConnector,
  instagramSignalConnector,
  websiteVisitorsConnector,
  hubspotConnector,
  salesforceConnector,
  pipedriveConnector,
];

export function listConnectorAdapters(): SourceConnectorAdapter[] {
  return adapters;
}

export function getConnectorAdapter(
  type: string,
  provider?: string
): SourceConnectorAdapter | null {
  const byType = adapters.filter((a) => a.type === type);
  if (!byType.length) return null;
  if (provider) {
    return byType.find((a) => a.provider === provider) ?? byType[0];
  }
  return byType[0];
}

export function catalogConnectorTypes(options?: {
  sourcesEnabled?: boolean;
  metaConnectorEnabled?: boolean;
}) {
  const sourcesEnabled = options?.sourcesEnabled ?? true;
  const metaConnectorEnabled = options?.metaConnectorEnabled ?? true;

  return adapters.map((a) => {
    const isMeta = a.type === "META";
    const disabled =
      !sourcesEnabled ||
      (isMeta && !metaConnectorEnabled) ||
      (!sourcesEnabled &&
        [
          "HIRING",
          "FUNDING",
          "WEB_RESEARCH",
          "RFP_TENDER",
          "LINKEDIN",
          "META",
          "INSTAGRAM",
        ].includes(a.type));

    return {
      type: a.type,
      provider: a.provider,
      displayName: a.displayName,
      description: disabled
        ? `${a.description} (disabled — Client Autopilot Phase 0)`
        : a.description,
      disabled,
    };
  });
}
