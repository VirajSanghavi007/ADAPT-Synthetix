import sys
from pathlib import Path

import numpy as np
import pytest
from scipy.io import wavfile

ROOT = Path(__file__).resolve().parent.parent
BACKEND = ROOT / "Backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

import tts_engine


@pytest.fixture
def fake_tts(monkeypatch):
    def _pipeline(text):
        if not text:
            raise ValueError("Text cannot be empty")
        return {
            "audio": np.zeros(16000, dtype=np.float32),
            "sampling_rate": 16000,
        }

    monkeypatch.setattr(tts_engine, "_tts_pipeline", _pipeline)
    monkeypatch.setattr(tts_engine, "TTS_AVAILABLE", True)


@pytest.mark.slow
def test_synthesize_creates_wav_file(tmp_path, fake_tts):
    output_path = tmp_path / "tts.wav"
    result_path, _ = tts_engine.synthesize("hello", str(output_path))
    assert Path(result_path).exists()
    sr, data = wavfile.read(result_path)
    assert sr > 0
    assert len(data) > 0


@pytest.mark.slow
def test_synthesize_returns_valid_path(tmp_path, fake_tts):
    output_path = tmp_path / "valid.wav"
    result_path, _ = tts_engine.synthesize("adapt synthetix", str(output_path))
    assert result_path == str(output_path)


@pytest.mark.slow
def test_synthesize_handles_empty_text(tmp_path, fake_tts):
    output_path = tmp_path / "empty.wav"
    with pytest.raises(ValueError):
        tts_engine.synthesize("", str(output_path))
