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
ADAPT-Synthetix is a closed-loop speech framework that combines ASR, diagnostics, drift monitoring, and TTS remediation into a single operational pipeline. The backend accepts microphone/file audio, transcribes speech with Wav2Vec2, and returns transcription plus diagnostic metadata.

The system extends baseline ASR demos by exposing confidence, acoustic fingerprints, and error categories in real time, then prioritizing remediation based on risk. This creates a practical research platform for adaptive ASR experiments under noisy, accented, and domain-specific speech.

## 2. System Architecture
```text
Audio Input (Mic / File Upload)
|
v
[ASR Module: Wav2Vec2-base-960h]
|
+---> Logits ---> [Confidence Extractor]
|
v
[Noise Fingerprinter: 8-feature spectral analysis]
|
v
[Error Classifier: clean / noise / accent / pronunciation]
|
v
[Domain Vocabulary Checker: medical + emergency priority]
|
v
[Priority Queue: confidence-weighted remediation ordering]
|
+---> if error != clean ---> [TTS: suno/bark-small] ---> Remedial Audio
|
v
[Drift Detector: phoneme-level accuracy trend tracking]
|
v
[Database: SQLite (dev) / PostgreSQL (prod)]
|
v
[Session Logger: TXT per session]
|
v
[LoRA Trainer: triggered when drift threshold reached]
```

## 3. File Structure
```text
ADAPT-Synthetix/
├── Backend/
│   ├── app.py
│   ├── asr_module.py
│   ├── config.py
│   ├── database.py
│   ├── dataset_manager.py
│   ├── diagnostics.py
│   ├── drift_detector.py
│   ├── lora_trainer.py
│   ├── noise_fingerprint.py
│   ├── priority_queue.py
│   ├── session_logger.py
│   ├── tts_engine.py
│   ├── data/
│   │   ├── adaptsynthetix.db
│   │   └── audio/
│   ├── logs/
│   ├── models/
│   │   └── lora/
│   └── temp/
├── Dataset/
├── Documentation/
├── Frontend/
│   ├── app.js
│   ├── index.html
│   ├── style.css
│   ├── terminal.js
│   └── waveform.js
├── tests/
│   ├── test_app.py
│   ├── test_database.py
│   ├── test_diagnostics.py
│   ├── test_drift_detector.py
│   ├── test_noise_fingerprint.py
│   ├── test_priority_queue.py
│   └── test_tts_engine.py
├── benchmark.py
├── docker-compose.yml
├── Dockerfile
├── .dockerignore
├── DOCUMENTATION.md
├── README.md
├── requirements.txt
└── start_app.bat
```

## 4. Module Reference

### Backend/app.py
**Purpose:** FastAPI web server exposing ASR, diagnostics, queueing, drift, dataset, and status endpoints.

### Backend/asr_module.py
**Purpose:** Wav2Vec2 model loading and transcription helper  
**Loaded once at startup to avoid repeated initialization overhead**  
**Functions:**
- `load_model()` — loads processor and model from facebook/wav2vec2-base-960h, returns (processor, model)
- `transcribe(audio_array, processor, model)` — runs inference, returns (transcription_text, logits_tensor)

### Backend/database.py
**Purpose:** SQLite schema initialization and CRUD operations for transcription diagnostics.

### Backend/session_logger.py
**Purpose:** Writes per-session TXT log files to Backend/logs/  
**Functions:**
- `init_session(session_id)` — creates log file, writes header
- `log_entry(transcription, filename, duration)` — appends formatted entry
- `close_session(total_count)` — writes footer on shutdown

### Backend/diagnostics.py
**Purpose:** Core diagnostics utilities: CER, phoneme extraction, noise profile classification dispatch, confidence extraction, and error type classification.

### Backend/noise_fingerprint.py
**Purpose:** 8-feature acoustic noise profiling and classification  
**Features extracted:** spectral_centroid, spectral_bandwidth, spectral_rolloff, zero_crossing_rate, rms_energy, mfcc_variance, tempo, harmonic_ratio  
**Noise classes:** clean, traffic, crowd, machinery, indoor  
**Functions:**
- `NoiseFingerprinter.extract_features(audio, sr)` — returns 8-feature dict
- `NoiseFingerprinter.classify(features)` — returns noise class string
- `NoiseFingerprinter.fingerprint(audio, sr)` — combined extract + classify
- `NoiseFingerprinter.compare(fp1, fp2)` — similarity score between two fingerprints

