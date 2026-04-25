import atexit
import json
import os
import shutil
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

import librosa
import diagnostics
import tts_engine
from asr_module import transcribe_audio_with_logits
from config import DB_PATH, TEMP_DIR, RAW_AUDIO_DIR
from database import (
    get_recent_sessions,
    get_remediation_status,
    log_transcription,
    update_diagnostics,
    update_remedial_path,
)
from drift_detector import DriftDetector
from dataset_manager import DatasetManager
from fastapi import BackgroundTasks, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from priority_queue import (
    EMERGENCY_VOCABULARY,
    MEDICAL_VOCABULARY,
    RemediationPriorityQueue,
)
from session_logger import SessionLogger


session_logger = SessionLogger()
SESSION_ID = str(uuid.uuid4())
TRANSCRIPTION_COUNT = 0
BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BACKEND_DIR.parent
LOGS_DIR = BACKEND_DIR / "logs"
DATA_AUDIO_DIR = BACKEND_DIR / "data" / "audio"
SESSION_STARTED_AT = datetime.now().isoformat()
SESSION_LOG_PATH = LOGS_DIR / f"session_{datetime.now().isoformat().replace(':', '-')}_{SESSION_ID[:8]}.txt"

LOGS_DIR.mkdir(parents=True, exist_ok=True)
DATA_AUDIO_DIR.mkdir(parents=True, exist_ok=True)
Path(TEMP_DIR).mkdir(parents=True, exist_ok=True)
_ = RAW_AUDIO_DIR
drift_detector = DriftDetector(DB_PATH)
priority_queue = RemediationPriorityQueue(DB_PATH)
dataset_manager = DatasetManager(dataset_dir=str(PROJECT_DIR / "Dataset"))
ALLOWED_EXTENSIONS = {"wav", "mp3", "webm", "m4a", "ogg", "flac"}

with open(SESSION_LOG_PATH, "w", encoding="utf-8") as session_log_file:
    session_log_file.write("ADAPT-Synthetix Session Log\n")
    session_log_file.write(f"Session ID : {SESSION_ID}\n")
    session_log_file.write(f"Started    : {SESSION_STARTED_AT}\n")
    session_log_file.write("=====================================\n")


def _write_session_footer() -> None:
    with open(SESSION_LOG_PATH, "a", encoding="utf-8") as session_log_file:
        session_log_file.write("=====================================\n")
        session_log_file.write(f"Session Ended : {datetime.now().isoformat()}\n")
        session_log_file.write(f"Total Transcriptions : {TRANSCRIPTION_COUNT}\n")
        session_log_file.write("=====================================\n")


def remediate_async(row_id: int, transcription: str, error_type: str, queue_id: Optional[int] = None) -> None:
    try:
        remedial_timestamp = datetime.now().strftime("%Y%m%dT%H%M%S%f")
        output_path = DATA_AUDIO_DIR / f"remedial_{remedial_timestamp}_{row_id}.wav"
        tts_engine.synthesize(transcription, str(output_path))
        update_remedial_path(row_id, str(output_path))
        if queue_id is not None:
            priority_queue.mark_completed(queue_id)
        print(f"[AUTO-REMEDIATION] row {row_id} -> {output_path}")
    except Exception as exc:
        print(f"[AUTO-REMEDIATION][ERROR] row {row_id}: {exc}")


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


class SynthesisRequest(BaseModel):
    text: str = ""


atexit.register(_write_session_footer)

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event() -> None:
    session_logger.log("STARTUP", "FastAPI application initialized")
    _ = tts_engine.TTS_AVAILABLE


@app.get("/")
async def index():
    frontend_index = PROJECT_DIR / "Frontend" / "index.html"
    if not frontend_index.exists():
        raise HTTPException(status_code=404, detail="Frontend index not found")
    return FileResponse(str(frontend_index))


