import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
BACKEND = ROOT / "Backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from noise_fingerprint import NoiseFingerprinter


def test_extract_features_returns_all_8_keys():
    audio = np.random.randn(16000).astype(np.float32)
    features = NoiseFingerprinter().extract_features(audio, 16000)
    assert set(features.keys()) == {
        "spectral_centroid",
        "spectral_bandwidth",
        "spectral_rolloff",
        "zero_crossing_rate",
        "rms_energy",
        "mfcc_variance",
        "tempo",
        "harmonic_ratio",
    }


def test_classify_silence_returns_clean():
    silence = np.zeros(16000, dtype=np.float32)
    result = NoiseFingerprinter().fingerprint(silence, 16000)
    assert result["noise_type"] == "clean"


def test_fingerprint_returns_noise_type_plus_features():
    audio = np.random.randn(16000).astype(np.float32)
    result = NoiseFingerprinter().fingerprint(audio, 16000)
    assert "noise_type" in result
    for key in (
        "spectral_centroid",
        "spectral_bandwidth",
        "spectral_rolloff",
        "zero_crossing_rate",
        "rms_energy",
        "mfcc_variance",
        "tempo",
        "harmonic_ratio",
    ):
        assert key in result


def test_compare_identical_fingerprints_returns_high_similarity():
    audio = np.random.randn(16000).astype(np.float32)
    fingerprinter = NoiseFingerprinter()
    fp = fingerprinter.fingerprint(audio, 16000)
    comparison = fingerprinter.compare(fp, fp)
    assert comparison["similarity"] > 0.9