### Backend/priority_queue.py
**Purpose:** Confidence-weighted remediation queue with domain vocabulary injection  
**Medical vocabulary:** 25 medical terms (patient, dosage, cardiac, etc.)  
**Emergency vocabulary:** 20 emergency terms (mayday, evacuate, triage, etc.)  
**Priority formula:** final_priority = (1 - confidence) × (1 + 0.5 × domain_match_count)  
**Functions:**
- `RemediationPriorityQueue.calculate_priority(transcription, confidence, error_type)` — returns (priority, matches, multiplier)
- `RemediationPriorityQueue.enqueue(transcription_id, transcription, error_type, confidence)` — adds to queue
- `RemediationPriorityQueue.get_queue(limit)` — returns pending items ordered by priority DESC
- `RemediationPriorityQueue.mark_completed(queue_id)` — marks item done
- `RemediationPriorityQueue.get_stats()` — returns pending/completed/total counts

### Backend/drift_detector.py
**Purpose:** Tracks per-phoneme confidence trends across sessions to detect accuracy degradation  
**Trigger threshold:** 3+ high-risk phonemes (degrading trend + avg_confidence < 0.5) triggers retraining alert  
**Functions:**
- `DriftDetector.record_phoneme_confidence(session_id, phonemes, confidence)` — stores per-phoneme data point
- `DriftDetector.get_phoneme_trend(phoneme, window)` — returns trend dict: {phoneme, avg_confidence, trend, sample_count}
- `DriftDetector.get_drift_report()` — full report: degrading/stable/improving lists + high_risk_phonemes
- `DriftDetector.should_trigger_retraining()` — returns bool

### Backend/lora_trainer.py
**Purpose:** LoRA fine-tuning scaffold for Wav2Vec2 adaptation on remedial audio  
**LoRA config:** rank=8, alpha=32, target_modules=[q_proj, v_proj], dropout=0.1  
**Training trigger:** called when drift_detector.should_trigger_retraining() returns True  
**Functions:**
- `LoRATrainer.load_remedial_samples(error_type, limit)` — queries DB for remedial audio, sorts by confidence ASC
- `LoRATrainer.prepare_model()` — loads base model, applies LoRA config, prints trainable param count
- `LoRATrainer.dry_run()` — prints full training plan without training
- `LoRATrainer.train(epochs, learning_rate)` — full training loop, saves adapter per epoch
- `LoRATrainer.evaluate(test_samples)` — before/after CER comparison

### Backend/dataset_manager.py
**Purpose:** Dataset registration, organization, and manifest management  
**Categories:** noisy, accented, medical, clean  
**Functions:**
- `DatasetManager.register_sample(audio_path, transcription, category, noise_type)` — adds to manifest
- `DatasetManager.get_samples(category, noise_type)` — filtered sample retrieval
- `DatasetManager.get_stats()` — breakdown by category and noise type

### Backend/tts_engine.py
**Purpose:** TTS synthesis using `suno/bark-small` with WAV output generation.

### benchmark.py
**Purpose:** Standalone benchmarking script — runs Wav2Vec2 on all labelled Dataset/ samples and prints CER table  
**Usage:** `python benchmark.py --dataset Dataset/ --category noisy`

## 5. API Reference
| Method | Path | Request Body / Query | Response Body | Description |
| --- | --- | --- | --- | --- |
| GET | `/` | None | HTML | Serves frontend entry page |
| POST | `/transcribe` | `multipart/form-data` with `audio` file | `{"transcription","duration","status","confidence","error_type","noise_type"}` or error JSON | ASR + diagnostics pipeline |
| POST | `/synthesize` | `{"text":"..."}` | WAV stream or error JSON | TTS synthesis endpoint |
| GET | `/tts_status` | None | `{"available": bool, "model": "suno/bark-small"}` | TTS readiness |
| GET | `/sessions` | None | JSON array | Recent transcription rows |
| GET | `/noise_report` | None | `{total_analyzed, breakdown, most_common, avg_rms_energy, avg_spectral_centroid}` | Aggregated noise classification stats |
| GET | `/priority_queue` | None | `{queue: [...], stats: {pending, completed, total, avg_priority}}` | Remediation queue state |
| GET | `/vocabulary_check` | `?text=query` | `{medical_matches, emergency_matches, is_domain_critical}` | Domain vocabulary check |
| GET | `/drift_report` | None | `{total_phonemes_tracked, degrading, stable, improving, high_risk_phonemes}` | Phoneme drift analysis |
| GET | `/lora_status` | None | `{adapter_exists, last_trained, training_logs}` | LoRA adapter state |
| GET | `/dataset_stats` | None | `{total, by_category, by_noise_type}` | Dataset manifest stats |
| GET | `/remediation_status` | None | `{total_transcriptions, clean, remediated, pending_remediation, remediation_rate}` | Closed-loop remediation stats |
| GET | `/temp/<filename>` | None | File stream | Serves temporary uploaded files |
| GET | `/health` | None | `{"status":"healthy","asr":"wav2vec2-base-960h","tts":"suno/bark-small","session_id":"..."}` | Health heartbeat |

