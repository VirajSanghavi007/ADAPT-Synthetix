import importlib
import io
import sys
import types
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
BACKEND = ROOT / "Backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))


@pytest.fixture
def app_client(monkeypatch):
    fake_asr = types.ModuleType("asr_module")
    fake_asr.transcribe_audio_with_logits = lambda *_args, **_kwargs: ("test transcript", 1.0, None, [0.0])
    monkeypatch.setitem(sys.modules, "asr_module", fake_asr)

    fake_tts = types.ModuleType("tts_engine")
    fake_tts.TTS_AVAILABLE = True
    fake_tts.synthesize = lambda text, output_path: (output_path, 1.0)
    monkeypatch.setitem(sys.modules, "tts_engine", fake_tts)

    fake_diag = types.ModuleType("diagnostics")
    fake_diag.extract_confidence = lambda _logits: 0.9
    fake_diag.classify_noise_profile = lambda _audio, sr=16000: {
        "noise_type": "clean",
        "spectral_centroid": 0.0,
        "zero_crossing_rate": 0.0,
        "rms_energy": 0.0,
        "mfcc_variance": 0.0,
    }
    monkeypatch.setitem(sys.modules, "diagnostics", fake_diag)

    import app as backend_app

    module = importlib.reload(backend_app)
    module.app.config["TESTING"] = True
    return module.app.test_client()


def test_health_endpoint_returns_200(app_client):
    response = app_client.get("/health")
    assert response.status_code == 200
    data = response.get_json()
    assert data["status"] == "healthy"


def test_transcribe_no_file_returns_400(app_client):
    response = app_client.post("/transcribe", data={})
    assert response.status_code == 400


def test_transcribe_invalid_format_returns_400(app_client):
    data = {
        "audio": (io.BytesIO(b"plain text data"), "sample.txt"),
    }
    response = app_client.post("/transcribe", data=data, content_type="multipart/form-data")
    assert response.status_code == 400


def test_sessions_endpoint_returns_list(app_client):
    response = app_client.get("/sessions")
    assert response.status_code == 200
    payload = response.get_json()
    assert isinstance(payload, list)


def test_tts_status_endpoint(app_client):
    response = app_client.get("/tts_status")
    assert response.status_code == 200
    payload = response.get_json()
    assert "available" in payload
    assert "model" in payload
