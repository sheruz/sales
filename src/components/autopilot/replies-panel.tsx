"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Loader2 } from "lucide-react";

type Mode = "OFF" | "DRAFT_ONLY" | "AUTO_SEND";
type AutoClass = "interested" | "question" | "not_now";

export type RepliesConfig = {
  mode: Mode;
  killSwitch: boolean;
  shadow: boolean;
  confidenceThreshold: number;
  maxRepliesPerConversation: number;
  autoSendByClass: Record<AutoClass, boolean>;
  notInterestedSendClose: boolean;
  nonEnglishHold: boolean;
  classifyModel: string;
  draftModel: string;
};

export type RepliesStats = {
  timezone: string;
  today: {
    replies: number;
    classified: number;
    byClass: Record<string, number>;
    draftsCreated: number;
    sent: number;
    cancelled: number;
    dismissed: number;
    errors: number;
    avgResponseMinutes: number | null;
    costUsd: number;
  };
  open: {
    queued: number;
    held: number;
    drafts: number;
    oldestHeldAt: string | null;
  };
};

type Props = { initial: RepliesStats & { config: RepliesConfig } };

const MODES: { value: Mode; label: string; help: string }[] = [
  { value: "OFF", label: "Off", help: "No AI work on replies" },
  {
    value: "DRAFT_ONLY",
    label: "Draft only",
    help: "AI drafts, you review and send",
  },
  {
    value: "AUTO_SEND",
    label: "Auto-send",
    help: "Safe classes send themselves (10–40 min, Mon–Fri 8–19)",
  },
];

const AUTO_CLASSES: { key: AutoClass; label: string; help: string }[] = [
  { key: "interested", label: "Interested", help: "Wants to talk / learn more" },
  { key: "question", label: "Question", help: "Asks something we can answer" },
  { key: "not_now", label: "Not now", help: "Polite close, follow-up task" },
];

function formatResponse(mins: number | null): string {
  if (mins == null) return "\u2014";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  return `${h}h ${mins % 60}m`;
}

