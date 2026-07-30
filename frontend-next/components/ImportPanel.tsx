"use client";

import { useRef, useState } from "react";
import { FolderUp, HardDrive } from "lucide-react";
import { API_URL } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { listDriveAudioFiles, type DriveAudioFile } from "@/lib/googleDrive";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";

type ImportResult = { filename?: string; text?: string; error?: string };

export default function ImportPanel() {
  const { session } = useSession();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState("");
  const [results, setResults] = useState<ImportResult[]>([]);
  const [driveOpen, setDriveOpen] = useState(false);
  const [driveFiles, setDriveFiles] = useState<DriveAudioFile[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [driveToken, setDriveToken] = useState("");
  const [busy, setBusy] = useState(false);

  async function uploadFromComputer(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setStatus(`Transcribing ${files.length} file(s)...`);
    const form = new FormData();
    Array.from(files).forEach((f) => form.append("files", f));
    try {
      const res = await fetch(`${API_URL}/api/ingest/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token}` },
        body: form,
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setResults(data.results);
      setStatus(`Done — ${data.results.length} file(s) processed.`);
    } catch (err) {
      setStatus("Error: " + (err as Error).message);
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function openDrivePicker() {
    setBusy(true);
    setStatus("Listing your Google Drive audio files...");
    try {
      const { files, accessToken } = await listDriveAudioFiles();
      setDriveFiles(files);
      setDriveToken(accessToken);
      setSelectedIds(new Set());
      setDriveOpen(true);
      setStatus("");
    } catch (err) {
      setStatus("Drive error: " + (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function toggleFile(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function importSelected() {
    if (selectedIds.size === 0) return;
    setBusy(true);
    setStatus(`Importing ${selectedIds.size} file(s) from Drive...`);
    try {
      const res = await fetch(`${API_URL}/api/ingest/drive`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ access_token: driveToken, file_ids: Array.from(selectedIds) }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setResults(data.results);
      setStatus(`Done — ${data.results.length} file(s) processed.`);
      setDriveOpen(false);
    } catch (err) {
      setStatus("Error: " + (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card-elevated space-y-3 rounded-xl border border-border p-6">
      <h2 className="text-lg font-medium">Bulk import</h2>
      <p className="text-sm text-muted">Transcribe multiple files at once, from your computer or Google Drive.</p>

      <div className="flex flex-wrap gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/webm,audio/wav,audio/x-wav,audio/mpeg,audio/mp3,audio/ogg,audio/flac,audio/x-flac,audio/mp4,audio/x-m4a,audio/aac,audio/3gpp,audio/amr,video/mp4"
          multiple
          hidden
          onChange={(e) => uploadFromComputer(e.target.files)}
        />
        <Button variant="outline" disabled={busy} onClick={() => fileInputRef.current?.click()} className="cursor-pointer gap-1.5">
          <FolderUp className="h-4 w-4" /> Upload from computer
        </Button>

        <Dialog open={driveOpen} onOpenChange={setDriveOpen}>
          <DialogTrigger render={<Button variant="outline" disabled={busy} className="cursor-pointer gap-1.5" onClick={openDrivePicker} />}>
            <HardDrive className="h-4 w-4" /> Import from Google Drive
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Select audio files</DialogTitle>
              <DialogDescription>
                {driveFiles.length === 0 ? "No audio files found in your Drive." : "Choose files to transcribe."}
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {driveFiles.map((f) => (
                <label key={f.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-secondary">
                  <Checkbox checked={selectedIds.has(f.id)} onCheckedChange={() => toggleFile(f.id)} />
                  <span className="truncate text-sm">{f.name}</span>
                </label>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDriveOpen(false)} className="cursor-pointer">
                Cancel
              </Button>
              <Button variant="accent" onClick={importSelected} disabled={busy || selectedIds.size === 0} className="cursor-pointer">
                Import {selectedIds.size > 0 ? `(${selectedIds.size})` : ""}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {status && <p className="text-sm text-muted">{status}</p>}

      {results.length > 0 && (
        <ul className="space-y-1.5">
          {results.map((r, i) => (
            <li key={i} className="rounded-lg border border-border bg-background/40 p-2.5 text-sm">
              <p className="font-medium">{r.filename}</p>
              {r.error ? <p className="text-destructive">{r.error}</p> : <p className="text-muted">{r.text}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
