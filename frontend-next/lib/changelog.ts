// Mirrors VERSION.md (gitignored) — bump CURRENT_VERSION and add an entry here whenever
// VERSION.md gets a new version. Shown once per version via WhatsNewModal.
export const CURRENT_VERSION = "5.5.0";

export type ChangelogEntry = {
  version: string;
  date: string;
  whatsNew: string[];
  bugFixes: string[];
};

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "5.5.0",
    date: "2026-08-04",
    whatsNew: [
      "Plans renamed — Freyr (free), Horus (pro), Odin (max) — and their two engines each have their own names too: Echo 1.1, Apollo 1.2, Thoth 1.3",
      "Upload a custom profile picture instead of only picking a preset avatar",
      "Error Analysis now explains phoneme mistakes in plain English instead of raw phonetic codes",
      "Usage credits, shown on the Subscription page — free renews every 5 hours, pro/max renew weekly",
      "Rate-limit emails — you'll get notified the moment you hit your hourly limit",
    ],
    bugFixes: [],
  },
  {
    version: "5.4.1",
    date: "2026-08-04",
    whatsNew: [
      "Settings: a Beta features toggle, and this changelog is now always visible here too",
    ],
    bugFixes: [
      "Fixed ASR crashing on any audio needing resampling (missing torchaudio) across all three model tiers",
      "Fixed TTS 500s from a placeholder default voice name that didn't exist in any model's voice pack",
      "Fixed the admin MLOps latency dashboard being completely broken (Postgres type error)",
      "Fixed Error Analysis phoneme diagnostics being completely broken (stale NLTK resource name)",
      "Fixed transcribe/TTS occasionally failing outright on a slow network or DB hiccup instead of degrading gracefully",
      "Fixed Google Drive import only searching My Drive, missing shared-drive files",
      "Fixed model weights re-downloading from scratch on every restart instead of persisting",
    ],
  },
  {
    version: "5.4.0",
    date: "2026-07-30",
    whatsNew: [
      "Tiered ASR/TTS model picker — 6 models across Free/Pro/Max/Enterprise tiers",
      "Bulk import: upload multiple files at once, or import straight from Google Drive",
      "Download transcripts and generated speech, or save them to Google Drive",
      "Error Analysis dashboard — phoneme-level confusion matrix",
      "API keys and an MCP server for third-party/agent access",
      "Enterprise accounts — free Max-tier access with a company employee-ID login",
      "Separate Profile and Account pages, a guided tour, and this changelog",
    ],
    bugFixes: [
      "Fixed a hydration mismatch caused by the theme-init script",
      "Fixed two-factor setup failing on retry (duplicate unverified factor)",
      "Fixed several buttons rendered incorrectly as links",
    ],
  },
];

export function getLatestEntry(): ChangelogEntry {
  return CHANGELOG[0];
}
