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

The system extends baseline ASR demos by exposing confidence, acoustic fingerprints, and error categories in real time, then prioritizing remediation based on risk. When a reference transcript is provided, it also computes measured CER and reference-aligned phoneme errors. Without a reference transcript, diagnostic labels are heuristic estimates based on confidence and acoustic context.

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
| POST | `/transcribe` | `multipart/form-data` with `audio` file, optional `reference_transcript`, optional `session_id` | `{"transcription","duration","status","confidence","error_type","noise_type","cer_score","diagnostic_basis","phoneme_errors"}` or error JSON | ASR + diagnostics pipeline |
| POST | `/synthesize` | `{"text":"..."}` | WAV stream or error JSON | TTS synthesis endpoint |
| GET | `/tts_status` | None | `{"available": bool, "model": "suno/bark-small"}` | TTS readiness |
| GET | `/sessions` | None | JSON array | Recent transcription rows |
| GET | `/noise_report` | None | `{total_analyzed, breakdown, most_common, avg_rms_energy, avg_spectral_centroid}` | Aggregated noise classification stats |
| GET | `/priority_queue` | None | `{queue: [...], stats: {pending, completed, total, avg_priority}}` | Remediation queue state |
| GET | `/vocabulary_check` | `?text=query` | `{medical_matches, emergency_matches, is_domain_critical}` | Domain vocabulary check |
| GET | `/drift_report` | None | `{total_phonemes_tracked, degrading, stable, improving, high_risk_phonemes}` | Phoneme drift analysis |
| GET | `/phoneme_error_report` | None | `{basis, top_errors}` | Reference-aligned phoneme error summary |
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
8. If `reference_transcript` is present, CER and reference-aligned phoneme errors are computed
9. Error type classified using measured CER when available, otherwise confidence + noise profile
10. Domain vocabulary checked — medical/emergency word matches found
11. Row inserted in DB with all metadata (transcription, optional reference, confidence, error_type, noise_profile)
12. Session log TXT appended
13. Phoneme sequence extracted, recorded in `phoneme_tracking`; reference-aligned errors recorded when a reference exists
14. Drift detector checks retraining threshold — prints alert if triggered
15. If `error_type != clean`: `RemediationPriorityQueue.enqueue()` called with priority score
16. Background task spawned for TTS remediation; reference transcript is used as corrective text when available
17. Response returned to frontend with transcription + diagnostics JSON

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

## 12. Baseline Benchmark Results

> **Pre-LoRA Baseline** — These results represent the unmodified `facebook/wav2vec2-base-960h` model. They are the reference point against which post-LoRA adaptation improvement will be measured.

### Status: Awaiting Labelled Data

LoRA training requires remedial audio samples collected by the live transcription pipeline (rows in `transcriptions` where `remedial_audio_path IS NOT NULL`). Benchmark CER evaluation requires labelled audio registered via `collect_dataset.py` or `batch_register.py`.

At the time of this writing, the dataset manifest is empty and no remedial audio has been collected yet (the 31 transcriptions in the database predate the remediation pipeline wiring). Both will populate automatically during normal system use.

### Pre-LoRA Baseline CER (to be filled after data collection)

| Category  | Sample Count | Avg CER | Min CER | Max CER |
|-----------|-------------|---------|---------|---------|
| clean     | —           | —       | —       | —       |
| noisy     | —           | —       | —       | —       |
| accented  | —           | —       | —       | —       |
| medical   | —           | —       | —       | —       |

### Post-LoRA (Epoch 3) CER (to be filled after training)

| Category  | Avg CER Before | Avg CER After | Δ CER |
|-----------|---------------|--------------|-------|
| all       | —             | —            | —     |

**How to populate these tables:**

1. Register labelled audio samples:
   ```
   python Backend/collect_dataset.py --audio <file> --transcript "text" --category clean --noise_type clean
   # or batch:
   python Backend/batch_register.py --csv samples.csv
   ```

2. Run the baseline benchmark per category:
   ```
   python benchmark.py --dataset Dataset/ --category clean
   python benchmark.py --dataset Dataset/ --category noisy
   python benchmark.py --dataset Dataset/ --category accented
   python benchmark.py --dataset Dataset/ --category medical
   ```

3. Run LoRA training (requires ≥5 remedial samples in the DB):
   ```
   python Backend/lora_trainer.py --epochs 3
   ```

4. Run the before/after evaluation:
   ```
   python Backend/run_evaluation.py
   # or with a holdout CSV:
   python Backend/run_evaluation.py --holdout holdout.csv
   ```

## 11. Research Contribution
**Research Contribution Statement:**  
> "ADAPT-Synthetix explores a closed-loop ASR refinement pipeline that combines confidence scoring, acoustic noise metadata, reference-aligned phoneme error analysis, domain-aware prioritization, and synthetic remedial data for future LoRA adaptation."

**Five Novel Technical Contributions:**

1. **Reference-Aligned Phoneme Error Diagnosis** — When ground truth is available, maps transcription errors to phoneme edit operations rather than only word-level summaries. This identifies which sounds the model confuses and provides a better basis for remedial sample selection.

2. **8-Feature Noise Fingerprinting** — Classifies background acoustic conditions using spectral centroid, bandwidth, rolloff, ZCR, RMS energy, MFCC variance, tempo, and harmonic ratio. This is currently a heuristic classifier that should be validated against labelled noisy datasets.

3. **Confidence-Weighted Priority Queue** — Weights remediation priority by model confidence rather than treating all errors equally. Low confidence plus domain-critical vocabulary receives higher priority, with the caveat that vocabulary matches depend on recognized text unless a reference transcript is provided.

4. **Drift Monitoring** — Tracks per-phoneme confidence trends across sessions and separately stores reference-aligned phoneme error counts. Confidence-only drift is an early warning signal, while reference-aligned errors are the stronger measurement.

5. **Domain Vocabulary Injection** — Maintains medical and emergency priority vocabulary. Errors on domain-critical words are flagged at higher remediation priority than filler word errors. Designed for safety-critical applications where specific vocabulary failures have real-world consequences.

**Comparison to Existing Work:**
| Feature | Generic Self-Refining ASR | ADAPT-Synthetix |
|---------|--------------------------|-----------------|
| Failure diagnosis | None — generic retrain | Phoneme-level classification |
| Synthetic data conditioning | Unconditioned | Noise-type conditioned |
| Remediation priority | FIFO | Confidence + domain weighted |
| Adaptation trigger | Reactive | Proactive drift detection |
| Domain awareness | None | Medical + emergency vocabulary |
