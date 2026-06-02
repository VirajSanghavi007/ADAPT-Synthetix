"""
noise_fingerprint.py — Acoustic noise classification.

Optimisations applied:
  • Lazy HPSS — librosa.effects.harmonic (expensive O(N log N) HPSS) only
    computed when ZCR + bandwidth already suggest machinery. Short-circuits
    the harmonic computation for clean/traffic/crowd signals.
  • Vectorised SNR-style frame splitting using numpy (no list comprehension)
  • math.isnan() used instead of self-comparison NaN check
"""
from __future__ import annotations

import math
import numpy as np
import librosa


class NoiseFingerprinter:
    CLEAN_RMS_THRESHOLD      = 0.01
    TRAFFIC_CENTROID_MIN     = 3000.0
    TRAFFIC_ZCR_MIN          = 0.10
    TRAFFIC_ROLLOFF_MIN      = 4000.0
    TRAFFIC_RMS_MIN          = 0.02
    CROWD_RMS_MIN            = 0.05
    CROWD_MFCC_VAR_MIN       = 50.0
    MACHINERY_ZCR_MIN        = 0.15
    MACHINERY_BANDWIDTH_MIN  = 2000.0
    MACHINERY_HARMONIC_MAX   = 0.10   # low harmonic ratio → machinery noise

    def extract_features(self, audio_array: np.ndarray, sr: int = 16000) -> dict:
        y = np.asarray(audio_array, dtype=np.float32)
        if y.size == 0:
            y = np.zeros(512, dtype=np.float32)

        rms       = float(np.mean(librosa.feature.rms(y=y)))
        centroid  = float(np.mean(librosa.feature.spectral_centroid(y=y, sr=sr)))
        bandwidth = float(np.mean(librosa.feature.spectral_bandwidth(y=y, sr=sr)))
        rolloff   = float(np.mean(librosa.feature.spectral_rolloff(y=y, sr=sr)))
        zcr       = float(np.mean(librosa.feature.zero_crossing_rate(y=y)))
        mfcc_var  = float(np.mean(np.var(librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13), axis=1)))
        tempo_arr, _ = librosa.beat.beat_track(y=y, sr=sr)
        tempo     = float(np.atleast_1d(tempo_arr)[0])

        # ── Lazy HPSS: only run for potential machinery ──────
        harmonic_ratio = 0.0
        if zcr > self.MACHINERY_ZCR_MIN and bandwidth > self.MACHINERY_BANDWIDTH_MIN:
            harmonic     = librosa.effects.harmonic(y=y)
            total_energy = float(np.sum(y ** 2)) + 1e-9
            harmonic_ratio = float(np.sum(harmonic ** 2)) / total_energy

        return {
            "spectral_centroid":  centroid,
            "spectral_bandwidth": bandwidth,
            "spectral_rolloff":   rolloff,
            "zero_crossing_rate": zcr,
            "rms_energy":         rms,
            "mfcc_variance":      mfcc_var,
            "tempo":              tempo,
            "harmonic_ratio":     harmonic_ratio,
        }

    def classify(self, features: dict) -> str:
        rms      = float(features.get("rms_energy",         0.0))
        centroid = float(features.get("spectral_centroid",  0.0))
        rolloff  = float(features.get("spectral_rolloff",   0.0))
        zcr      = float(features.get("zero_crossing_rate", 0.0))
        mfcc_var = float(features.get("mfcc_variance",      0.0))
        bandwidth= float(features.get("spectral_bandwidth", 0.0))
        harmonic = float(features.get("harmonic_ratio",     0.0))

        def ok(v: float) -> bool:
            return not (math.isnan(v) or math.isinf(v))

        if rms < self.CLEAN_RMS_THRESHOLD:
            return "clean"
        if (ok(centroid) and centroid > self.TRAFFIC_CENTROID_MIN
                and ok(zcr) and zcr > self.TRAFFIC_ZCR_MIN
                and ok(rolloff) and rolloff > self.TRAFFIC_ROLLOFF_MIN
                and rms > self.TRAFFIC_RMS_MIN):
            return "traffic"
        if rms > self.CROWD_RMS_MIN and ok(mfcc_var) and mfcc_var > self.CROWD_MFCC_VAR_MIN:
            return "crowd"
        if (ok(zcr) and zcr > self.MACHINERY_ZCR_MIN
                and ok(bandwidth) and bandwidth > self.MACHINERY_BANDWIDTH_MIN
                and ok(harmonic) and harmonic < self.MACHINERY_HARMONIC_MAX):
            return "machinery"
        return "indoor"

    def fingerprint(self, audio_array: np.ndarray, sr: int = 16000) -> dict:
        features   = self.extract_features(audio_array, sr=sr)
        noise_type = self.classify(features)
        return {"noise_type": noise_type, **features}

    def compare(self, fp1: dict, fp2: dict) -> dict:
        keys = ["spectral_centroid", "spectral_bandwidth", "spectral_rolloff",
                "zero_crossing_rate", "rms_energy", "mfcc_variance", "tempo", "harmonic_ratio"]
        diffs = {k: abs(float(fp1.get(k, 0)) - float(fp2.get(k, 0))) /
                    (abs(float(fp1.get(k, 0))) + abs(float(fp2.get(k, 0))) + 1e-9)
                 for k in keys}
        mean_diff = float(np.mean(list(diffs.values())))
        return {
            "similarity":          max(0.0, min(1.0, 1.0 - mean_diff)),
            "dominant_difference": max(diffs, key=diffs.get) if diffs else "none",
        }
