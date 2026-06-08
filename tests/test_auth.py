"""
test_auth.py — Tests for auth routes: /auth/email, /auth/backdoor, /auth/me.
"""
import importlib
import sys
import types
from pathlib import Path

import pytest

ROOT    = Path(__file__).resolve().parent.parent
BACKEND = ROOT / "Backend"
for p in [str(ROOT), str(BACKEND)]:
    if p not in sys.path:
        sys.path.insert(0, p)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _stub_heavy_modules(monkeypatch):
    """Stub out ML modules so the app can be imported without torch/transformers."""
    for name, attrs in [
        ("asr_module",   {"transcribe_audio_with_logits": lambda *a, **k: ("t", 1.0, None, [])}),
        ("tts_engine",   {"TTS_AVAILABLE": False, "synthesize": lambda *a: (a[1], 1.0), "load_tts": lambda: None}),
        ("diagnostics",  {
            "extract_confidence": lambda _: 0.9,
            "classify_noise_profile": lambda *a, **k: {"noise_type": "clean", "spectral_centroid": 0, "zero_crossing_rate": 0, "rms_energy": 0, "mfcc_variance": 0},
            "extract_token_uncertainty": lambda _: [],
            "nonconformity_score": lambda _: 0.1,
            "calculate_cer": lambda *a: None,
            "calculate_wer": lambda *a: None,
            "phoneme_error_rate": lambda *a: None,
            "classify_error_type": lambda *a: "clean",
            "extract_phonemes": lambda _: [],
            "align_phoneme_errors": lambda *a: {"errors": []},
            "estimate_snr": lambda _: 30.0,
        }),
    ]:
        m = types.ModuleType(name)
        for k, v in attrs.items():
            setattr(m, k, v)
        monkeypatch.setitem(sys.modules, name, m)


@pytest.fixture
def auth_client(monkeypatch):
    _stub_heavy_modules(monkeypatch)
    import app as backend_app
    module = importlib.reload(backend_app)
    from fastapi.testclient import TestClient
    return TestClient(module.app, raise_server_exceptions=False)


# ── /auth/email ───────────────────────────────────────────────────────────────

def test_email_signin_returns_200_and_ok(auth_client):
    res = auth_client.post("/auth/email", json={
        "name": "Test User", "email": "test@example.com", "accepted_terms": True
    })
    assert res.status_code == 200
    body = res.json()
    assert body["ok"] is True
    assert body["email"] == "test@example.com"


def test_email_signin_sets_x_auth_mode_header(auth_client):
    res = auth_client.post("/auth/email", json={
        "name": "Test User", "email": "test@example.com", "accepted_terms": True
    })
    assert res.status_code == 200
    assert res.headers.get("x-auth-mode") == "demo-unverified"


def test_email_signin_missing_fields_returns_422(auth_client):
    # Missing 'email' field
    res = auth_client.post("/auth/email", json={"name": "No Email", "accepted_terms": True})
    assert res.status_code == 422


def test_email_signin_terms_not_accepted_returns_400(auth_client):
    res = auth_client.post("/auth/email", json={
        "name": "Test", "email": "test@example.com", "accepted_terms": False
    })
    assert res.status_code == 400


def test_email_signin_invalid_email_returns_400(auth_client):
    res = auth_client.post("/auth/email", json={
        "name": "Test", "email": "not-an-email", "accepted_terms": True
    })
    assert res.status_code == 400


# ── /auth/backdoor ────────────────────────────────────────────────────────────

def test_backdoor_correct_key_returns_200(auth_client):
    res = auth_client.post("/auth/backdoor", json={"key": "test-backdoor-key"})
    assert res.status_code == 200
    assert res.json()["ok"] is True


def test_backdoor_wrong_key_returns_403(auth_client):
    res = auth_client.post("/auth/backdoor", json={"key": "wrong-key"})
    assert res.status_code == 403


# ── /auth/me ──────────────────────────────────────────────────────────────────

def test_me_with_valid_token_returns_user(auth_client):
    import os
    if os.environ.get("AUTH_ENABLED", "true").lower() == "false":
        pytest.skip("AUTH_ENABLED=false: /auth/me ignores cookies and returns dev user")
    # Sign in to get a session cookie
    login_res = auth_client.post("/auth/email", json={
        "name": "Alice", "email": "alice@example.com", "accepted_terms": True
    })
    assert login_res.status_code == 200
    # /auth/me with the cookie
    me_res = auth_client.get("/auth/me")
    assert me_res.status_code == 200
    body = me_res.json()
    assert body["email"] == "alice@example.com"
    assert body["name"] == "Alice"


def test_me_no_token_returns_401(auth_client):
    # Use a fresh client with no cookies
    from fastapi.testclient import TestClient
    import app as backend_app
    fresh = TestClient(backend_app.app, raise_server_exceptions=False)
    fresh.cookies.clear()
    res = fresh.get("/auth/me")
    # AUTH_ENABLED=false returns dev user — skip if so
    body = res.json()
    if res.status_code == 200 and body.get("dev_mode"):
        pytest.skip("AUTH_ENABLED=false; dev mode returns a placeholder user")
    assert res.status_code == 401
