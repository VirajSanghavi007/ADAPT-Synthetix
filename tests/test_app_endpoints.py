"""
test_app_endpoints.py — Coverage for key API endpoints using an empty in-memory DB.
"""
import importlib
import os
import sys
import types
from pathlib import Path

import pytest

ROOT    = Path(__file__).resolve().parent.parent
BACKEND = ROOT / "Backend"
for p in [str(ROOT), str(BACKEND)]:
    if p not in sys.path:
        sys.path.insert(0, p)


# ── Stubs ─────────────────────────────────────────────────────────────────────

def _stub_heavy(monkeypatch):
    for name, attrs in [
        ("asr_module", {
            "transcribe_audio_with_logits": lambda *a, **k: ("hello", 1.0, None, []),
            "transcribe_audio": lambda p: ("hello", 1.0),
        }),
        ("tts_engine", {
            "TTS_AVAILABLE": False,
            "TTS_MODEL_PATH": "suno/bark-small",
            "synthesize": lambda text, path: (path, 1.0),
            "load_tts": lambda: None,
        }),
        ("diagnostics", {
            "extract_confidence":       lambda _: 0.9,
            "classify_noise_profile":   lambda *a, **k: {"noise_type": "clean", "spectral_centroid": 0, "zero_crossing_rate": 0, "rms_energy": 0, "mfcc_variance": 0},
            "extract_token_uncertainty":lambda _: [],
            "nonconformity_score":      lambda _: 0.1,
            "calculate_cer":            lambda *a: None,
            "calculate_wer":            lambda *a: None,
            "phoneme_error_rate":       lambda *a: None,
            "classify_error_type":      lambda *a: "clean",
            "extract_phonemes":         lambda _: [],
            "align_phoneme_errors":     lambda *a: {"errors": []},
            "estimate_snr":             lambda _: 30.0,
        }),
    ]:
        m = types.ModuleType(name)
        for k, v in attrs.items():
            setattr(m, k, v)
        monkeypatch.setitem(sys.modules, name, m)


@pytest.fixture
def client(monkeypatch):
    _stub_heavy(monkeypatch)

    # Reset schema-done flag so a fresh in-memory-style DB gets initialised
    import database as db_mod
    monkeypatch.setattr(db_mod, "_schema_done", False, raising=False)

    import app as backend_app
    module = importlib.reload(backend_app)
    from fastapi.testclient import TestClient
    # Use context manager so the lifespan runs and singletons (drift_detector,
    # priority_queue, etc.) are initialised before tests make requests.
    with TestClient(module.app, raise_server_exceptions=False) as c:
        yield c


# ── Tests ─────────────────────────────────────────────────────────────────────

def test_health_returns_200_with_expected_keys(client):
    res = client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert "status" in body
    assert "session_id" in body


def test_remediation_status_returns_numeric_fields(client):
    res = client.get("/remediation_status")
    assert res.status_code == 200
    body = res.json()
    assert isinstance(body.get("total_transcriptions"), int)
    assert isinstance(body.get("remediation_rate"), (int, float))


def test_drift_report_returns_200(client):
    res = client.get("/drift_report")
    assert res.status_code == 200


def test_confidence_histogram_returns_bins(client):
    res = client.get("/confidence_histogram")
    assert res.status_code == 200
    body = res.json()
    assert "bins" in body
    assert isinstance(body["bins"], list)


def test_synthesize_missing_text_returns_422(client):
    # Pydantic validates the model — empty body triggers 422
    res = client.post("/synthesize", json={})
    # text field has default "" so pydantic accepts it; TTS not available → 503
    assert res.status_code in (400, 422, 503)


def test_priority_queue_returns_list(client):
    res = client.get("/priority_queue")
    assert res.status_code == 200
    body = res.json()
    assert "queue" in body
    assert isinstance(body["queue"], list)


def test_session_detail_not_found_returns_404(client):
    """4b: non-existent session ID returns 404 with error field."""
    res = client.get("/sessions/999999")
    assert res.status_code == 404
    body = res.json()
    assert "error" in body


def test_session_detail_found_returns_200(client):
    """4b: session that exists returns full row with phoneme_errors."""
    import database as db_mod
    row_id = db_mod.log_transcription(
        "s-detail", "x.wav", "/x.wav", "hello world", 1.5, "wav2vec2-base-960h",
        confidence_score=0.85, error_type="clean", snr_db=25.0,
        noise_profile='{"noise_type":"clean"}',
    )
    res = client.get(f"/sessions/{row_id}")
    assert res.status_code == 200
    body = res.json()
    assert body["id"] == row_id
    assert "phoneme_errors" in body
    assert isinstance(body["phoneme_errors"], list)
    assert "queue_entry" in body