@app.post("/transcribe")
async def transcribe(background_tasks: BackgroundTasks, audio: Optional[UploadFile] = File(default=None)):
    global TRANSCRIPTION_COUNT
    session_logger.log("API_REQUEST", "/transcribe")

    if audio is None:
        return JSONResponse({"error": "No audio part"}, status_code=400)
    if not audio.filename:
        return JSONResponse({"error": "No selected file"}, status_code=400)
    if not allowed_file(audio.filename):
        return JSONResponse({"error": "Unsupported file format"}, status_code=400)

    filename = f"{uuid.uuid4()}_{audio.filename}"
    filepath = Path(TEMP_DIR) / filename
    with open(filepath, "wb") as file_obj:
        file_obj.write(await audio.read())

    try:
        transcription, duration, logits, audio_input = transcribe_audio_with_logits(str(filepath))
        audio_duration = librosa.get_duration(y=audio_input, sr=16000)
        confidence_score = diagnostics.extract_confidence(logits)
        noise_profile = diagnostics.classify_noise_profile(audio_input)
        noise_profile_json = json.dumps(noise_profile)
        timestamp = datetime.now().isoformat()
        permanent_filename = f"{timestamp.replace(':', '-')}_{filename}"
        permanent_audio_path = DATA_AUDIO_DIR / permanent_filename
        shutil.copy2(filepath, permanent_audio_path)
        row_id = log_transcription(
            session_id=SESSION_ID,
            audio_filename=filename,
            audio_path=str(permanent_audio_path),
            transcription=transcription,
            duration=audio_duration,
            model="wav2vec2-base-960h",
        )
        cer_score = None
        if noise_profile.get("noise_type") != "clean":
            error_type = "noise"
        elif confidence_score < 0.4:
            error_type = "accent"
        else:
            error_type = "clean"

        update_diagnostics(
            row_id=row_id,
            cer_score=cer_score,
            error_type=error_type,
            confidence_score=confidence_score,
            noise_profile=noise_profile_json,
        )
        phonemes = diagnostics.extract_phonemes(transcription)
        drift_detector.record_phoneme_confidence(SESSION_ID, phonemes, confidence_score)
        if drift_detector.should_trigger_retraining():
            print("[DRIFT ALERT] Retraining threshold reached")

        queue_id = None
        if error_type != "clean":
            queue_id = priority_queue.enqueue(row_id, transcription, error_type, confidence_score)

        if error_type != "clean" and tts_engine.TTS_AVAILABLE:
            background_tasks.add_task(remediate_async, row_id, transcription, error_type, queue_id)

        with open(SESSION_LOG_PATH, "a", encoding="utf-8") as session_log_file:
            session_log_file.write("=====================================\n")
            session_log_file.write(f"Timestamp     : {timestamp}\n")
            session_log_file.write(f"Audio File    : {filename}\n")
            session_log_file.write(f"Duration      : {audio_duration:.2f} seconds\n")
            session_log_file.write("Transcription :\n")
            session_log_file.write(f"{transcription}\n")
            session_log_file.write("=====================================\n")
        TRANSCRIPTION_COUNT += 1
        session_logger.log("TRANSCRIPTION_DONE", f"Text: {transcription[:50]}... | Duration: {duration}s")

        return {
            "transcription": transcription,
            "duration": duration,
            "status": "success",
            "confidence": confidence_score,
            "error_type": error_type,
            "noise_type": noise_profile.get("noise_type", "clean"),
        }
    except Exception as exc:
        session_logger.log("TRANSCRIPTION_ERROR", str(exc))
        return JSONResponse({"error": str(exc)}, status_code=500)


@app.post("/synthesize")
async def synthesize_route(payload: SynthesisRequest):
    session_logger.log("API_REQUEST", "/synthesize")
    if not tts_engine.TTS_AVAILABLE:
        return JSONResponse({"error": "TTS model not loaded"}, status_code=400)

    text = (payload.text or "")
    if not isinstance(text, str) or not text.strip():
        return JSONResponse({"error": "No text provided"}, status_code=400)

    try:
        timestamp = datetime.now().strftime("%Y%m%dT%H%M%S%f")
        filename = f"tts_{timestamp}.wav"
        output_path = DATA_AUDIO_DIR / filename
        filepath, duration = tts_engine.synthesize(text.strip(), str(output_path))
        session_logger.log("SYNTHESIS_DONE", f"Generated: {filename} | Duration: {duration:.2f}s")
        return FileResponse(
            path=filepath,
            media_type="audio/wav",
            filename=filename,
        )
    except Exception as exc:
        session_logger.log("SYNTHESIS_ERROR", str(exc))
        return JSONResponse({"error": str(exc)}, status_code=500)


@app.get("/tts_status")
async def tts_status():
    return {"available": tts_engine.TTS_AVAILABLE, "model": "suno/bark-small"}


@app.get("/sessions")
async def get_sessions():
    try:
        sessions = get_recent_sessions(limit=20)
        return sessions
    except Exception as exc:
        return JSONResponse({"error": str(exc)}, status_code=500)


@app.get("/remediation_status")
async def remediation_status():
    try:
        return get_remediation_status()
    except Exception as exc:
        return JSONResponse({"error": str(exc)}, status_code=500)


