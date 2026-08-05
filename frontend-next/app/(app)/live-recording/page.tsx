"use client";

import { useState } from "react";
import { Radio, Mic, FolderUp } from "lucide-react";
import { usePageTitle } from "@/lib/usePageTitle";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import LiveTranscribe from "@/components/LiveTranscribe";
import Recorder from "@/components/Recorder";
import ImportPanel from "@/components/ImportPanel";

type Mode = "live" | "normal" | "import";

export default function LiveRecordingPage() {
  usePageTitle("Live Recording");
  const [mode, setMode] = useState<Mode>("live");

  return (
    <div className="animate-fade-up space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Live Recording</h1>
        <p className="text-sm text-muted">
          Transcribe as you speak, record a single clip, or import existing audio.
        </p>
      </div>

      <Tabs value={mode} onValueChange={(v) => v && setMode(v as Mode)}>
        <TabsList>
          <TabsTrigger value="live" className="cursor-pointer gap-1.5">
            <Radio className="h-3.5 w-3.5" /> Live
          </TabsTrigger>
          <TabsTrigger value="normal" className="cursor-pointer gap-1.5">
            <Mic className="h-3.5 w-3.5" /> Normal
          </TabsTrigger>
          <TabsTrigger value="import" className="cursor-pointer gap-1.5">
            <FolderUp className="h-3.5 w-3.5" /> Import
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {mode === "live" && <LiveTranscribe />}
      {mode === "normal" && <Recorder />}
      {mode === "import" && <ImportPanel />}
    </div>
  );
}
