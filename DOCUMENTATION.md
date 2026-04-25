# ADAPT-Synthetix — Technical Documentation

## Table of Contents
1. Project Overview
2. System Architecture  
3. File Structure
4. Module Reference
5. API Reference
6. Database Schema
7. Pipeline Flow
8. Setup Guide
9. Testing
10. Roadmap
11. Research Contribution

## 1. Project Overview
ADAPT-Synthetix is a closed-loop speech framework that combines ASR, diagnostics, and TTS remediation into one pipeline. The backend accepts microphone audio chunks, transcribes speech with Wav2Vec2, and returns both text and diagnostic metadata to the client.

The system addresses a common limitation in baseline ASR demos: they output text but provide little explanation for why recognition quality changes. ADAPT-Synthetix adds intermediate measurements such as confidence and noise profile so each transcription can be interpreted, tracked, and compared over time.

The diagnostic layer is the core research novelty because it translates raw model outputs and signal features into error categories usable for adaptation. This enables future work on feedback-guided retraining and personalized correction strategies rather than one-pass transcription only.

## 2. System Architecture
```text
Audio Input
    |
    v
[ASR: Wav2Vec2]
    |
    v
[Diagnostics: Confidence + Noise Features]
    |
    v
[Error Classifier]
    |
    +--------------------------+
    |                          |
    v                          v
[TTS Remediation]       [Database Storage + Session Logs]
```

- **Ear**: Captures audio chunks, stores temporary uploads, and normalizes waveform input for model inference.
- **Brain**: Runs ASR and computes diagnostics (confidence, noise profile, and error type) for each utterance.
- **Voice**: Produces remedial speech output with Bark for non-clean outcomes or feedback playback.
- **Memory**: Persists transcriptions and diagnostics in SQLite and writes chronological session logs.

## 3. File Structure
```text
ADAPT-Synthetix/
├── Backend/                              # Backend Python services and modules
│   ├── app.py                            # Flask API entrypoint and route handlers
│   ├── asr_module.py                     # Wav2Vec2 load + transcription helpers
│   ├── config.py                         # Path constants and startup directory setup
│   ├── database.py                       # SQLite schema + CRUD helpers for sessions
│   ├── diagnostics.py                    # Current diagnostic feature extraction logic
│   ├── drift_detector.py                 # Placeholder for drift analysis
│   ├── lora_trainer.py                   # Placeholder for adaptation training
│   ├── noise_fingerprint.py              # Placeholder for fingerprinting
│   ├── session_logger.py                 # Text log writer utility
│   ├── tts_engine.py                     # Bark-based TTS synthesis interface
│   ├── data/                             # Runtime data artifacts
│   │   ├── .gitkeep                      # Keep directory in git
│   │   ├── adaptsynthetix.db             # SQLite database file
│   │   └── audio/                        # Saved input/remedial audio artifacts
│   │       └── .gitkeep                  # Keep nested audio directory in git
│   ├── logs/                             # Session log text files
│   │   └── .gitkeep                      # Keep log directory in git
│   └── temp/                             # Temporary upload/cache folder
│       └── .gitkeep                      # Keep temp directory in git
├── Dataset/                              # Audio samples for experimentation
├── Documentation/                        # Slides/images/roadmap assets
├── Frontend/                             # Browser UI files
│   ├── app.js                            # Terminal interaction and recording logic
│   ├── index.html                        # Main terminal-style interface
│   ├── sessions.js                       # Session UI helper
│   ├── style.css                         # Frontend styling
│   ├── terminal.js                       # Terminal polling renderer
│   ├── transmit.html                     # Alternate transmit page
│   └── waveform.js                       # Live waveform visualization
├── Model/                                # Model artifacts and legacy output placeholders
│   └── tts_output.wav                    # Kept sample output artifact
├── tests/                                # Pytest suite
│   ├── __init__.py                       # Test package marker
│   ├── test_app.py                       # API endpoint tests via Flask client
│   ├── test_database.py                  # Database behavior and ordering tests
│   ├── test_diagnostics.py               # Diagnostic function unit tests
│   └── test_tts_engine.py                # Slow TTS synthesis tests
├── .gitignore                            # Git exclusion rules
├── DOCUMENTATION.md                      # Full technical documentation
├── pipeline_test.py                      # Standalone end-to-end pipeline demo
├── README.md                             # Quick landing page
├── requirements.txt                      # Python dependency list
└── start_app.bat                         # Windows startup helper
```

