"""Rule-based error-type classification, ported from ADAPT-Synthetix v1's design
(TODO.md P1.8.c) — combines ASR confidence, CER (when a reference is available), and
noise category into one of four labels. Thresholds are v1's starting point, carried
over as-is; recalibrate against this codebase's own engine (distil-whisper, not v1's
Wav2Vec2) once enough real data exists rather than assuming they transfer unchanged.
"""
from __future__ import annotations

ERROR_TYPES = ("clean", "noise-induced", "accent-related", "pronunciation-based")


def classify(confidence: float | None, cer: float | None, noise_category: str) -> str:
    """confidence: 0-1 or None if the engine didn't expose one (see asr_pipeline.py).
    cer: 0-1 or None if no reference_text was supplied for this transcription.
    noise_category: from noise_fingerprint.classify(), or "clean" if not computed."""
    if confidence is None:
        # No confidence signal at all — can't apply confidence-based thresholds
        # honestly. Fall back to noise alone rather than fabricating a guess.
        return "noise-induced" if noise_category != "clean" else "clean"

    if confidence > 0.85 and (cer is None or cer < 0.05):
        return "clean"
    if noise_category != "clean" and confidence < 0.6:
        return "noise-induced"
    if 0.55 <= confidence <= 0.80 and noise_category == "clean":
        return "accent-related"
    return "pronunciation-based"
