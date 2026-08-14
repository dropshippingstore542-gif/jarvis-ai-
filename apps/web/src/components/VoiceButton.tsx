import { useVoiceRecorder } from "../lib/useVoiceRecorder";

const LABEL: Record<string, string> = {
  idle: "Hold to talk",
  recording: "Recording — release to send",
  processing: "Processing…",
  error: "Mic error — try again",
};

export function VoiceButton({
  onRecorded,
  disabled,
}: {
  onRecorded: (audio: { mimeType: string; base64: string }) => void;
  disabled?: boolean;
}) {
  const { status, error, start, stop } = useVoiceRecorder(onRecorded);

  return (
    <button
      type="button"
      className="btn secondary"
      disabled={disabled || status === "processing"}
      onMouseDown={() => void start()}
      onMouseUp={stop}
      onMouseLeave={() => status === "recording" && stop()}
      onTouchStart={(e) => {
        e.preventDefault();
        void start();
      }}
      onTouchEnd={(e) => {
        e.preventDefault();
        stop();
      }}
      title={error ?? LABEL[status]}
      style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}
    >
      <span className={`status-dot ${status === "recording" ? "listening" : ""}`} />
      {status === "recording" ? "Recording…" : status === "processing" ? "Processing…" : "Hold to talk"}
    </button>
  );
}
