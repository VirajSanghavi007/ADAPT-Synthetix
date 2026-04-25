import os
import uuid
import shutil
import atexit
import json
from datetime import datetime
from pathlib import Path

import librosa
from flask import Flask, request, jsonify, send_from_directory, send_file
from flask_cors import CORS
from asr_module import transcribe_audio_with_logits
from config import DB_PATH, TEMP_DIR, RAW_AUDIO_DIR
from session_logger import SessionLogger
from database import log_transcription, get_recent_sessions, update_diagnostics
import diagnostics
import tts_engine

# Initialize Logger
session_logger = SessionLogger()
SESSION_ID = str(uuid.uuid4())
TRANSCRIPTION_COUNT = 0
BACKEND_DIR = Path(__file__).resolve().parent
LOGS_DIR = BACKEND_DIR / "logs"
DATA_AUDIO_DIR = BACKEND_DIR / "data" / "audio"
SESSION_STARTED_AT = datetime.now().isoformat()
SESSION_LOG_PATH = LOGS_DIR / f"session_{datetime.now().isoformat().replace(':', '-')}_{SESSION_ID[:8]}.txt"

LOGS_DIR.mkdir(parents=True, exist_ok=True)
DATA_AUDIO_DIR.mkdir(parents=True, exist_ok=True)

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


atexit.register(_write_session_footer)

app = Flask(__name__, 
            static_folder='../frontend', 
            static_url_path='')
CORS(app)

# Configuration
app.config['UPLOAD_FOLDER'] = str(TEMP_DIR)
ALLOWED_EXTENSIONS = {"wav", "mp3", "webm", "m4a", "ogg", "flac"}


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/')
def index():
    return app.send_static_file('index.html')

@app.route('/transcribe', methods=['POST'])
def transcribe():
    global TRANSCRIPTION_COUNT
    session_logger.log("API_REQUEST", "/transcribe")
    if 'audio' not in request.files:
        return jsonify({"error": "No audio part"}), 400
    
    file = request.files['audio']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
    if not allowed_file(file.filename):
        return jsonify({"error": "Unsupported file format"}), 400
    
    filename = str(uuid.uuid4()) + "_" + file.filename
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(filepath)
    
    try:
        transcription, duration, logits, audio_input = transcribe_audio_with_logits(filepath)
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
        
        return jsonify({
            "transcription": transcription,
            "duration": duration,
            "status": "success",
            "confidence": confidence_score,
            "error_type": error_type,
            "noise_type": noise_profile.get("noise_type", "clean"),
        })
    except Exception as e:
        session_logger.log("TRANSCRIPTION_ERROR", str(e))
        return jsonify({"error": str(e)}), 500

@app.route('/synthesize', methods=['POST'])
def synthesize_route():
    session_logger.log("API_REQUEST", "/synthesize")
    if not tts_engine.TTS_AVAILABLE:
        return jsonify({"error": "TTS model not loaded"}), 400

    data = request.get_json()
    text = (data or {}).get("text", "")
    if not isinstance(text, str) or not text.strip():
        return jsonify({"error": "No text provided"}), 400
    
    try:
        timestamp = datetime.now().strftime("%Y%m%dT%H%M%S%f")
        filename = f"tts_{timestamp}.wav"
        output_path = DATA_AUDIO_DIR / filename
        filepath, duration = tts_engine.synthesize(text.strip(), str(output_path))
        session_logger.log("SYNTHESIS_DONE", f"Generated: {filename} | Duration: {duration:.2f}s")
        return send_file(filepath, as_attachment=True, download_name=filename, mimetype="audio/wav")
    except Exception as e:
        session_logger.log("SYNTHESIS_ERROR", str(e))
        return jsonify({"error": str(e)}), 500


@app.route('/tts_status', methods=['GET'])
def tts_status():
    return jsonify({"available": tts_engine.TTS_AVAILABLE, "model": "suno/bark-small"})

@app.route('/sessions', methods=['GET'])
def get_sessions():
    try:
        sessions = get_recent_sessions(limit=20)
        return jsonify(sessions)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/temp/<path:filename>')
def serve_temp(filename):
    session_logger.log("API_REQUEST", f"/temp/{filename}")
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/health', methods=['GET'])
def health():
    session_logger.log("API_REQUEST", "/health")
    return jsonify({"status": "healthy", "asr": "wav2vec2", "tts": "pyttsx3"}), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
