"use client";

import { useState } from "react";
import { API_URL } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { Button } from "@/components/ui/button";

export default function TTSPanel() {
  const { session } = useSession();
  const [text, setText] = useState("");
  const [status, setStatus] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);

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
        body: JSON.stringify({ text: trimmed }),
      });
      const ms = performance.now() - start;
      if (!res.ok) throw new Error(await res.text());
      const buffer = await res.arrayBuffer();
      const blob = new Blob([buffer], { type: "audio/wav" });
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
        onChange={(e) => setText(e.target.value)}
        placeholder="Type something to hear it spoken..."
        className="min-h-24 w-full rounded-lg border border-border bg-background/40 p-3 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
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
      {audioUrl && <audio controls autoPlay src={audioUrl} className="w-full" />}
    </section>
  );
}
