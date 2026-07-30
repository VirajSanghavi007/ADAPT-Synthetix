"use client";

import { useEffect, useState } from "react";
import { Download, HardDriveUpload } from "lucide-react";
import { API_URL } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { useModels } from "@/lib/useModels";
import { uploadToDrive } from "@/lib/googleDrive";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TTS_TEXT_CACHE_KEY = "mercury-last-tts-text";
const TTS_MODEL_KEY = "mercury-tts-model";

export default function TTSPanel() {
  const { session } = useSession();
  const { models } = useModels();
  const [text, setText] = useState("");
  const [status, setStatus] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [modelId, setModelId] = useState<string>("");

  useEffect(() => {
    setText(localStorage.getItem(TTS_TEXT_CACHE_KEY) || "");
    setModelId(localStorage.getItem(TTS_MODEL_KEY) || "");
  }, []);

  function selectModel(id: string | null) {
    if (!id) return;
    setModelId(id);
    localStorage.setItem(TTS_MODEL_KEY, id);
  }

  async function speak() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setBusy(true);
    setStatus("Generating audio...");
    setElapsedMs(null);
    const start = performance.now();
    try {
      const res = await fetch(`${API_URL}/api/tts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ text: trimmed, model_id: modelId || undefined }),
      });
      const ms = performance.now() - start;
      if (!res.ok) throw new Error(await res.text());
      const buffer = await res.arrayBuffer();
      const blob = new Blob([buffer], { type: "audio/mpeg" });
      setAudioBlob(blob);
      setAudioUrl(URL.createObjectURL(blob));
      setElapsedMs(ms);
      setStatus("Playing.");
    } catch (err) {
      setElapsedMs(performance.now() - start);
      setStatus("Error: " + (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function downloadAudio() {
    if (!audioUrl) return;
    const a = document.createElement("a");
    a.href = audioUrl;
    a.download = `mercury-speech-${Date.now()}.mp3`;
    a.click();
  }

  async function saveAudioToDrive() {
    if (!audioBlob) return;
    setStatus("Saving to Google Drive...");
    try {
      await uploadToDrive(`mercury-speech-${Date.now()}.mp3`, audioBlob, "audio/mpeg");
      setStatus("Saved to Google Drive.");
    } catch (err) {
      setStatus("Drive error: " + (err as Error).message);
    }
  }

  return (
    <section className="card-elevated space-y-3 rounded-xl border border-border p-6">
      <div className="flex items-center gap-2">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4 text-accent">
          <path d="M11 5 6 9H2v6h4l5 4V5Z" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M19 5a13 13 0 0 1 0 14M15.5 8.5a7 7 0 0 1 0 7" strokeLinecap="round" />
        </svg>
        <h2 className="text-lg font-medium">Text → Speech</h2>
      </div>
      <label htmlFor="tts-text" className="sr-only">
        Text to speak
      </label>
      <textarea
        id="tts-text"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          localStorage.setItem(TTS_TEXT_CACHE_KEY, e.target.value);
        }}
        placeholder="Type something to hear it spoken..."
        className="min-h-24 w-full rounded-lg border border-border bg-background/40 p-3 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {models && models.tts.length > 0 && (
        <Select value={modelId || models.tts[0].id} onValueChange={selectModel}>
          <SelectTrigger className="w-full" aria-label="TTS model">
            <SelectValue placeholder="Select a model" />
          </SelectTrigger>
          <SelectContent>
            {models.tts.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <Button onClick={speak} disabled={busy} variant="accent" size="lg" className="glow-accent px-4">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
          <path d="M11 5 6 9H2v6h4l5 4V5Z" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M19 5a13 13 0 0 1 0 14M15.5 8.5a7 7 0 0 1 0 7" strokeLinecap="round" />
        </svg>
        Speak
      </Button>
      <p className="min-h-[1.2em] text-sm text-muted">
        {status}
        {elapsedMs !== null && ` (${(elapsedMs / 1000).toFixed(2)}s)`}
      </p>
      {audioUrl && (
        <>
          <audio controls autoPlay src={audioUrl} className="w-full" />
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={downloadAudio} className="cursor-pointer gap-1.5">
              <Download className="h-3.5 w-3.5" /> Download
            </Button>
            <Button variant="outline" size="sm" onClick={saveAudioToDrive} className="cursor-pointer gap-1.5">
              <HardDriveUpload className="h-3.5 w-3.5" /> Save to Drive
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
