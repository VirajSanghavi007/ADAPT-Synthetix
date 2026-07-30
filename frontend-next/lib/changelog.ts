// Mirrors VERSION.md (gitignored) — bump CURRENT_VERSION and add an entry here whenever
// VERSION.md gets a new version. Shown once per version via WhatsNewModal.
export const CURRENT_VERSION = "5.4.0";

export type ChangelogEntry = {
  version: string;
  date: string;
  whatsNew: string[];
  bugFixes: string[];
};

export const CHANGELOG: ChangelogEntry[] = [
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
