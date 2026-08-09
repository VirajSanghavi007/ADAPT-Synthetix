"""8-feature acoustic noise fingerprinting, ported from ADAPT-Synthetix v1's design
(TODO.md P1.8.a) — free tier only.

Honest scoping note: v1 trained a Random Forest on ~500 hand-labelled clips (88%
measured accuracy). No such labelled corpus exists in this codebase yet, so this is a
threshold-based heuristic classifier over the same 8 features, not a trained model.
It's an intentionally conservative first pass — accurate enough to distinguish "clean"
from "not clean" (which is what error_diagnosis.py actually needs), weaker at telling
the noisy categories apart from each other. Swap in a trained classifier once a labelled
corpus exists (see TODO.md P1.8.b) without changing the calling contract below.
"""
from __future__ import annotations

import numpy as np

NOISE_CATEGORIES = ("clean", "traffic", "crowd", "machinery", "indoor")


def extract_features(audio: np.ndarray, sr: int) -> dict[str, float]:
    """The 8 features from ADAPT v1's design. Returns raw (unnormalised) values —
    normalisation against corpus statistics only matters once there's a corpus to
    normalise against; the heuristic classifier below uses raw thresholds instead."""
    import librosa

    if audio.size == 0:
        return {k: 0.0 for k in (
            "spectral_centroid", "spectral_bandwidth", "spectral_rolloff",
            "zero_crossing_rate", "rms_energy", "mfcc_variance", "tempo", "harmonic_ratio",
        )}

    y = audio.astype(np.float32)

    centroid = float(np.mean(librosa.feature.spectral_centroid(y=y, sr=sr)))
    bandwidth = float(np.mean(librosa.feature.spectral_bandwidth(y=y, sr=sr)))
    rolloff = float(np.mean(librosa.feature.spectral_rolloff(y=y, sr=sr, roll_percent=0.85)))
    zcr = float(np.mean(librosa.feature.zero_crossing_rate(y=y)))
    rms = float(np.mean(librosa.feature.rms(y=y)))
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
    mfcc_variance = float(np.mean(np.var(mfcc, axis=1)))

    try:
        tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
        tempo = float(tempo if np.isscalar(tempo) else tempo[0])
    except Exception:
        tempo = 0.0

    try:
        harmonic, percussive = librosa.effects.hpss(y)
        harmonic_energy = float(np.sum(harmonic ** 2))
        total_energy = float(np.sum(y ** 2)) or 1.0
        harmonic_ratio = harmonic_energy / total_energy
    except Exception:
        harmonic_ratio = 0.0

    return {
        "spectral_centroid": centroid,
        "spectral_bandwidth": bandwidth,
        "spectral_rolloff": rolloff,
        "zero_crossing_rate": zcr,
        "rms_energy": rms,
        "mfcc_variance": mfcc_variance,
        "tempo": tempo,
        "harmonic_ratio": harmonic_ratio,
    }


def classify(features: dict[str, float]) -> str:
    """Heuristic threshold classifier — see module docstring. Order matters: checks
    are most-conservative-first, so a clip only earns a "noisy" label when a feature
    clearly indicates it, defaulting to "clean" otherwise (a false "clean" is a safer
    failure mode for error_diagnosis.py than a false "noisy" one, since the latter can
    mask a real accent/pronunciation error as noise-induced)."""
    zcr = features["zero_crossing_rate"]
    rms = features["rms_energy"]
    bandwidth = features["spectral_bandwidth"]
    harmonic_ratio = features["harmonic_ratio"]
    mfcc_var = features["mfcc_variance"]

    if rms < 0.01:
        return "clean"  # near-silence carries no reliable noise signal either way

    if harmonic_ratio < 0.35 and bandwidth > 2000:
        # low harmonic content + wide spectral spread: broadband, non-tonal energy
        return "machinery"
    if zcr > 0.15 and mfcc_var > 80:
        # high zero-crossing rate + unstable spectral envelope: overlapping voices
        return "crowd"
    if bandwidth > 1500 and rms > 0.05 and harmonic_ratio >= 0.35:
        # persistent broadband low-harmonic energy without the crowd's ZCR signature
        return "traffic"
    if 0.3 <= harmonic_ratio < 0.6 and bandwidth < 1500:
        # moderate reverberant coloration, not clearly tonal or broadband
        return "indoor"
    return "clean"


def fingerprint(audio: np.ndarray, sr: int) -> dict:
    """Full pipeline: extract + classify. Single entry point for callers."""
    features = extract_features(audio, sr)
    category = classify(features)
    return {"noise_category": category, "features": features}
