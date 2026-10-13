"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Calendar, Copy } from "lucide-react";

export function CopyBookingLinkButton({ url }: { url: string }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Booking link copied");
    } catch {
      toast.error("Could not copy the booking link");
    }
  }

  return (
    <button type="button" className="btn" onClick={copy}>
      <Copy />
      Copy booking link
    </button>
  );
}

export function MeetingRow({
  title,
  subtitle,
  badge,
  links,
  prep,
  joinUrl,
}: {
  title: string;
  subtitle: string;
  badge?: React.ReactNode;
  links?: React.ReactNode;
  prep: string | null;
  joinUrl: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <div className="task">
        <div className="feed-icon brand">
          <Calendar />
        </div>
        <div className="task-text">
          <div className="task-title">{title}</div>
          <div className="cell-sub" suppressHydrationWarning>
            {subtitle}
          </div>
          {links ? <div className="task-links">{links}</div> : null}
        </div>
        {badge}
        {prep ? (
          <button
            type="button"
            className="btn"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
          >
            Prep notes
          </button>
        ) : null}
        {joinUrl ? (
          <a
            className="btn primary"
            href={joinUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Join
          </a>
        ) : null}
      </div>
      {open && prep ? <div className="meeting-prep">{prep}</div> : null}
    </div>
  );
}
