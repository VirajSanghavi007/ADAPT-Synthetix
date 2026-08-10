"use client";

import { useEffect, useRef, useState } from "react";
import { Download, HardDriveUpload } from "lucide-react";
import { API_URL } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { useModels } from "@/lib/useModels";
import { uploadToDrive } from "@/lib/googleDrive";
import { friendlyApiError } from "@/lib/apiError";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DiagnosticsPanel, { type TranscribeDiagnostics } from "@/components/DiagnosticsPanel";

const TRANSCRIPT_CACHE_KEY = "adapt-synthetix-last-transcript";
const ASR_MODEL_KEY = "adapt-synthetix-asr-model";

export default function Recorder() {
  const { session } = useSession();
  const { models } = useModels();
  const [recording, setRecording] = useState(false);
  const [status, setStatus] = useState("");
  const [transcript, setTranscript] = useState("");
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [modelId, setModelId] = useState<string>("");
  const [diagnostics, setDiagnostics] = useState<TranscribeDiagnostics | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (!busy) return;
    const start = performance.now();
    setElapsedMs(0);
    const id = setInterval(() => setElapsedMs(performance.now() - start), 100);
    return () => clearInterval(id);
  }, [busy]);

  useEffect(() => {
    setTranscript(localStorage.getItem(TRANSCRIPT_CACHE_KEY) || "");
    setModelId(localStorage.getItem(ASR_MODEL_KEY) || "");
  }, []);

  function selectModel(id: string | null) {
    if (!id) return;
    setModelId(id);
    localStorage.setItem(ASR_MODEL_KEY, id);
  }

  function downloadTranscript() {
    const blob = new Blob([transcript], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `adapt-synthetix-transcript-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function saveTranscriptToDrive() {
    setStatus("Saving to Google Drive...");
    try {
      await uploadToDrive(`adapt-synthetix-transcript-${Date.now()}.txt`, new Blob([transcript], { type: "text/plain" }), "text/plain");
      setStatus("Saved to Google Drive.");
    } catch (err) {
      setStatus("Drive error: " + (err as Error).message);
    }
  }

  async function toggleRecording() {
    if (!recording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        chunksRef.current = [];
        const recorder = new MediaRecorder(stream);
        recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
        recorder.onstop = onRecordingStop;
        recorder.start();
        mediaRecorderRef.current = recorder;
        setRecording(true);
        setStatus("Listening...");
        setTranscript("");
        setDiagnostics(null);
      } catch (err) {
        setStatus("Microphone access denied: " + (err as Error).message);
      }
    } else {
      mediaRecorderRef.current?.stop();
      mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
      setRecording(false);
    }
  }

  async function onRecordingStop() {
    setStatus("Transcribing...");
    setBusy(true);
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    const form = new FormData();
    form.append("file", blob, "recording.webm");
    if (modelId) form.append("model_id", modelId);

    try {
      const res = await fetch(`${API_URL}/api/transcribe`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token}` },
        body: form,
      });
      if (!res.ok) throw new Error(await friendlyApiError(res));
      const data = await res.json();
      const text = data.text || "(no speech detected)";
      setTranscript(text);
      localStorage.setItem(TRANSCRIPT_CACHE_KEY, text);
      setDiagnostics(
        "confidence" in data
          ? {
              confidence: data.confidence ?? null,
              noise_category: data.noise_category ?? null,
              error_type: data.error_type ?? null,
              wpr: data.wpr ?? null,
              her: data.her ?? null,
              priority_queued: !!data.priority_queued,
              remediation: data.remediation ?? null,
            }
          : null
      );
      setStatus("Done.");
    } catch (err) {
      setStatus("Error: " + (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card-elevated space-y-3 rounded-xl border border-border p-6">
      <div className="flex items-center gap-2">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4 text-accent">
          <rect x="9" y="2" width="6" height="12" rx="3" />
          <path d="M5 10a7 7 0 0 0 14 0M12 21v-4" strokeLinecap="round" />
        </svg>
        <h2 className="text-lg font-medium">Speech → Text</h2>
      </div>
      {models && models.asr.length > 0 && (
        <Select
          value={modelId || models.asr[0].id}
          onValueChange={selectModel}
          items={Object.fromEntries(models.asr.map((m) => [m.id, m.label]))}
        >
          <SelectTrigger className="w-full" aria-label="ASR model">
            <SelectValue placeholder="Select a model" />
          </SelectTrigger>
          <SelectContent>
            {models.asr.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <Button
        onClick={toggleRecording}
        aria-pressed={recording}
        variant={recording ? "destructive" : "accent"}
        size="lg"
        className={recording ? "pulse-recording px-4" : "glow-accent px-4"}
      >
        {recording ? (
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
            <rect x="6" y="6" width="12" height="12" rx="1" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
            <rect x="9" y="2" width="6" height="12" rx="3" />
            <path d="M5 10a7 7 0 0 0 14 0M12 21v-4" strokeLinecap="round" />
          </svg>
        )}
        {recording ? "Stop Recording" : "Start Recording"}
      </Button>
      <p className="min-h-[1.2em] text-sm text-muted">
        {status}
        {elapsedMs !== null && ` (${(elapsedMs / 1000).toFixed(2)}s)`}
      </p>
      <div className="selectable min-h-10 whitespace-pre-wrap rounded-lg border border-border bg-background/40 p-3 text-foreground">
        {transcript || <span className="text-muted">Your transcript will appear here.</span>}
      </div>
      {diagnostics && <DiagnosticsPanel diagnostics={diagnostics} />}
      {transcript && (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={downloadTranscript} className="cursor-pointer gap-1.5">
            <Download className="h-3.5 w-3.5" /> Download
          </Button>
          <Button variant="outline" size="sm" onClick={saveTranscriptToDrive} className="cursor-pointer gap-1.5">
            <HardDriveUpload className="h-3.5 w-3.5" /> Save to Drive
          </Button>
        </div>
      )}
    </section>
  );
}
