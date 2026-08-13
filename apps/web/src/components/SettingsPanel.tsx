import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { ToolInfo } from "../lib/types";

export function SettingsPanel() {
  const [settings, setSettings] = useState<Awaited<ReturnType<typeof api.getSettings>> | null>(null);
  const [tools, setTools] = useState<ToolInfo[]>([]);

  useEffect(() => {
    void api.getSettings().then(setSettings);
    void api.listTools().then((r) => setTools(r.tools));
  }, []);

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
        <div className="card-title">Voice (interface only — see ARCHITECTURE.md)</div>
        <div className="card-meta">
          <span>wake word: {settings?.voice.wakeWord ?? "…"}</span>
          <span>TTS: {settings?.voice.ttsProvider ?? "none"}</span>
          <span>STT: {settings?.voice.sttProvider ?? "none"}</span>
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-faint)" }}>
          No microphone/speaker pipeline is wired up yet in this environment. These values are
          stored and ready for Phase 5.
        </div>
      </div>

      <div className="card">
        <div className="card-title">Proactive Mode</div>
        <div className="card-meta">
          <span>{settings?.proactiveMode ?? "off"}</span>
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-faint)" }}>
          No automation/scheduler executor exists yet — see ARCHITECTURE.md. This setting is
          stored for when it does.
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
