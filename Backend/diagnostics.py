"""ASR diagnostic pipeline: confidence, error rates, phoneme alignment, noise."""
from __future__ import annotations

import numpy as np
import torch
import librosa
from jiwer import cer, wer
from noise_fingerprint import NoiseFingerprinter

# ── Singletons ────────────────────────────────────────────────
# G2p is lazy-initialised: importing g2p_en triggers nltk.data.find('cmudict')
# at module load time, which crashes Docker containers before NLTK data is ready.
# First call to _get_g2p() downloads data if absent and caches the instance.
_G2P: object | None = None
_fingerprinter = NoiseFingerprinter()


def _get_g2p():
    global _G2P
    if _G2P is None:
        import nltk
        for resource in ("averaged_perceptron_tagger_eng", "cmudict"):
            try:
                nltk.data.find(f"taggers/{resource}" if "tagger" in resource else f"corpora/{resource}")
            except LookupError:
                nltk.download(resource, quiet=True)
        from g2p_en import G2p
        _G2P = G2p()
    return _G2P

# ── Calibration temperature (tunable via env) ─────────────────
import os
_TEMPERATURE: float = float(os.environ.get("CONFIDENCE_TEMPERATURE", "1.0"))


# ── Confidence ────────────────────────────────────────────────

def extract_confidence(logits_tensor: torch.Tensor | None, temperature: float = _TEMPERATURE) -> float:
    """
    Confidence score from ASR logits with optional temperature scaling.

    Works for both backends:
    - Wav2Vec2 CTC: logits shape [1, T_frames, vocab_size]
    - Whisper decoder: stacked scores shape [1, T_tokens, vocab_size]

    Temperature scaling (Guo et al. 2017; arXiv:2509.07195):
      P_cal = softmax(logits / T)
    T > 1 softens overconfident predictions; T = 1.0 is vanilla.

    Returns mean of per-frame/per-token max probability — range [0, 1].
    Returns 0.0 when logits are unavailable (e.g. test stubs, model errors).
    """
    if logits_tensor is None:
        return 0.0
    scaled = logits_tensor / max(temperature, 1e-6)
    probs  = torch.softmax(scaled, dim=-1)
    return round(float(probs.max(dim=-1).values.mean().item()), 4)


def extract_token_uncertainty(logits_tensor: torch.Tensor | None) -> list[float]:
    """
    Per-frame/per-token binary entropy H_t = -p log p - (1-p) log(1-p)
    where p = max-probability at frame/token t (Rumberg et al., Interspeech 2023).

    Compatible with both Wav2Vec2 CTC and Whisper decoder logits.
    Returns list of uncertainties in [0, 1]. Values > 0.5 are considered uncertain.
    Returns empty list when logits are unavailable.
    """
    if logits_tensor is None:
        return []
    probs   = torch.softmax(logits_tensor.squeeze(0), dim=-1)
    p       = probs.max(dim=-1).values.detach().cpu().numpy()
    eps     = 1e-9
    p       = np.clip(p, eps, 1 - eps)
    entropy = -p * np.log(p) - (1 - p) * np.log(1 - p)
    return [round(float(h), 4) for h in entropy]


def nonconformity_score(confidence: float) -> float:
    """
    Conformal-prediction nonconformity score s = 1 - confidence.
    Higher score → more uncertain → higher priority for remediation
    (Ernez et al., PMLR 2023).
    """
    return round(1.0 - float(confidence), 4)


# ── Error rates ───────────────────────────────────────────────

def calculate_cer(reference: str | None, hypothesis: str) -> float | None:
    if not reference:
        return None
    return round(float(cer(reference, hypothesis)), 4)


def calculate_wer(reference: str | None, hypothesis: str) -> float | None:
    if not reference:
        return None
    return round(float(wer(reference, hypothesis)), 4)


# ── Phonemes ──────────────────────────────────────────────────

def extract_phonemes(text: str) -> list[str]:
    tokens = _get_g2p()(text or "")
    return [str(t) for t in tokens if str(t).strip()]


def phoneme_error_rate(reference: str | None, hypothesis: str) -> float | None:
    """PER = phoneme edit distance / len(reference phonemes)."""
    if not reference:
        return None
    ref_p = extract_phonemes(reference)
    hyp_p = extract_phonemes(hypothesis)
    if not ref_p:
        return None
    dist = _phoneme_edit_distance(ref_p, hyp_p)
    return round(dist / len(ref_p), 4)


def _phoneme_edit_distance(ref: list[str], hyp: list[str]) -> int:
    m, n = len(ref), len(hyp)
    dp = list(range(n + 1))
    for i in range(1, m + 1):
        prev, dp[0] = dp[0], i
        for j in range(1, n + 1):
            prev, dp[j] = dp[j], prev if ref[i-1] == hyp[j-1] else 1 + min(prev, dp[j], dp[j-1])
    return dp[n]


