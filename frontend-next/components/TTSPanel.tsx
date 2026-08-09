"use client";

import { useEffect, useState } from "react";
import { Download, HardDriveUpload, ShieldCheck } from "lucide-react";
import { API_URL } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { useModels } from "@/lib/useModels";
import { uploadToDrive } from "@/lib/googleDrive";
import { friendlyApiError } from "@/lib/apiError";
import { wordErrorRate } from "@/lib/wordErrorRate";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Above this WER, the round-trip check flags the audio as likely garbled rather
// than just "imperfect" — TTS mispronunciations naturally produce some ASR
// mismatch even on good audio, so this needs to be well above normal ASR error
// rates (which run a few percent on clean speech) to mean something.
const GARBLED_WER_THRESHOLD = 0.4;

const TTS_TEXT_CACHE_KEY = "adapt-synthetix-last-tts-text";
const TTS_MODEL_KEY = "adapt-synthetix-tts-model";

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
  const [checkingQuality, setCheckingQuality] = useState(false);
  const [qualityResult, setQualityResult] = useState<{ wer: number; garbled: boolean; heard: string } | null>(null);

  useEffect(() => {
    setText(localStorage.getItem(TTS_TEXT_CACHE_KEY) || "");
    setModelId(localStorage.getItem(TTS_MODEL_KEY) || "");
  }, []);

  // Live ticking timer while a request is in flight — see Recorder.tsx for why.
  useEffect(() => {
    if (!busy) return;
    const start = performance.now();
    setElapsedMs(0);
    const id = setInterval(() => setElapsedMs(performance.now() - start), 100);
    return () => clearInterval(id);
  }, [busy]);

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
    try {
      const res = await fetch(`${API_URL}/api/tts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ text: trimmed, model_id: modelId || undefined }),
      });
      if (!res.ok) throw new Error(await friendlyApiError(res));
      const buffer = await res.arrayBuffer();
      const blob = new Blob([buffer], { type: "audio/mpeg" });
      setAudioBlob(blob);
      setAudioUrl(URL.createObjectURL(blob));
      setQualityResult(null);
      setStatus("Playing.");
    } catch (err) {
      setStatus("Error: " + (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function downloadAudio() {
    if (!audioUrl) return;
    const a = document.createElement("a");
    a.href = audioUrl;
    a.download = `adapt-synthetix-speech-${Date.now()}.mp3`;
    a.click();
  }

  async function saveAudioToDrive() {
    if (!audioBlob) return;
    setStatus("Saving to Google Drive...");
    try {
      await uploadToDrive(`adapt-synthetix-speech-${Date.now()}.mp3`, audioBlob, "audio/mpeg");
      setStatus("Saved to Google Drive.");
    } catch (err) {
      setStatus("Drive error: " + (err as Error).message);
    }
  }

  // Round-trip quality check: feed the generated audio back into ASR and diff the
  // result against the original input text. High word-error-rate is a decent
  // proxy for "this came out garbled" — a clean synthesis re-transcribes close to
  // the original text; a garbled one produces something barely related.
  async function checkQuality() {
    if (!audioBlob) return;
    setCheckingQuality(true);
    setQualityResult(null);
    try {
      const form = new FormData();
      form.append("file", audioBlob, "check.mp3");
      const res = await fetch(`${API_URL}/api/transcribe`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token}` },
        body: form,
      });
      if (!res.ok) throw new Error(await friendlyApiError(res));
      const data = await res.json();
      const heard = (data.text || "").trim();
      const wer = wordErrorRate(text.trim(), heard);
      setQualityResult({ wer, garbled: wer >= GARBLED_WER_THRESHOLD, heard });
    } catch (err) {
      setStatus("Quality check error: " + (err as Error).message);
    } finally {
      setCheckingQuality(false);
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
        <Select
          value={modelId || models.tts[0].id}
          onValueChange={selectModel}
          items={Object.fromEntries(models.tts.map((m) => [m.id, m.label]))}
        >
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
            <Button
              variant="outline"
              size="sm"
              onClick={checkQuality}
              disabled={checkingQuality}
              className="cursor-pointer gap-1.5"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              {checkingQuality ? "Checking..." : "Check for garbled speech"}
            </Button>
          </div>
          {qualityResult && (
            <p className={`text-sm ${qualityResult.garbled ? "text-destructive" : "text-accent"}`}>
              {qualityResult.garbled
                ? `This may have come out garbled — re-transcribing it gave "${qualityResult.heard}", quite different from what you typed.`
                : `Sounds right — re-transcribing it matched closely (${Math.round(qualityResult.wer * 100)}% word difference).`}
            </p>
          )}
        </>
      )}
    </section>
  );
}