@app.get("/drift_report")
async def drift_report():
    try:
        return drift_detector.get_drift_report()
    except Exception as exc:
        return JSONResponse({"error": str(exc)}, status_code=500)


@app.get("/noise_report")
async def noise_report():
    try:
        sessions = get_recent_sessions(limit=50)
        breakdown = {
            "clean": 0,
            "traffic": 0,
            "crowd": 0,
            "machinery": 0,
            "indoor": 0,
        }
        rms_values = []
        centroid_values = []

        for session in sessions:
            profile_raw = session.get("noise_profile")
            if not profile_raw:
                continue

            try:
                profile = json.loads(profile_raw) if isinstance(profile_raw, str) else profile_raw
            except (TypeError, json.JSONDecodeError):
                continue

            if not isinstance(profile, dict):
                continue

            noise_type = str(profile.get("noise_type", "indoor")).lower()
            if noise_type not in breakdown:
                noise_type = "indoor"
            breakdown[noise_type] += 1

            rms = profile.get("rms_energy")
            centroid = profile.get("spectral_centroid")
            if isinstance(rms, (int, float)):
                rms_values.append(float(rms))
            if isinstance(centroid, (int, float)):
                centroid_values.append(float(centroid))

        total_analyzed = sum(breakdown.values())
        most_common = max(breakdown, key=breakdown.get) if total_analyzed > 0 else "indoor"
        avg_rms_energy = round(sum(rms_values) / len(rms_values), 6) if rms_values else 0.0
        avg_spectral_centroid = round(sum(centroid_values) / len(centroid_values), 4) if centroid_values else 0.0

        return {
            "total_analyzed": total_analyzed,
            "breakdown": breakdown,
            "most_common": most_common,
            "avg_rms_energy": avg_rms_energy,
            "avg_spectral_centroid": avg_spectral_centroid,
        }
    except Exception as exc:
        return JSONResponse({"error": str(exc)}, status_code=500)


@app.get("/priority_queue")
async def priority_queue_report():
    try:
        return {
            "queue": priority_queue.get_queue(limit=20),
            "stats": priority_queue.get_stats(),
        }
    except Exception as exc:
        return JSONResponse({"error": str(exc)}, status_code=500)


@app.get("/vocabulary_check")
async def vocabulary_check(text: str = ""):
    normalized_words = []
    for token in str(text or "").lower().split():
        cleaned = "".join(ch for ch in token if ch.isalpha())
        if cleaned:
            normalized_words.append(cleaned)

    unique_words = set(normalized_words)
    medical_matches = sorted([word for word in unique_words if word in MEDICAL_VOCABULARY])
    emergency_matches = sorted([word for word in unique_words if word in EMERGENCY_VOCABULARY])
    is_domain_critical = bool(medical_matches or emergency_matches)
    return {
        "medical_matches": medical_matches,
        "emergency_matches": emergency_matches,
        "is_domain_critical": is_domain_critical,
    }


@app.get("/dataset_stats")
async def dataset_stats():
    try:
        return dataset_manager.get_stats()
    except Exception as exc:
        return JSONResponse({"error": str(exc)}, status_code=500)


@app.get("/lora_status")
async def lora_status():
    try:
        lora_dir = BACKEND_DIR / "models" / "lora"
        lora_dir.mkdir(parents=True, exist_ok=True)

        epoch_dirs = sorted([p for p in lora_dir.glob("epoch_*") if p.is_dir()])
        logs = sorted([p.name for p in lora_dir.glob("training_log_*.json") if p.is_file()])

        last_trained = None
        if logs:
            last_log_path = lora_dir / logs[-1]
            with open(last_log_path, "r", encoding="utf-8") as log_file:
                log_data = json.load(log_file)
            if isinstance(log_data, dict):
                last_trained = log_data.get("trained_at")
            if not last_trained:
                last_trained = datetime.fromtimestamp(last_log_path.stat().st_mtime).isoformat()

        return {
            "adapter_exists": bool(epoch_dirs),
            "last_trained": last_trained,
            "training_logs": logs,
        }
    except Exception as exc:
        return JSONResponse({"error": str(exc)}, status_code=500)


@app.get("/temp/{filename:path}")
async def serve_temp(filename: str):
    session_logger.log("API_REQUEST", f"/temp/{filename}")
    file_path = Path(TEMP_DIR) / filename
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(str(file_path))


@app.get("/health")
async def health():
    session_logger.log("API_REQUEST", "/health")
    return {
        "status": "healthy",
        "asr": "wav2vec2-base-960h",
        "tts": "suno/bark-small",
        "session_id": SESSION_ID,
    }