### curl examples
```bash
curl -X GET http://localhost:5000/

curl -X POST http://localhost:5000/transcribe -F "audio=@path/to/audio.wav"

curl -X POST http://localhost:5000/synthesize \
  -H "Content-Type: application/json" \
  -d "{\"text\":\"hello from adapt synthetix\"}" \
  -o synth.wav

curl -X GET http://localhost:5000/tts_status
curl -X GET http://localhost:5000/sessions
curl -X GET http://localhost:5000/noise_report
curl -G "http://localhost:5000/vocabulary_check" --data-urlencode "text=patient cardiac arrest"
curl -X GET http://localhost:5000/priority_queue
curl -X GET http://localhost:5000/drift_report
curl -X GET http://localhost:5000/lora_status
curl -X GET http://localhost:5000/dataset_stats
curl -X GET http://localhost:5000/remediation_status
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

CREATE TABLE IF NOT EXISTS phoneme_tracking (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id       TEXT,
    phoneme          TEXT,
    confidence_score REAL,
    timestamp        TEXT
);

CREATE TABLE IF NOT EXISTS priority_queue (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    transcription_id  INTEGER,
    transcription     TEXT,
    error_type        TEXT,
    base_confidence   REAL,
    domain_multiplier REAL,
    final_priority    REAL,
    domain_matches    TEXT,
    status            TEXT DEFAULT 'pending',
    created_at        TEXT
);
```

## 7. Pipeline Flow
1. Audio uploaded to `/transcribe`
2. File saved to `Backend/temp/` and copied permanently to `Backend/data/audio/`
3. Resampled to 16kHz mono via librosa
4. Run through Wav2Vec2 -> logits tensor -> transcription string
5. Confidence score extracted from logits via softmax mean
6. NoiseFingerprinter extracts 8 acoustic features from raw audio
7. Noise type classified from features (`clean`/`traffic`/`crowd`/`machinery`/`indoor`)
8. Error type classified using confidence + noise profile
9. Domain vocabulary checked — medical/emergency word matches found
10. Row inserted in DB with all metadata (transcription, confidence, error_type, noise_profile)
11. Session log TXT appended
12. Phoneme sequence extracted, recorded in `phoneme_tracking` table via DriftDetector
13. Drift detector checks retraining threshold — prints alert if triggered
14. If `error_type != clean`: `RemediationPriorityQueue.enqueue()` called with priority score
15. Background task spawned for TTS remediation if TTS available
16. Response returned to frontend with transcription + diagnostics JSON

## 8. Setup Guide
1. Clone repo and move into project:
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
4. **Windows ffmpeg (without admin rights):**  
   Run this in your project PowerShell window each session:
   ```powershell
   $env:PATH += ";C:\Users\YOUR_USERNAME\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-7.1-essentials_build\bin"
   ```
   Add this line to `start_app.bat` to make it automatic.
5. Run backend locally:
   ```bash
   uvicorn Backend.app:app --host 0.0.0.0 --port 5000 --reload
   ```
6. **Docker setup:**
   ```bash
   docker-compose up
   ```
   Backend available at `http://localhost:5000`  
   Open `Frontend/index.html` in browser.

## 9. Testing
**Automated Test Suite**  
18 tests across 4 modules. Run from project root with `vir_env` activated.

```bash
# Standard run — excludes slow TTS tests (recommended for development)
pytest -m "not slow" -v

# Full run including TTS synthesis tests
pytest -v

# With coverage report
pytest -m "not slow" --cov=Backend --cov-report=term-missing

# Single module
pytest tests/test_diagnostics.py -v
pytest tests/test_database.py -v
pytest tests/test_app.py -v

# TTS only (slow — allow 3-5 minutes)
pytest tests/test_tts_engine.py -v
```

