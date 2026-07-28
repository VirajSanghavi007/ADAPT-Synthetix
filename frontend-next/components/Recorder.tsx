"use client";

import { useRef, useState } from "react";
import { API_URL } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { Button } from "@/components/ui/button";

export default function Recorder() {
  const { session } = useSession();
  const [recording, setRecording] = useState(false);
  const [status, setStatus] = useState("");
  const [transcript, setTranscript] = useState("");
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

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
    setElapsedMs(null);
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    const form = new FormData();
    form.append("file", blob, "recording.webm");

    const start = performance.now();
    try {
      const res = await fetch(`${API_URL}/api/transcribe`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token}` },
        body: form,
      });
      const ms = performance.now() - start;
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setTranscript(data.text || "(no speech detected)");
      setElapsedMs(ms);
      setStatus("Done.");
    } catch (err) {
      setElapsedMs(performance.now() - start);
      setStatus("Error: " + (err as Error).message);
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
      <div className="min-h-10 whitespace-pre-wrap rounded-lg border border-border bg-background/40 p-3 text-foreground">
        {transcript || <span className="text-muted">Your transcript will appear here.</span>}
      </div>
    </section>
  );
}
