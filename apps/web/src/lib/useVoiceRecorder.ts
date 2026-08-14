import { useCallback, useRef, useState } from "react";

export type RecorderStatus = "idle" | "recording" | "processing" | "error";

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read recording."));
    reader.readAsDataURL(blob);
  });
}

/** Real browser microphone capture (MediaRecorder) — a genuine push-to-talk input, not a mock. */
export function useVoiceRecorder(onRecorded: (audio: { mimeType: string; base64: string }) => void) {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const start = useCallback(async () => {
    setError(null);
    if (recorderRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        setStatus("processing");
        const blob = new Blob(chunksRef.current, { type: mimeType });
        stream.getTracks().forEach((t) => t.stop());
        blobToBase64(blob)
          .then((base64) => {
            onRecorded({ mimeType, base64 });
            setStatus("idle");
          })
          .catch((err: unknown) => {
            setError(err instanceof Error ? err.message : String(err));
            setStatus("error");
          });
      };

      recorder.start();
      recorderRef.current = recorder;
      setStatus("recording");
    } catch (err) {
      setError(
        err instanceof Error
          ? `Microphone unavailable: ${err.message}`
          : "Microphone access was denied.",
      );
      setStatus("error");
    }
  }, [onRecorded]);

  const stop = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    recorderRef.current = null;
  }, []);

  return { status, error, start, stop };
}
