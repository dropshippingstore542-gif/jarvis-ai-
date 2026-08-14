import { useEffect, useState } from "react";
import { api, API_BASE } from "../lib/api";
import type { ToolInfo } from "../lib/types";

export function SettingsPanel() {
  const [settings, setSettings] = useState<Awaited<ReturnType<typeof api.getSettings>> | null>(null);
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void api.getSettings().then(setSettings);
    void api.listTools().then((r) => setTools(r.tools));
  }, []);

  const feedUrl = settings ? `${API_BASE}${settings.calendarFeedPath}` : "";

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Settings</h2>
      </div>

      <div className="card">
        <div className="card-title">AI Provider</div>
        <div className="card-meta">
          <span>provider: {settings?.ai.provider ?? "…"}</span>
          <span>model: {settings?.ai.model ?? "…"}</span>
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-faint)" }}>
          Set via AI_PROVIDER / AI_MODEL / AI_API_KEY in .env — requires a server restart to change.
        </div>
      </div>

      <div className="card">
        <div className="card-title">Voice — push-to-talk</div>
        <div className="card-meta">
          <span>wake word: {settings?.voice.wakeWord ?? "…"}</span>
          <span>TTS: {settings?.voice.ttsProvider ?? "none"}</span>
          <span>STT: {settings?.voice.sttProvider ?? "none"}</span>
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-faint)" }}>
          {settings?.voice.sttProvider === "none"
            ? "Set STT_PROVIDER=openai + VOICE_API_KEY to enable the push-to-talk button."
            : "Hold the mic button in the conversation view to talk. There's no always-listening wake-word mode — see ARCHITECTURE.md."}
        </div>
      </div>

      <div className="card">
        <div className="card-title">Email</div>
        <div className="card-meta">
          <span>provider: {settings?.emailProvider ?? "none"}</span>
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-faint)" }}>
          {settings?.emailProvider === "none"
            ? "Set EMAIL_PROVIDER=smtp + SMTP_* in .env to let the assistant send email (high-risk, requires approval every time)."
            : "email.send requires your explicit approval on every call — see the Audit Log for a record of what was sent."}
        </div>
      </div>

      <div className="card">
        <div className="card-title">Calendar</div>
        <div className="card-meta">
          <span>local, no OAuth required</span>
        </div>
        {feedUrl && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 12, color: "var(--text-faint)", marginBottom: 6 }}>
              Subscribe to this URL from Google/Apple/Outlook calendar to see events the assistant creates:
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <div className="modal-code" style={{ flex: 1, overflowX: "auto" }}>
                {feedUrl}
              </div>
              <button
                className="btn secondary"
                onClick={() => {
                  void navigator.clipboard.writeText(feedUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title">Proactive Mode</div>
        <div className="card-meta">
          <span>{settings?.proactiveMode ?? "off"}</span>
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-faint)" }}>
          The automation engine runs regardless — this only affects future notification delivery.
          See the Automations panel to create scheduled tasks.
        </div>
      </div>

      <div className="card">
        <div className="card-title">Web Search</div>
        <div className="card-meta">
          <span>provider: {settings?.webSearchProvider ?? "none"}</span>
        </div>
      </div>

      <div className="panel-header" style={{ marginTop: 24 }}>
        <h2>Available Tools</h2>
      </div>
      {tools.map((t) => (
        <div className="card" key={t.name}>
          <div className="card-title">
            {t.name} <span className={`tag permission-${t.permission}`}>{t.permission}</span>
          </div>
          <div className="card-meta">{t.description}</div>
        </div>
      ))}
    </div>
  );
}
