import sys
from pathlib import Path

import numpy as np
import torch

ROOT = Path(__file__).resolve().parent.parent
BACKEND = ROOT / "Backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

import diagnostics


def test_calculate_cer_perfect_match_returns_zero():
    assert diagnostics.calculate_cer("hello world", "hello world") == 0.0


def test_calculate_cer_complete_mismatch():
    value = diagnostics.calculate_cer("hello world", "xyz")
    assert value is not None
    assert value > 0.5


def test_calculate_cer_handles_empty_reference():
    assert diagnostics.calculate_cer("", "anything") is None
    assert diagnostics.calculate_cer(None, "anything") is None


def test_extract_phonemes_returns_list():
    phonemes = diagnostics.extract_phonemes("hello")
    assert isinstance(phonemes, list)
    assert len(phonemes) > 0


def test_classify_noise_profile_clean_audio():
    silence = np.zeros(16000, dtype=np.float32)
    result = diagnostics.classify_noise_profile(silence)
    assert result["noise_type"] == "clean"


def test_classify_noise_profile_returns_all_features():
    audio = np.random.rand(16000).astype(np.float32) * 0.01
    result = diagnostics.classify_noise_profile(audio)
    assert set(result.keys()) == {
        "noise_type",
        "spectral_centroid",
        "zero_crossing_rate",
        "rms_energy",
        "mfcc_variance",
    }


def test_extract_confidence_returns_float_between_zero_and_one():
    logits = torch.randn(1, 10, 32)
    confidence = diagnostics.extract_confidence(logits)
    assert isinstance(confidence, float)
    assert 0.0 <= confidence <= 1.0


def test_classify_error_type_clean_audio_low_cer():
    result = diagnostics.classify_error_type(0.01, {"noise_type": "clean"}, 0.9)
    assert result == "clean"


def test_classify_error_type_noisy_audio():
    result = diagnostics.classify_error_type(0.25, {"noise_type": "traffic"}, 0.9)
    assert result == "noise"
