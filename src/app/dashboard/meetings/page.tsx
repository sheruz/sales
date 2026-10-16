import { appHome } from "@/lib/app-paths";
import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { meetingService } from "@/services/meeting.service";
import { emailBrandingService } from "@/services/email-branding.service";
import { getCurrentUser } from "@/lib/auth/session";
import { hasAnyOrgPermission } from "@/lib/tenant/scope";
import { EmptyState } from "@/components/crm/empty-state";
import {
  CopyBookingLinkButton,
  MeetingRow,
} from "@/components/meetings/meeting-actions";

function prepToText(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value.trim() || null;
  if (Array.isArray(value)) {
    const parts = value
      .map((v) => prepToText(v))
      .filter((v): v is string => !!v);
    return parts.length ? parts.map((p) => `• ${p}`).join("\n") : null;
  }
  if (typeof value === "object") {
    const parts = Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => {
        const text = prepToText(v);
        return text ? `${k}: ${text}` : null;
      })
      .filter((v): v is string => !!v);
    return parts.length ? parts.join("\n") : null;
  }
  return String(value);
}

function isHttpUrl(value: string | null | undefined): value is string {
  return !!value && /^https?:\/\//i.test(value.trim());
}

export default async function MeetingsPage() {
  const user = await getCurrentUser();
  if (!user?.organizationId) redirect(appHome());
  if (
    !hasAnyOrgPermission(user, ["opportunities.view", "deals.manage"])
  ) {
    redirect(appHome());
  }

  const [meetings, branding] = await Promise.all([
    meetingService.list(user.organizationId),
    emailBrandingService.get(user.organizationId).catch(() => null),
  ]);

  const bookingUrl = branding?.bookingUrl?.trim() ?? "";

  return (
    <div className="dx">
      <div className="page">
        <div className="page-head">
          <div>
            <h1 className="page-title">Meetings</h1>
            <p className="page-sub">
              Calls the AI booked for you, with prep notes.
            </p>
          </div>
          {isHttpUrl(bookingUrl) ? (
            <div className="page-actions">
              <CopyBookingLinkButton url={bookingUrl} />
            </div>
          ) : null}
        </div>

        {meetings.length === 0 ? (
          <EmptyState
            title="No meetings yet"
            description="Book a meeting from an opportunity detail page."
            actionHref={appHome("/opportunities")}
            actionLabel="View opportunities"
          />
        ) : (
          <div className="card">
            {meetings.map((m) => {
              const prep =
                prepToText(m.aiPrepNotes) ??
                prepToText(m.notes) ??
                prepToText(m.description);
              const upcoming = m.outcome === "SCHEDULED";
              const subtitleParts = [
                format(new Date(m.date), "EEE MMM d · h:mm a"),
                m.location,
              ].filter(Boolean);
              return (
                <MeetingRow
                  key={m.id}
                  title={m.title}
                  subtitle={subtitleParts.join(" · ")}
                  prep={prep}
                  joinUrl={
                    upcoming && isHttpUrl(m.meetingLink) ? m.meetingLink : null
                  }
                  badge={
                    <span
                      className={`badge ${
                        m.outcome === "COMPLETED"
                          ? "ok"
                          : m.outcome === "SCHEDULED"
                            ? "info"
                            : m.outcome === "NO_SHOW" || m.outcome === "CANCELLED"
                              ? "bad"
                              : "warn"
                      }`}
                    >
                      {m.outcome.replace("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}
                    </span>
                  }
                  links={
                    <>
                      {m.company ? (
                        <Link href={appHome(`/companies/${m.company.id}`)}>
                          {m.company.name}
                        </Link>
                      ) : null}
                      {m.contact ? (
                        <Link href={appHome(`/contacts/${m.contact.id}`)}>
                          {m.contact.fullName}
                        </Link>
                      ) : null}
                      {m.opportunityId ? (
                        <Link href={appHome(`/opportunities/${m.opportunityId}`)}>
                          Opportunity
                          {m.opportunity?.stage ? ` · ${m.opportunity.stage}` : ""}
                        </Link>
                      ) : null}
                    </>
                  }
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
