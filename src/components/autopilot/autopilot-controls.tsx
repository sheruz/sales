"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Zap } from "lucide-react";

export type StageKey = "sourcing" | "enrichment" | "audit" | "outbound";

const ENDPOINTS: Record<StageKey, string> = {
  sourcing: "/api/autopilot/sourcing",
  enrichment: "/api/autopilot/enrichment",
  audit: "/api/autopilot/audit",
  outbound: "/api/autopilot/outbound",
};

async function setEnabled(stage: StageKey, enabled: boolean) {
  const res = await fetch(ENDPOINTS[stage], {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(json?.error?.message ?? json?.error ?? "Request failed");
  }
}

export function StageToggle({
  stage,
  enabled,
  label,
}: {
  stage: StageKey;
  enabled: boolean;
  label: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [on, setOn] = useState(enabled);

  async function toggle() {
    const next = !on;
    setBusy(true);
    setOn(next);
    try {
      await setEnabled(stage, next);
      router.refresh();
    } catch {
      setOn(!next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={busy}
      onClick={toggle}
      className={`toggle${on ? " on" : ""}`}
    />
  );
}

export function AutopilotMasterButtons({
  running,
  settingsHref,
}: {
  running: boolean;
  settingsHref: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function pauseAll() {
    setBusy(true);
    try {
      await Promise.all(
        (Object.keys(ENDPOINTS) as StageKey[]).map((s) => setEnabled(s, false))
      );
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="btn"
        disabled={busy || !running}
        onClick={pauseAll}
      >
        Pause all
      </button>
      {running ? (
        <span className="btn primary" aria-live="polite">
          <Zap />
          Running
        </span>
      ) : (
        <a href={settingsHref} className="btn">
          <Zap />
          Paused
        </a>
      )}
    </>
  );
}
