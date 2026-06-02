"""
Comprehensive diagnostics tests — covers all research-backed features:
CTC uncertainty (Rumberg 2023), temperature scaling (arXiv:2509.07195),
nonconformity score (Ernez PMLR 2023), WER/PER metrics, SNR estimation,
phoneme alignment, and error classification with SNR signal.
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'Backend'))

import numpy as np
import pytest
import torch

import diagnostics


# ── Fixtures ──────────────────────────────────────────────────

@pytest.fixture
def confident_logits():
    t = torch.zeros(1, 10, 32)
    t[0, :, 0] = 8.0  # class 0 strongly dominates
    return t

@pytest.fixture
def uniform_logits():
    return torch.zeros(1, 8, 32)  # uniform → max prob = 1/32


# ── extract_confidence ────────────────────────────────────────

class TestExtractConfidence:
    def test_high_confidence(self, confident_logits):
        c = diagnostics.extract_confidence(confident_logits)
        assert c > 0.9

    def test_temperature_lowers_confidence(self, confident_logits):
        c1 = diagnostics.extract_confidence(confident_logits, temperature=1.0)
        c2 = diagnostics.extract_confidence(confident_logits, temperature=4.0)
        assert c2 < c1

    def test_uniform_low_confidence(self, uniform_logits):
        c = diagnostics.extract_confidence(uniform_logits)
        assert c < 0.1

    def test_returns_float_in_range(self, confident_logits):
        c = diagnostics.extract_confidence(confident_logits)
        assert isinstance(c, float)
        assert 0.0 <= c <= 1.0


# ── extract_token_uncertainty ─────────────────────────────────

class TestTokenUncertainty:
    def test_length(self, confident_logits):
        h = diagnostics.extract_token_uncertainty(confident_logits)
        assert len(h) == confident_logits.shape[1]  # 10 frames

    def test_confident_frames_low_entropy(self, confident_logits):
        h = diagnostics.extract_token_uncertainty(confident_logits)
        assert all(v < 0.5 for v in h)

    def test_all_floats(self, uniform_logits):
        h = diagnostics.extract_token_uncertainty(uniform_logits)
        assert all(isinstance(v, float) for v in h)


# ── nonconformity_score ───────────────────────────────────────

class TestNonconformity:
    def test_high_confidence_low_ncs(self):
        assert diagnostics.nonconformity_score(0.95) == pytest.approx(0.05, abs=0.001)

    def test_low_confidence_high_ncs(self):
        assert diagnostics.nonconformity_score(0.20) == pytest.approx(0.80, abs=0.001)

    def test_always_in_range(self):
        for c in [0.0, 0.25, 0.5, 0.75, 1.0]:
            ncs = diagnostics.nonconformity_score(c)
            assert 0.0 <= ncs <= 1.0


# ── Error rates ───────────────────────────────────────────────

class TestErrorRates:
    def test_cer_perfect(self):
        assert diagnostics.calculate_cer("hello world", "hello world") == 0.0

    def test_wer_perfect(self):
        assert diagnostics.calculate_wer("hello world", "hello world") == 0.0

    def test_cer_none_reference(self):
        assert diagnostics.calculate_cer(None, "hello") is None

    def test_wer_none_reference(self):
        assert diagnostics.calculate_wer(None, "hello") is None

    def test_cer_positive_on_mismatch(self):
        assert diagnostics.calculate_cer("abc", "xyz") > 0

    def test_per_none_reference(self):
        assert diagnostics.phoneme_error_rate(None, "hello") is None

    def test_per_positive_on_mismatch(self):
        per = diagnostics.phoneme_error_rate("hello", "world")
        assert per is not None and per > 0


# ── classify_error_type ───────────────────────────────────────

class TestClassifyErrorType:
    def test_clean(self):
        r = diagnostics.classify_error_type(0.0, {"noise_type": "clean"}, 0.95)
        assert r == "clean"

    def test_noise_noisy_profile_no_ref(self):
        r = diagnostics.classify_error_type(None, {"noise_type": "traffic"}, 0.8)
        assert r == "noise"

    def test_accent_low_conf(self):
        r = diagnostics.classify_error_type(None, {"noise_type": "clean"}, 0.2)
        assert r == "accent"

    def test_pronunciation_via_cer(self):
        r = diagnostics.classify_error_type(0.15, {"noise_type": "clean"}, 0.8)
        assert r == "pronunciation"

    def test_none_noise_profile_safe(self):
        # Must not raise AttributeError
        r = diagnostics.classify_error_type(None, None, 0.5)
        assert r in {"noise", "accent", "clean", "pronunciation"}

    def test_snr_low_promotes_noise(self):
        # Even with clean noise_type, low SNR should push toward noise
        r = diagnostics.classify_error_type(None, {"noise_type": "clean"}, 0.8, snr_db=5.0)
        assert r == "noise"

    def test_high_snr_no_effect_on_clean(self):
        r = diagnostics.classify_error_type(0.0, {"noise_type": "clean"}, 0.95, snr_db=40.0)
        assert r == "clean"


# ── estimate_snr ──────────────────────────────────────────────

class TestEstimateSNR:
    def test_returns_float(self):
        y = np.zeros(16000, dtype=np.float32)
        snr = diagnostics.estimate_snr(y)
        assert isinstance(snr, float)

    def test_sinusoid_returns_float(self):
        t = np.linspace(0, 1, 16000, dtype=np.float32)
        y = np.sin(2 * np.pi * 440 * t) * 0.5
        snr = diagnostics.estimate_snr(y)
        # SNR for a pure sinusoid is implementation-dependent; just check type and range
        assert isinstance(snr, float)
        assert -10.0 <= snr <= 60.0

    def test_bounded(self):
        y = np.random.randn(16000).astype(np.float32)
        snr = diagnostics.estimate_snr(y)
        assert -10.0 <= snr <= 60.0


# ── align_phoneme_errors ──────────────────────────────────────

class TestPhonemeAlignment:
    def test_identical(self):
        result = diagnostics.align_phoneme_errors("hello", "hello")
        assert result["distance"] == 0
        assert result["errors"] == []

    def test_mismatch_has_errors(self):
        result = diagnostics.align_phoneme_errors("cat", "bat")
        assert len(result["errors"]) > 0

    def test_error_operations_valid(self):
        result = diagnostics.align_phoneme_errors("hello world", "jello world")
        for e in result["errors"]:
            assert e["operation"] in {"substitution", "deletion", "insertion"}

    def test_keys_present(self):
        result = diagnostics.align_phoneme_errors("hello", "world")
        for key in ("reference_phonemes", "hypothesis_phonemes", "distance", "errors"):
            assert key in result