## 4. Module Reference

### Backend/app.py
**Purpose:** Flask web server exposing all API endpoints  
**Loads at startup:** Wav2Vec2 model (indirectly via `asr_module`), TTS model (`tts_engine`), SQLite DB (lazy init via `database.py`), session log file  
**Key functions:**  
- `index()` — serves frontend entry page  
- `transcribe()` — accepts uploaded audio and returns transcription + diagnostics  
- `synthesize_route()` — generates WAV attachment for provided text  
- `tts_status()` — returns TTS model availability metadata  
- `get_sessions()` — returns recent session records from DB  
- `serve_temp(filename)` — serves temporary uploads  
- `health()` — returns backend health metadata  

### Backend/database.py
**Purpose:** SQLite database operations and session logging  
**Functions:**
- `log_transcription(...)` — inserts new transcription row, returns id
- `update_diagnostics(...)` — updates row with CER, error_type, confidence, noise_profile
- `get_recent_sessions(limit)` — returns last N transcriptions as dicts

### Backend/tts_engine.py
**Purpose:** Text-to-speech synthesis using suno/bark-small  
**Functions:**
- `synthesize(text, output_path)` — generates WAV file from text

### Backend/diagnostics.py
**Purpose:** Error analysis and noise profiling  
**Functions:**
- `calculate_cer(reference, hypothesis)` — Character Error Rate using jiwer
- `extract_phonemes(text)` — phoneme sequence using g2p_en
- `classify_noise_profile(audio, sr)` — librosa spectral feature classification
- `extract_confidence(logits)` — mean confidence from Wav2Vec2 logits
- `classify_error_type(cer, noise, confidence)` — final error categorization

### pipeline_test.py
**Purpose:** Standalone end-to-end pipeline demonstration

## 5. API Reference
| Method | Path | Request Body | Response Body | Description |
| --- | --- | --- | --- | --- |
| GET | `/` | None | HTML | Serves frontend entry page |
| POST | `/transcribe` | `multipart/form-data` with `audio` file | `{"transcription","duration","status","confidence","error_type","noise_type"}` or error | ASR + diagnostics pipeline |
| POST | `/synthesize` | `{"text":"..."}` | WAV file attachment or error JSON | TTS synthesis endpoint |
| GET | `/tts_status` | None | `{"available": bool, "model": "suno/bark-small"}` | TTS readiness check |
| GET | `/sessions` | None | JSON array of session rows | Recent transcriptions from DB |
| GET | `/temp/<filename>` | None | File stream | Serves temporary uploaded files |
| GET | `/health` | None | `{"status":"healthy","asr":"wav2vec2","tts":"suno/bark-small"}` | Backend heartbeat |

### curl examples
```bash
curl -X GET http://localhost:5000/

curl -X POST http://localhost:5000/transcribe \
  -F "audio=@path/to/audio.wav"

curl -X POST http://localhost:5000/synthesize \
  -H "Content-Type: application/json" \
  -d "{\"text\":\"hello from adapt synthetix\"}" \
  -o synth.wav

curl -X GET http://localhost:5000/tts_status

curl -X GET http://localhost:5000/sessions

curl -X GET http://localhost:5000/temp/example.wav -o example.wav

curl -X GET http://localhost:5000/health
```

