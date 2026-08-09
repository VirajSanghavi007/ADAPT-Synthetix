"use client";

import { useRef, useState } from "react";
import { API_URL } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { useModels } from "@/lib/useModels";
import { friendlyApiError } from "@/lib/apiError";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Segment = { time: string; text: string };

const SEGMENT_MS = 6000;

function formatClock(startedAt: number) {
  const elapsed = Math.floor((Date.now() - startedAt) / 1000);
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function LiveTranscribe() {
  const { session } = useSession();
  const { models } = useModels();
  const [listening, setListening] = useState(false);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [modelId, setModelId] = useState("");
  const [error, setError] = useState("");
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const startedAtRef = useRef(0);
  const stoppedRef = useRef(true);

  function startSegment(stream: MediaStream) {
    const recorder = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.onstop = async () => {
      const blob = new Blob(chunks, { type: "audio/webm" });
      const time = formatClock(startedAtRef.current);
      transcribeSegment(blob, time);
      if (!stoppedRef.current) startSegment(stream);
    };
    recorder.start();
    recorderRef.current = recorder;
    setTimeout(() => {
      if (recorderRef.current === recorder && recorder.state === "recording") recorder.stop();
    }, SEGMENT_MS);
  }

  async function transcribeSegment(blob: Blob, time: string) {
    if (blob.size < 1000) return; 
    const form = new FormData();
    form.append("file", blob, "segment.webm");
    if (modelId) form.append("model_id", modelId);
    try {
      const res = await fetch(`${API_URL}/api/transcribe`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token}` },
        body: form,
      });
      if (!res.ok) throw new Error(await friendlyApiError(res));
      const data = await res.json();
      const text = (data.text || "").trim();
      if (text) setSegments((prev) => [...prev, { time, text }]);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function start() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      stoppedRef.current = false;
      startedAtRef.current = Date.now();
      setSegments([]);
      setListening(true);
      startSegment(stream);
    } catch (err) {
      setError("Microphone access denied: " + (err as Error).message);
    }
  }

  function stop() {
    stoppedRef.current = true;
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setListening(false);
  }

  return (
    <section className="card-elevated space-y-3 rounded-xl border border-border p-6">
      {models && models.asr.length > 0 && (
        <Select
          value={modelId || models.asr[0].id}
          onValueChange={(v) => v && setModelId(v)}
          disabled={listening}
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
        onClick={listening ? stop : start}
        aria-pressed={listening}
        variant={listening ? "destructive" : "accent"}
        size="lg"
        className={listening ? "pulse-recording px-4" : "glow-accent px-4"}
      >
        {listening ? "Stop listening" : "Start listening"}
      </Button>
      <p className="text-xs text-muted">
        Not true real-time streaming — transcribes in ~6-second segments as you speak, so text
        appears a few seconds behind.
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="min-h-24 space-y-2 rounded-lg border border-border bg-background/40 p-3">
        {segments.length === 0 ? (
          <p className="text-sm text-muted">Timestamped transcript will appear here as you speak.</p>
        ) : (
          segments.map((seg, i) => (
            <p key={i} className="selectable text-sm">
              <span className="font-mono text-xs text-muted">[{seg.time}]</span> {seg.text}
            </p>
          ))
        )}
      </div>
    </section>
  );
}