def align_phoneme_errors(reference_text: str, hypothesis_text: str) -> dict:
    """
    Align reference and hypothesis at phoneme level via Levenshtein.
    Returns edit operations with reference/hypothesis phoneme pairs.
    """
    reference  = extract_phonemes(reference_text)
    hypothesis = extract_phonemes(hypothesis_text)
    rows, cols = len(reference) + 1, len(hypothesis) + 1
    dp = [[0] * cols for _ in range(rows)]
    for i in range(rows): dp[i][0] = i
    for j in range(cols): dp[0][j] = j

    for i in range(1, rows):
        for j in range(1, cols):
            cost = 0 if reference[i-1] == hypothesis[j-1] else 1
            dp[i][j] = min(dp[i-1][j] + 1, dp[i][j-1] + 1, dp[i-1][j-1] + cost)

    errors, i, j = [], len(reference), len(hypothesis)
    while i > 0 or j > 0:
        if i > 0 and j > 0 and reference[i-1] == hypothesis[j-1]:
            i -= 1; j -= 1
        elif i > 0 and j > 0 and dp[i][j] == dp[i-1][j-1] + 1:
            errors.append({"operation": "substitution", "reference": reference[i-1], "hypothesis": hypothesis[j-1]})
            i -= 1; j -= 1
        elif i > 0 and dp[i][j] == dp[i-1][j] + 1:
            errors.append({"operation": "deletion", "reference": reference[i-1], "hypothesis": ""})
            i -= 1
        else:
            errors.append({"operation": "insertion", "reference": "", "hypothesis": hypothesis[j-1]})
            j -= 1

    errors.reverse()
    return {
        "reference_phonemes": reference,
        "hypothesis_phonemes": hypothesis,
        "distance": dp[-1][-1],
        "errors": errors,
    }


# ── Noise ─────────────────────────────────────────────────────

def classify_noise_profile(audio_array: np.ndarray, sr: int = 16000) -> dict:
    return _fingerprinter.fingerprint(audio_array, sr=sr)


def estimate_snr(audio_array: np.ndarray, sr: int = 16000) -> float:
    """
    Simple NIST-STNR-style SNR estimate using RMS of voiced vs. unvoiced frames.
    Returns SNR in dB. Value < 10 dB indicates noisy conditions (arXiv:2509.07195).
    """
    y     = np.asarray(audio_array, dtype=np.float32)
    frame = sr // 4  # 250 ms frames
    rms   = [np.sqrt(np.mean(y[i:i+frame]**2)) for i in range(0, len(y) - frame, frame)]
    if len(rms) < 2:
        return 0.0
    rms   = np.array(rms)
    noise_floor = np.percentile(rms, 10) + 1e-9
    signal_peak = np.percentile(rms, 90) + 1e-9
    snr_db      = 20 * np.log10(signal_peak / noise_floor)
    return round(float(np.clip(snr_db, -10, 60)), 2)


# ── Error classification ──────────────────────────────────────

_THRESHOLDS = {
    "confidence_low":  float(os.environ.get("CONF_THRESHOLD_LOW",  "0.40")),
    "cer_noise":       float(os.environ.get("CER_THRESHOLD_NOISE", "0.20")),
    "cer_accent":      float(os.environ.get("CER_THRESHOLD_ACCENT","0.15")),
    "cer_pronun":      float(os.environ.get("CER_THRESHOLD_PRONUN","0.10")),
    "snr_low_db":      float(os.environ.get("SNR_THRESHOLD_LOW",   "10.0")),
}


def classify_error_type(
    cer_score: float | None,
    noise_profile: dict | None,
    confidence_score: float,
    snr_db: float | None = None,
) -> str:
    """
    Multi-signal error classification with SNR-awareness.
    snr_db < 10 dB corroborates noise classification (arXiv:2509.07195).
    """
    np_   = noise_profile or {}
    noisy = np_.get("noise_type", "clean") != "clean"
    t     = _THRESHOLDS
    snr_low = (snr_db is not None) and (snr_db < t["snr_low_db"])

    if cer_score is None:
        if noisy or snr_low:           return "noise"
        if confidence_score < t["confidence_low"]: return "accent"
        return "clean"

    if (noisy or snr_low) and cer_score > t["cer_noise"]:  return "noise"
    if confidence_score < t["confidence_low"] and cer_score > t["cer_accent"]: return "accent"
    if cer_score > t["cer_pronun"]:                         return "pronunciation"
    return "clean"