export function RepliesPanel({ initial }: Props) {
  const router = useRouter();
  const [config, setConfig] = useState(initial.config);
  const [threshold, setThreshold] = useState(
    String(initial.config.confidenceThreshold)
  );
  const [maxReplies, setMaxReplies] = useState(
    String(initial.config.maxRepliesPerConversation)
  );
  const [classifyModel, setClassifyModel] = useState(
    initial.config.classifyModel
  );
  const [draftModel, setDraftModel] = useState(initial.config.draftModel);
  const [busy, setBusy] = useState<string | null>(null);

  const { today, open } = initial;

  async function patch(
    key: string,
    body: Record<string, unknown>,
    successMsg = "Reply settings saved"
  ) {
    setBusy(key);
    try {
      const res = await fetch("/api/autopilot/replies", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || "Failed");
      const next = json.data.config as RepliesConfig;
      setConfig(next);
      setThreshold(String(next.confidenceThreshold));
      setMaxReplies(String(next.maxRepliesPerConversation));
      const cancelled = json.data.kill?.cancelled as number | undefined;
      toast.success(
        key === "kill" && next.killSwitch
          ? `Kill switch ON — ${cancelled ?? 0} queued repl${cancelled === 1 ? "y" : "ies"} cancelled`
          : successMsg
      );
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  function saveNumbers() {
    const t = Number(threshold);
    const m = Number(maxReplies);
    if (!Number.isFinite(t) || t < 0.1 || t > 1) {
      toast.error("Confidence threshold must be between 0.1 and 1");
      return;
    }
    if (!Number.isInteger(m) || m < 1 || m > 20) {
      toast.error("Max replies must be a whole number from 1 to 20");
      return;
    }
    patch("numbers", { confidenceThreshold: t, maxRepliesPerConversation: m });
  }

  function saveModels() {
    patch("models", {
      classifyModel: classifyModel.trim(),
      draftModel: draftModel.trim(),
    });
  }

  const autoLive =
    config.mode === "AUTO_SEND" && !config.killSwitch && !config.shadow;

  return (
    <div className="stack">
      {config.killSwitch ? (
        <div className="banner">
          <AlertTriangle />
          <div className="t">
            <b>Kill switch is ON.</b>{" "}
            <span className="muted">
              Nothing is auto-sent and queued AI replies were cancelled. Drafts
              still appear in your inbox.
            </span>
          </div>
          <button
            type="button"
            className="btn"
            disabled={busy === "kill"}
            onClick={() =>
              patch("kill", { killSwitch: false }, "Kill switch OFF")
            }
          >
            Turn off
          </button>
        </div>
      ) : config.mode === "AUTO_SEND" && config.shadow ? (
        <div className="banner">
          <AlertTriangle />
          <div className="t">
            <b>AI shadow is ON.</b>{" "}
            <span className="muted">
              Replies are drafted but never auto-sent. Turn it off to go live.
            </span>
          </div>
        </div>
      ) : null}

      <div className="grid g4">
        <div className="card kpi">
          <div className="kpi-label">Replies today</div>
          <div className="kpi-value">{today.replies}</div>
          <div className="kpi-delta muted">{today.classified} classified</div>
        </div>
        <div className="card kpi">
          <div className="kpi-label">Auto-sent</div>
          <div className="kpi-value">{today.sent}</div>
          <div className="kpi-delta muted">
            {open.queued} queued · {today.draftsCreated} drafted
          </div>
        </div>
        <div className="card kpi">
          <div className="kpi-label">Held for you</div>
          <div className="kpi-value">{open.held}</div>
          <div className="kpi-delta muted">
            {open.drafts} drafts to review
            {open.oldestHeldAt
              ? ` · oldest ${new Date(open.oldestHeldAt).toLocaleDateString()}`
              : ""}
          </div>
        </div>
        <div className="card kpi">
          <div className="kpi-label">Avg response time</div>
          <div className="kpi-value">
            {formatResponse(today.avgResponseMinutes)}
          </div>
          <div className="kpi-delta muted">reply received → sent</div>
        </div>
      </div>

      <div className="grid g3">
        <div className="card kpi">
          <div className="kpi-label">AI cost today</div>
          <div className="kpi-value">${today.costUsd.toFixed(3)}</div>
          <div className="kpi-delta muted">classify + draft</div>
        </div>
        <div className="card kpi">
          <div className="kpi-label">Errors today</div>
          <div className="kpi-value">{today.errors}</div>
          <div
            className={`kpi-delta${today.errors > 0 ? "" : " muted"}`}
            style={today.errors > 0 ? { color: "var(--dx-bad)" } : undefined}
          >
            {today.errors > 0
              ? "failed classify / draft / send"
              : "none \u2014 all good"}
          </div>
        </div>
        <div className="card kpi">
          <div className="kpi-label">Dismissed / cancelled</div>
          <div className="kpi-value">
            {today.dismissed} / {today.cancelled}
          </div>
          <div className="kpi-delta muted">{initial.timezone} day</div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <div className="card-title">Reply agent</div>
            <div className="card-sub">
              Classifies every reply and drafts an answer. Pricing, contracts,
              complaints and low-confidence replies are always handed to you.
            </div>
          </div>
          <span
            className={`badge ${autoLive ? "warn" : config.mode === "OFF" ? "bad" : "ok"}`}
            style={{ marginLeft: "auto" }}
          >
            {config.killSwitch
              ? "Kill switch"
              : config.mode === "AUTO_SEND"
                ? config.shadow
                  ? "Auto-send (shadow)"
                  : "Auto-send live"
                : config.mode === "DRAFT_ONLY"
                  ? "Draft only"
                  : "Off"}
          </span>
        </div>
        <div className="card-body">
          <div className="form-row">
            <div>
              <div className="form-label">Mode</div>
              <div className="form-help muted">
                {MODES.find((m) => m.value === config.mode)?.help}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {MODES.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  className={`btn${config.mode === m.value ? " primary" : ""}`}
                  disabled={busy === "mode"}
                  aria-pressed={config.mode === m.value}
                  onClick={() => patch("mode", { mode: m.value })}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-row">
            <div>
              <div className="form-label">Kill switch</div>
              <div className="form-help muted">
                Stops all auto-sending now and cancels queued AI replies.
              </div>
            </div>
            <div>
              <button
                type="button"
                role="switch"
                aria-checked={config.killSwitch}
                aria-label="Kill switch"
                disabled={busy === "kill"}
                onClick={() =>
                  patch(
                    "kill",
                    { killSwitch: !config.killSwitch },
                    "Kill switch OFF"
                  )
                }
                className={`toggle${config.killSwitch ? " on" : ""}`}
              />
            </div>
          </div>

          <div className="form-row">
            <div>
              <div className="form-label">AI shadow</div>
              <div className="form-help muted">
                Draft everything, auto-send nothing. Separate from outbound
                shadow mode.
              </div>
            </div>
            <div>
              <button
                type="button"
                role="switch"
                aria-checked={config.shadow}
                aria-label="AI shadow"
                disabled={busy === "shadow"}
                onClick={() => patch("shadow", { shadow: !config.shadow })}
                className={`toggle${config.shadow ? " on" : ""}`}
              />
            </div>
          </div>

          <div className="form-row">
            <div>
              <div className="form-label">Auto-send by class</div>
              <div className="form-help muted">
                Only used in Auto-send mode. Other classes are always drafted
                for you.
              </div>
            </div>
            <div className="stack" style={{ gap: 0 }}>
              {AUTO_CLASSES.map((c) => (
                <div className="stage-row" key={c.key}>
                  <div className="stage-info">
                    <div className="stage-name">{c.label}</div>
                    <div className="cell-sub">
                      {c.help}
                      {today.byClass[c.key.toUpperCase()]
                        ? ` · ${today.byClass[c.key.toUpperCase()]} today`
                        : ""}
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={config.autoSendByClass[c.key]}
                    aria-label={`Auto-send ${c.label}`}
                    disabled={busy === `class:${c.key}`}
                    onClick={() =>
                      patch(`class:${c.key}`, {
                        autoSendByClass: {
                          [c.key]: !config.autoSendByClass[c.key],
                        },
                      })
                    }
                    className={`toggle${config.autoSendByClass[c.key] ? " on" : ""}`}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="form-row">
            <div>
              <div className="form-label">Limits</div>
              <div className="form-help muted">
                Below the confidence threshold a reply becomes &ldquo;other&rdquo;
                and is held for you.
              </div>
            </div>
            <div
              style={{
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
                alignItems: "flex-end",
              }}
            >
              <label className="stack" style={{ gap: 4 }}>
                <span className="cell-sub">Confidence threshold (0.1–1)</span>
                <span className="input" style={{ color: "var(--dx-text)" }}>
                  <input
                    inputMode="decimal"
                    value={threshold}
                    onChange={(e) => setThreshold(e.target.value)}
                    style={{ width: 80 }}
                  />
                </span>
              </label>
              <label className="stack" style={{ gap: 4 }}>
                <span className="cell-sub">Max AI replies / conversation</span>
                <span className="input" style={{ color: "var(--dx-text)" }}>
                  <input
                    inputMode="numeric"
                    value={maxReplies}
                    onChange={(e) => setMaxReplies(e.target.value)}
                    style={{ width: 80 }}
                  />
                </span>
              </label>
              <button
                type="button"
                className="btn"
                disabled={busy === "numbers"}
                onClick={saveNumbers}
              >
                {busy === "numbers" ? <Loader2 className="animate-spin" /> : null}
                Save limits
              </button>
            </div>
          </div>

          <div className="form-row">
            <div>
              <div className="form-label">Models (optional)</div>
              <div className="form-help muted">
                Leave blank to use your default economy / quality models.
                Overrides are stored per organization; the AI router currently
                picks the model from your AI integration settings.
              </div>
            </div>
            <div
              style={{
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
                alignItems: "flex-end",
              }}
            >
              <label className="stack" style={{ gap: 4 }}>
                <span className="cell-sub">Classify model</span>
                <span className="input" style={{ color: "var(--dx-text)" }}>
                  <input
                    placeholder="default (economy)"
                    value={classifyModel}
                    onChange={(e) => setClassifyModel(e.target.value)}
                    style={{ width: 200 }}
                  />
                </span>
              </label>
              <label className="stack" style={{ gap: 4 }}>
                <span className="cell-sub">Draft model</span>
                <span className="input" style={{ color: "var(--dx-text)" }}>
                  <input
                    placeholder="default (quality)"
                    value={draftModel}
                    onChange={(e) => setDraftModel(e.target.value)}
                    style={{ width: 200 }}
                  />
                </span>
              </label>
              <button
                type="button"
                className="btn"
                disabled={busy === "models"}
                onClick={saveModels}
              >
                {busy === "models" ? <Loader2 className="animate-spin" /> : null}
                Save models
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
