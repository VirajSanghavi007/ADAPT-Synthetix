"""Mercury's API exposed as an MCP server (transcribe/TTS/models/error-report),
mounted into the FastAPI app at /mcp. Auth is the same X-API-Key mechanism as the
REST API — generate a key from the Account/API Keys page and use it as a Bearer
token or the mcp-session header your MCP client sends through to us.
"""
import base64

from mcp.server.fastmcp import Context, FastMCP
from starlette.requests import Request

from Backend.api_keys import require_api_key
from Backend.asr_pipeline import decode_audio, synthesize_speech, transcribe_audio
from Backend.db import ASRLog, PhonemeError, TTSLog, get_session
from Backend.phoneme_diagnostics import build_error_report
from Backend.tiers import ASR_CATALOG, TIER_MODELS, TTS_CATALOG, check_tier_rate_limit, get_user_tier, resolve_model

mcp = FastMCP("mercury", stateless_http=True)


def _authed_user(ctx: Context) -> dict:
    request: Request = ctx.request_context.request
    return require_api_key(request)


@mcp.tool()
def list_models(ctx: Context) -> dict:
    """List the ASR and TTS models available on the caller's subscription tier."""
    auth = _authed_user(ctx)
    tier = auth["tier"]
    allowed = TIER_MODELS.get(tier, TIER_MODELS["free"])
    return {
        "tier": tier,
        "asr": [{"id": m, "label": ASR_CATALOG[m]["label"]} for m in allowed["asr"]],
        "tts": [{"id": m, "label": TTS_CATALOG[m]["label"]} for m in allowed["tts"]],
    }


@mcp.tool()
def transcribe(ctx: Context, audio_base64: str, model_id: str | None = None) -> dict:
    """Transcribe base64-encoded audio (wav/mp3/ogg) to text using Mercury's ASR pipeline."""
    auth = _authed_user(ctx)
    tier = get_user_tier(auth["id"])
    check_tier_rate_limit(auth["id"], tier)
    resolved_model = resolve_model(tier, "asr", model_id)

    raw = base64.b64decode(audio_base64)
    audio, sr = decode_audio(raw)
    text = transcribe_audio(audio, sr, resolved_model)

    db = get_session()
    try:
        db.add(ASRLog(user_id=auth["id"], transcript=text, duration_sec=len(audio) / sr if sr else None, model_id=resolved_model))
        db.commit()
    finally:
        db.close()

    return {"text": text, "model_id": resolved_model}


@mcp.tool()
def synthesize(ctx: Context, text: str, voice: str = "", model_id: str | None = None) -> dict:
    """Synthesize speech from text using Mercury's TTS pipeline. Returns base64-encoded MP3 audio."""
    auth = _authed_user(ctx)
    tier = get_user_tier(auth["id"])
    check_tier_rate_limit(auth["id"], tier)
    resolved_model = resolve_model(tier, "tts", model_id)

    mp3_bytes = synthesize_speech(text, voice, resolved_model)
    if mp3_bytes is None:
        return {"error": "no audio generated"}

    db = get_session()
    try:
        db.add(TTSLog(user_id=auth["id"], input_text=text, voice=voice, model_id=resolved_model))
        db.commit()
    finally:
        db.close()

    return {"audio_base64": base64.b64encode(mp3_bytes).decode(), "model_id": resolved_model}


@mcp.tool()
def error_report(ctx: Context) -> dict:
    """Phoneme-level confusion-matrix report from all reference-aligned transcriptions."""
    _authed_user(ctx)  # any valid key may read the aggregate report
    db = get_session()
    try:
        rows = db.query(
            PhonemeError.operation, PhonemeError.reference_phoneme, PhonemeError.hypothesis_phoneme
        ).all()
    finally:
        db.close()

    counts: dict[tuple, int] = {}
    for operation, ref, hyp in rows:
        key = (operation, ref, hyp)
        counts[key] = counts.get(key, 0) + 1

    grouped = sorted(
        (
            {"operation": op, "reference_phoneme": ref, "hypothesis_phoneme": hyp, "count": n}
            for (op, ref, hyp), n in counts.items()
        ),
        key=lambda r: (-r["count"], r["operation"]),
    )
    return build_error_report(grouped)
