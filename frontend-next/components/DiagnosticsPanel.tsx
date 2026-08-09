"use client";

import { Badge } from "@/components/ui/badge";

// Mirrors the fields /api/transcribe adds on the free tier only (see
// Backend/main.py) — the 7-objective diagnostic core. Absent (undefined) on
// pro/max responses, since that pipeline isn't wired up for those tiers yet.
export type TranscribeDiagnostics = {
  confidence: number | null;
  noise_category: string | null;
  error_type: string | null;
  priority_queued: boolean;
  remediation: {
    id: number | null;
    carrier_text: string;
    reference_phoneme: string;
    hypothesis_phoneme: string;
  } | null;
};

const ERROR_TYPE_LABEL: Record<string, string> = {
  clean: "Clean",
  "noise-induced": "Noise-induced",
  "accent-related": "Accent-related",
  "pronunciation-based": "Pronunciation-based",
};

const ERROR_TYPE_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  clean: "secondary",
  "noise-induced": "outline",
  "accent-related": "outline",
  "pronunciation-based": "destructive",
};

function confidenceColor(confidence: number | null): string {
  if (confidence === null) return "bg-muted";
  if (confidence >= 0.75) return "bg-accent";
  if (confidence >= 0.5) return "bg-secondary";
  return "bg-destructive";
}

export default function DiagnosticsPanel({ diagnostics }: { diagnostics: TranscribeDiagnostics }) {
  const { confidence, noise_category, error_type, priority_queued, remediation } = diagnostics;
  const pct = confidence !== null ? Math.round(confidence * 100) : null;

  return (
    <div className="space-y-3 rounded-lg border border-border bg-background/40 p-3 text-sm">
      <p className="text-xs font-medium tracking-wide text-muted uppercase">Diagnostics</p>

      {/* 2. Per-Utterance Confidence Scoring */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-muted">Confidence</span>
          <span className="font-medium">{pct !== null ? `${pct}%` : "unavailable"}</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
          <div
            className={`h-full rounded-full transition-all ${confidenceColor(confidence)}`}
            style={{ width: `${pct ?? 0}%` }}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* 3. 8-Feature Acoustic Noise Classification */}
        {noise_category && (
          <Badge variant={noise_category === "clean" ? "secondary" : "outline"}>
            Noise: {noise_category}
          </Badge>
        )}

        {/* 4. Rule-Based Error-Type Diagnosis */}
        {error_type && (
          <Badge variant={ERROR_TYPE_VARIANT[error_type] ?? "outline"}>
            {ERROR_TYPE_LABEL[error_type] ?? error_type}
          </Badge>
        )}

        {/* 5. Domain-Critical Priority Queue */}
        {priority_queued && <Badge variant="destructive">Flagged for review</Badge>}
      </div>

      {/* 6. Closed-Loop TTS Remediation */}
      {remediation && (
        <div className="rounded-md border border-border bg-card/50 p-2 text-xs">
          <p className="font-medium text-foreground">Corrective audio generated</p>
          <p className="mt-0.5 text-muted">
            Targeting the &ldquo;{remediation.reference_phoneme}&rdquo; sound (heard as &ldquo;
            {remediation.hypothesis_phoneme}&rdquo;) — &ldquo;{remediation.carrier_text}&rdquo;
          </p>
        </div>
      )}

      <p className="text-[11px] text-muted">
        Confidence and remediation are computed live; noise, error-type, and priority are
        rule-based on top of that signal — see the model card for details.
      </p>
    </div>
  );
}
