import type { ActivityEntry } from "../lib/types";

const LABEL: Record<ActivityEntry["status"], string> = {
  running: "running",
  success: "done",
  error: "failed",
  awaiting_approval: "awaiting approval",
};

interface ImagePayload {
  mimeType: string;
  base64: string;
}

function getImage(output: unknown): ImagePayload | undefined {
  if (!output || typeof output !== "object" || !("image" in output)) return undefined;
  const img = (output as { image?: unknown }).image;
  if (
    img &&
    typeof img === "object" &&
    typeof (img as ImagePayload).mimeType === "string" &&
    typeof (img as ImagePayload).base64 === "string"
  ) {
    return img as ImagePayload;
  }
  return undefined;
}

export function ActivityChip({ entry }: { entry: ActivityEntry }) {
  const image = entry.status === "success" ? getImage(entry.output) : undefined;

  return (
    <div className={`activity-chip ${entry.status}`} style={{ flexDirection: "column", alignItems: "flex-start" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className="icon" />
        <span>
          {entry.toolName} · {LABEL[entry.status]}
        </span>
        {entry.error && <span style={{ color: "var(--danger)" }}>— {entry.error}</span>}
        {entry.verified === false && <span style={{ color: "var(--warn)" }}>— unverified</span>}
      </div>
      {image && (
        <img
          src={`data:${image.mimeType};base64,${image.base64}`}
          alt={`${entry.toolName} result`}
          style={{
            marginTop: 8,
            maxWidth: "100%",
            maxHeight: 260,
            borderRadius: 6,
            border: "1px solid var(--border)",
          }}
        />
      )}
    </div>
  );
}