## 6. Database Schema
```sql
CREATE TABLE IF NOT EXISTS transcriptions (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id          TEXT,
    timestamp           TEXT,
    audio_filename      TEXT,
    audio_path          TEXT,
    transcription       TEXT,
    duration_seconds    REAL,
    model_used          TEXT,
    cer_score           REAL    DEFAULT NULL,
    error_type          TEXT    DEFAULT NULL,
    confidence_score    REAL    DEFAULT NULL,
    noise_profile       TEXT    DEFAULT NULL,
    remedial_audio_path TEXT    DEFAULT NULL
);
```

- `id`: unique row identifier for each transcription event.  
- `session_id`: server session UUID to group entries from one runtime.  
- `timestamp`: insertion time for chronology and dashboard ordering.  
- `audio_filename`: uploaded file name received by API.  
- `audio_path`: permanent stored path in backend data audio directory.  
- `transcription`: decoded ASR text output.  
- `duration_seconds`: measured audio length.  
- `model_used`: ASR model identifier used for inference.  
- `cer_score`: optional ground-truth error metric (nullable for no reference).  
- `error_type`: final inferred category (`clean`, `noise`, `accent`, etc.).  
- `confidence_score`: mean token confidence from logits softmax.  
- `noise_profile`: serialized feature dictionary from acoustic analysis.  
- `remedial_audio_path`: optional path to generated corrective TTS output.  

## 7. Pipeline Flow
1. Audio uploaded to `/transcribe`.
2. File saved to `Backend/temp/` and copied to `Backend/data/audio/`.
3. Resampled to 16kHz mono via librosa.
4. Run through Wav2Vec2 -> logits -> transcription.
5. Confidence extracted from logits.
6. Noise profile calculated from raw audio.
7. Error type classified.
8. Row inserted in DB with all metadata.
9. Session log appended to TXT.
10. Response returned to frontend.

## 8. Setup Guide
1. Clone repo and enter project directory:
   ```bash
   git clone <repo-url>
   cd ADAPT-Synthetix
   ```
2. Create and activate virtual environment:
   ```bash
   python -m venv vir_env
   # Windows PowerShell
   .\vir_env\Scripts\Activate.ps1
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Install ffmpeg and add it to Windows PATH:
   - Install ffmpeg from the official build/provider.
   - Add `ffmpeg\bin` to the user/system `Path` environment variable.
   - Verify with:
     ```bash
     ffmpeg -version
     ```
5. Run backend:
   ```bash
   python Backend/app.py
   ```
6. Open frontend:
   - Open `Frontend/index.html` in a browser.

## 9. Testing
Run tests from project root after activating `vir_env`.

```bash
# Run all tests except slow ones
pytest -m "not slow"

# Run all tests including slow (TTS)
pytest

# Run tests with coverage
pytest --cov=Backend --cov=. --cov-report=term-missing

# Run a specific test file
pytest tests/test_diagnostics.py -v
```

Primary test modules:
- `tests/test_database.py` for DB insertion/update/query logic.
- `tests/test_diagnostics.py` for CER/noise/confidence/error classification.
- `tests/test_tts_engine.py` for WAV synthesis behavior (slow marker).
- `tests/test_app.py` for Flask endpoint behavior with mocked heavy dependencies.

## 10. Roadmap
- **Sem 4:** Pipeline foundation, diagnostics integration, persistence, baseline testing.
- **Sem 5:** Adaptive remediation loop tuning, expanded diagnostics, evaluation protocols.
- **Sem 6:** Research consolidation, comparative benchmarking, publication-ready reporting.

For detailed milestone artifacts, refer to `Documentation/ADAPT-Synthetix-Roadmap.docx`.

## 11. Research Contribution
ADAPT-Synthetix contributes a practical closed-loop ASR architecture where transcription is augmented by interpretable diagnostic signals and optional remediation synthesis.

Compared to conventional ASR demos that stop at text output, this system surfaces confidence and acoustic context directly in the API layer and persists them for later analysis. That creates a traceable bridge between model behavior and environmental conditions.

The framework also differs from pure post-hoc error analysis pipelines by integrating diagnosis in real time with immediate remediation hooks. This design enables future adaptive learning experiments and user-facing feedback workflows within one operational stack.