**Test Coverage by Module:**
| File | Tests | What it covers |
|------|-------|----------------|
| test_database.py | 4 | Row insertion, diagnostics update, query ordering, count limits |
| test_diagnostics.py | 9 | CER calculation, phoneme extraction, noise classification, confidence extraction, error type logic |
| test_tts_engine.py | 3 (slow) | WAV file creation, return path validation, empty text handling |
| test_app.py | 5 | Health endpoint, /transcribe validation, format rejection, /sessions list, /tts_status |

**Expected output (passing):**
```text
tests/test_database.py ....                    [ 4 passed]
tests/test_diagnostics.py .........            [ 9 passed]
tests/test_app.py .....                        [ 5 passed]
18 passed, 3 deselected (slow) in ~12s
```

## 10. Roadmap
**Semester 4 — Pipeline Foundation (COMPLETE)**
- Wav2Vec2 ASR transcription pipeline
- Flask/FastAPI backend with 12 endpoints
- SQLite database with full diagnostics schema
- Diagnostic layer: confidence, noise fingerprinting, error classification
- TTS remediation with auto-trigger closed loop
- Session logging per server run
- Drift detector: phoneme-level trend tracking
- LoRA trainer: full scaffold ready for training data
- Priority queue: confidence-weighted remediation ordering
- Domain vocabulary: medical + emergency injection
- Dataset manager: sample registration and manifest
- Benchmark script: CER evaluation against labelled data
- Docker: containerized deployment configuration
- Frontend: dark terminal UI with waveform, mic recording, file upload
- 18 automated tests passing

**Semester 5 — Training + Adaptation (NEXT)**
- Collect 100+ labelled utterances across noise/accent/medical categories
- Run baseline benchmark to establish CER numbers
- Execute LoRA training runs on remedial audio
- Validate before/after accuracy improvement
- Implement Experience Replay to prevent catastrophic forgetting
- Mixture of LoRA Experts — separate adapter per error type
- Expand drift detection window and thresholds based on real data

**Semester 6 — Production (PLANNED)**
- Migrate SQLite to PostgreSQL
- FastAPI already complete — optimize for production load
- GPU inference deployment on cloud instance
- React frontend replacing vanilla HTML
- Mobile app wrapper
- CI/CD pipeline
- Research paper draft

## 11. Research Contribution
**Research Contribution Statement:**  
> "ADAPT-Synthetix introduces a phoneme-level diagnostic layer for closed-loop ASR self-refinement — the first system to classify failure type (noise, accent, pronunciation) before generating targeted synthetic remedial data, enabling precision-guided LoRA adaptation without human intervention."

**Five Novel Technical Contributions:**

1. **Phoneme-Level Error Diagnosis** — Maps transcription errors to specific phoneme pairs rather than word-level CER. Identifies which sounds the model consistently confuses and generates remedial TTS audio targeting those exact phoneme pairs. No existing 2023-2025 paper implements phoneme-pair targeted remediation.

2. **8-Feature Noise Fingerprinting** — Classifies background acoustic conditions using spectral centroid, bandwidth, rolloff, ZCR, RMS energy, MFCC variance, tempo, and harmonic ratio. Conditions synthetic remedial audio on the specific noise type that caused the failure. Existing closed-loop systems do not condition synthetic data on noise type.

3. **Confidence-Weighted Priority Queue** — Weights remediation priority by model confidence rather than treating all errors equally. Low confidence + domain-critical vocabulary (medical/emergency terms) receives 3x priority multiplier. No existing literature implements domain-critical priority weighting in ASR remediation.

4. **Proactive Drift Detection** — Tracks per-phoneme accuracy degradation across sessions using rolling window averages. Triggers retraining proactively when 3+ phonemes show degrading trend, before failure rate becomes critical. Existing systems react to failures — this system predicts them.

5. **Domain Vocabulary Injection** — Maintains medical and emergency priority vocabulary. Errors on domain-critical words are flagged at higher remediation priority than filler word errors. Designed for safety-critical applications where specific vocabulary failures have real-world consequences.

**Comparison to Existing Work:**
| Feature | Generic Self-Refining ASR | ADAPT-Synthetix |
|---------|--------------------------|-----------------|
| Failure diagnosis | None — generic retrain | Phoneme-level classification |
| Synthetic data conditioning | Unconditioned | Noise-type conditioned |
| Remediation priority | FIFO | Confidence + domain weighted |
| Adaptation trigger | Reactive | Proactive drift detection |
| Domain awareness | None | Medical + emergency vocabulary |
