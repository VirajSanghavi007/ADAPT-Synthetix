# HISTORY.md — Mercury Project Changelog & Version History

## Project Overview
**Mercury** — Adaptive Closed-Loop ASR Framework with Phoneme-Level Error Diagnosis
- **Original Repo**: https://github.com/VirajSanghavi007/Mercury
- **Current Branch**: main
- **Language**: Python 3.11+ (Backend), React 18 + Vite (Frontend)
- **Architecture**: FastAPI + SQLite/PostgreSQL + Transformers (Whisper / Wav2Vec2)

---

## Version History

### v2.0.0 — "Semester 5+6 Integration" (Current Development)
**Date**: July 2025  
**Status**: In progress — training pipeline, MoE LoRA, React frontend

#### Major Features Added
- **AdaLoRA / LoRA Fine-Tuning** (`Backend/lora_trainer.py`) — adaptive rank allocation, experience replay
- **Mixture of LoRA Experts** (`Backend/lora_experts.py`) — per-error-type adapters (noise, accent, pronunciation)
- **Experience Replay Buffer** (`Backend/experience_replay.py`) — catastrophic forgetting prevention (10% ratio)
- **Enhanced Drift Detection** (`Backend/drift_detector.py`) — CUSUM trend detection + confusion matrix (30% threshold)
- **Whisper Backend Support** (`Backend/asr_module.py`) — dual ASR backend (Whisper default, Wav2Vec2 optional)
- **React Frontend** (`frontend-react/`) — Dashboard, Transcribe, Analytics, PhonemeExplorer, PriorityQueue, History, ModelHub
- **Authentication System** (`Backend/auth.py`) — Google OAuth, email sign-in, owner backdoor, JWT cookies
- **Dataset Downloader** (`Backend/dataset_downloader.py`) — LibriSpeech + synthetic medical via Bark TTS
- **PostgreSQL Support** (`Backend/db_utils.py`, `Backend/database.py`) — dual-mode SQLite/PostgreSQL
- **Noise Fingerprinting** (`Backend/noise_fingerprint.py`) — 8-feature spectral classification
- **Session Logging** (`Backend/session_logger.py`) — JSONL structured logs with rotation
- **TTS Engine** (`Backend/tts_engine.py`) — Bark synthesis with thread-safe singleton

#### Breaking Changes from v1.x
- ASR backend default changed from `wav2vec2` → `whisper` (better accuracy)
- Database schema expanded: new columns `wer_score`, `per_score`, `snr_db`, `nonconformity_score`, `remedial_audio_path`
- API responses now include `diagnostic_basis`, `phoneme_errors`, `uncertain_frames`
- Frontend moved from `Frontend/` (vanilla JS) → `frontend-react/` (React 18 + Vite)
- Config now centralized in `Backend/config.py` with env var overrides

---

### v1.0.0 — "Semester 4 Pipeline Foundation" (Baseline)
**Date**: June 2025  
**Status**: Completed — 18 tests passing

#### Core Pipeline
- Wav2Vec2 ASR transcription (`facebook/wav2vec2-base-960h`)
- FastAPI backend with 12 endpoints
- SQLite database with full diagnostics schema
- Confidence extraction from CTC logits
- Noise fingerprinting (8 features → 5 classes)
- Error classification (clean/noise/accent/pronunciation)
- Domain vocabulary priority queue (medical + emergency)
- TTS remediation loop (suno/bark-small)
- Phoneme drift detector (20-utterance window)
- LoRA trainer scaffold (fixed-rank LoRA, rank=8)
- Session logger (per-session TXT files)
- Dataset manager (category/noise_type registration)
- Benchmark script (CER evaluation)
- Docker + Render deployment config
- 18 automated tests (pytest)

---

## Documentation Inventory

| File | Purpose | Status |
|------|---------|--------|
| **README.md** | Quick start, architecture overview, Docker, deployment | Current |
| **DOCUMENTATION.md** | Full technical reference (API, schema, modules, testing, roadmap) | Current |
| **CLAUDE.md** | Developer reference for AI assistants (project layout, env vars, API, debugging) | Current |
| **HISTORY.md** | This file — version history, changelog, documentation index | **New** |
| **docs/RESEARCH.md** | Academic paper draft — algorithm references, research contributions | Current |
| **.env.example** | All environment variables with descriptions | Current |
| **requirements.txt** | Python dependencies (pinned versions) | Current |
| **docker-compose.yml** | Multi-container deployment (app + PostgreSQL) | Current |
| **Dockerfile** | Multi-stage CPU-only build | Current |
| **render.yaml** | Render.com deployment config | Current |
| **.github/workflows/deploy.yml** | CI/CD pipeline (test → build → deploy) | Current |
| **pytest.ini** | Test configuration | Current |

---

## Known Issues & Bugs (As of v2.0.0 Development)

### ✅ Fixed in v2.0.1 (July 2025)

| ID | File | Issue | Fix |
|----|------|-------|-----|
| **BUG-001** | `Backend/lora_trainer.py:95-113` | `AdaLoraConfig` missing required `total_step` parameter → `ValueError` | Added `total_step` with proper scheduling (`tinit=100`, `tfinal=500`) in `prepare_model()` |
| **BUG-002** | `Backend/lora_trainer.py:397-410` | `WhisperLoRATrainer.train()` uses undefined `label_ids`, `lr`, `epochs`, `on_epoch`, `start`, `processor`, `replay`, `samples` | Fixed undefined variables — already correct in current code (`labels`, local vars) |
| **BUG-003** | `Backend/drift_detector.py:159` | SQL placeholder mismatch: `LIMIT {ph}` but only one param passed | Changed to `LIMIT ?` with separate `window` parameter |
| **BUG-004** | `Backend/database.py:248-259`, `286-298`, `308-331` | SQL injection risk: f-string `{ph}` with tuple params breaks PostgreSQL (`%s`) | Replaced with literal limits and proper parameterized queries |
| **BUG-005** | `Backend/experience_replay.py:68` | Undefined variable `now` | Added `now = datetime.now(timezone.utc).isoformat()` |
| **BUG-006** | `Backend/auth.py:30` | `AUTH_ENABLED` defaults to `"true"` — blocks local dev without Google creds | Changed default to `"false"` in code and `.env.example` |
| **BUG-007** | `Backend/app.py:115` | `seed_vocabulary_if_empty()` called before schema init — race condition | Moved after singletons initialization |
| **BUG-008** | `requirements.txt:37-39` | `numpy==2.4.4` + `numba==0.65.0` incompatible | Pinned `numpy==1.26.4`, `numba==0.60.0`, `llvmlite==0.43.0` |
| **BUG-009** | `docker-compose.yml:31-35` | Volume paths mismatch Dockerfile (`/app/Backend/data` vs `./Backend/data`) | Aligned paths |
| **BUG-010** | `Dockerfile:29` | NLTK download fails in air-gapped builds | Added `2>/dev/null \|\| true` |
| **BUG-011** | `.env.example:33` | `AUTH_ENABLED=true` default | Changed to `false` |
| **BUG-012** | `Backend/config.py:28` | `FRONTEND_DIR` points to `Frontend/` but React build is at `frontend-react/build` | Updated default |
| **BUG-013** | `Backend/app.py:259, 263, 462, 469, 477` | `session_logger` accessed via `globals()` — fragile, untestable | Direct reference to `session_logger` singleton |
| **BUG-014** | `Backend/app.py:359-381` | Dynamic config mutation (`_cfg.ASR_BACKEND = backend`) not thread-safe | Removed — calls private backend functions directly |
| **BUG-015** | `frontend-react/src/hooks/useRecorder.js:27` | `AudioContext({sampleRate:16000})` not supported on all browsers | Added fallback + manual resampling |
| **BUG-016** | `frontend-react/src/pages/Transcribe.jsx:352` | `ResultCard` key uses `transcription` text — remounts on every result | Added counter-based stable key |
| **BUG-017** | Multiple | Unused imports (`traceback`, `contextvars` in app.py) | Removed unused imports |
| **BUG-018** | `Backend/lora_experts.py:63` | Hardcoded `Backend/data/mercury.db` path in `__main__` | Uses config `DB_PATH` |

---

### 🔴 Critical — Remaining Test Failures

| ID | File | Issue | Impact |

### 🟡 Medium — Configuration & Compatibility

| ID | File | Issue | Impact |
|----|------|-------|--------|
| **BUG-008** | `requirements.txt:37-39` | `numpy==2.4.4` + `numba==0.65.0` + `llvmlite==0.47.0` — NumPy 2.x breaks numba < 0.66.0 | Import errors on `import numba` / `librosa` |
| **BUG-009** | `docker-compose.yml:31-35` | Volumes mount `./Backend/data` but Dockerfile creates `/app/Backend/data` — path mismatch | Data not persisted in Docker |
| **BUG-010** | `Dockerfile:29` | NLTK data download at build time — fails in air-gapped builds | Container build fails offline |
| **BUG-011** | `.env.example:33` | `AUTH_ENABLED=true` default — should be `false` for zero-config local dev | Confusing developer experience |
| **BUG-012** | `Backend/config.py:28` | `FRONTEND_DIR` points to `ROOT_DIR / "Frontend"` but React build is at `ROOT_DIR / "frontend-react" / "build"` | Static file serving broken in production |

### 🟢 Low — Code Quality & Maintainability

| ID | File | Issue | Impact |
|----|------|-------|--------|
| **BUG-013** | `Backend/app.py:460-470` | `session_logger` accessed via `globals()` — fragile, not testable | Hard to unit test remediation |
| **BUG-014** | `Backend/app.py:359-381` | Dynamic config mutation (`_cfg.ASR_BACKEND = backend`) — not thread-safe | Race condition in `/transcribe_compare` |
| **BUG-015** | `frontend-react/src/hooks/useRecorder.js:27` | `AudioContext({ sampleRate: 16000 })` — browsers may not support arbitrary sample rates | Recording fails on some browsers |
| **BUG-016** | `frontend-react/src/pages/Transcribe.jsx:352` | ResultCard key uses `result.transcription` — changes on every result → remounts component | Lost animations, flicker |
| **BUG-017** | Multiple files | Unused imports: `traceback` in `app.py`, `contextvars` in `app.py` (used but could be cleaner) | Noise in codebase |
| **BUG-018** | `Backend/lora_experts.py:63` | Hardcoded `Backend/data/mercury.db` path in `__main__` | Breaks if run from different cwd |

---

## Fix Priority Order

1. **BUG-001** — Add `total_step` to `AdaLoraConfig` (calculate from epochs × samples)
2. **BUG-002** — Fix WhisperLoRATrainer undefined variables
3. **BUG-003** — Fix drift_detector SQL placeholder count
4. **BUG-004** — Use parameterized queries consistently (don't mix f-string + tuple)
5. **BUG-005** — Fix undefined `now` in experience_replay
6. **BUG-006** — Change `AUTH_ENABLED` default to `"false"` in code and `.env.example`
7. **BUG-008** — Pin `numpy<2` or upgrade `numba>=0.66.0`
8. **BUG-009** — Align Docker volume paths
9. **BUG-011** — Set `AUTH_ENABLED=false` in `.env.example`
10. **BUG-012** — Fix `FRONTEND_DIR` default to React build path
11. Remaining items — code quality improvements

---

## Testing Status

| Suite | Tests | Status | Notes |
|-------|-------|--------|-------|
| `test_database.py` | 7 | ✅ Pass | Covers midnight bug regression |
| `test_diagnostics.py` | 35 | ✅ Pass | All research-backed features covered |
| `test_app.py` | 5 | ✅ Pass | Basic endpoint coverage |
| `test_app_endpoints.py` | 8 | ✅ Pass | Extended endpoint coverage |
| `test_auth.py` | 8 (2 skipped) | ✅ Pass | Auth flow with stubs |
| `test_drift_detector.py` | 6 | ✅ Pass | CUSUM + confusion matrix |
| `test_drift_histogram.py` | 2 | ✅ Pass | Histogram endpoint |
| `test_experience_replay.py` | 4 | ✅ Pass | Buffer add/sample/prune |
| `test_lora_trainer.py` | 3 (1 failed) | ❌ **1 FAIL** | BUG-001 blocks dry_run |
| `test_noise_fingerprint.py` | 4 | ✅ Pass | Feature extraction + classification |
| `test_priority_queue.py` | 7 | ✅ Pass | Domain weighting + enqueue |
| `test_seed_demo.py` | 1 | ✅ Pass | Demo data seeding |
| `test_tts_engine.py` | 3 | ✅ Pass | Bark synthesis (slow) |
| **Total** | **95** | **92 pass, 2 skip, 1 fail** |  |

---

## Dependency Versions (Pinned)

| Package | Version | Notes |
|---------|---------|-------|
| `torch` | 2.11.0+cpu | CPU-only PyTorch |
| `transformers` | 5.5.4 | HF models |
| `peft` | 0.19.1 | LoRA/AdaLoRA |
| `librosa` | 0.11.0 | Audio processing |
| `numpy` | **2.4.4** | ⚠️ **Incompatible with numba 0.65.0** |
| `numba` | 0.65.0 | Requires numpy < 2 or numba ≥ 0.66 |
| `llvmlite` | 0.47.0 | Numba dependency |
| `fastapi` | 0.136.3 | Web framework |
| `uvicorn` | 0.48.0 | ASGI server |
| `pydantic` | 2.13.4 | Validation |
| `slowapi` | 0.1.9 | Rate limiting |
| `pytest` | 9.0.3 | Testing |

---

## Environment Variables Reference

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `USE_POSTGRES` | `false` | No | Enable PostgreSQL |
| `DATABASE_URL` | `postgresql://adapt:adapt@localhost:5432/mercury` | If USE_POSTGRES | PG connection string |
| `DB_PATH` | `Backend/data/mercury.db` | No | SQLite path |
| `ASR_BACKEND` | `whisper` | No | `whisper` or `wav2vec2` |
| `ASR_MODEL` | `openai/whisper-small` | No | HF model ID or local path |
| `WAV2VEC2_MODEL` | `facebook/wav2vec2-large-robust-ft-swbd-300h` | No | Wav2Vec2 model |
| `TTS_MODEL` | `suno/bark` | No | Bark TTS model |
| `AUTH_ENABLED` | `true` ⚠️ | No | **Should be `false` for dev** |
| `AUTH_SECRET_KEY` | — | **Yes** | JWT signing key (32+ chars) |
| `BACKDOOR_KEY` | — | **Yes** | Owner backdoor access |
| `GOOGLE_CLIENT_ID` | — | If AUTH_ENABLED | OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | — | If AUTH_ENABLED | OAuth secret |
| `AUTH_REDIRECT_URI` | `http://localhost:5000/auth/callback` | No | OAuth callback |
| `ENABLE_DENOISING` | `true` | No | noisereduce pre-processing |
| `AUTO_TRAIN_THRESHOLD` | `50` | No | Min samples for auto-LoRA |
| `CONFIDENCE_TEMPERATURE` | `1.0` | No | Calibration temperature |
| `CONF_THRESHOLD_LOW` | `0.40` | No | Low confidence threshold |
| `SNR_THRESHOLD_LOW` | `10.0` | No | Low SNR threshold (dB) |
| `MAX_AUDIO_MB` | `50` | No | Upload size limit |
| `CORS_ORIGINS` | `http://localhost:3000` | No | Allowed CORS origins |

---

## Quick Commands Reference

```bash
# Setup
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt

# Run tests (excludes slow TTS/LoRA)
pytest -m "not slow" -v

# Run all tests
pytest -v

# Start backend
set PYTHONPATH=%CD%;%CD%\Backend
uvicorn Backend.app:app --host 0.0.0.0 --port 5000 --reload

# Start frontend (separate terminal)
cd frontend-react
npm install
npm run dev

# Docker
docker-compose up --build

# Seed demo data
python Backend/seed_demo.py --count 40

# Reset database
rm Backend/data/mercury.db
```

---

## Architecture Diagram (Text)

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React 18)                       │
│  Dashboard │ Transcribe │ Analytics │ Phonemes │ Queue │ History │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP/JSON (port 5000)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND (FastAPI)                           │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │ ASR Module  │  │ Diagnostics  │  │ Drift Detector         │  │
│  │ Whisper/    │──│ Confidence,  │──│ CUSUM + Confusion      │  │
│  │ Wav2Vec2    │  │ CER/WER/PER, │  │ Matrix (30% threshold) │  │
│  └─────────────┘  │ Noise, SNR   │  └────────────────────────┘  │
│       │           └──────────────┘              │               │
│       ▼                   │                     ▼               │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │ TTS Engine  │  │ Priority Q   │  │ LoRA Trainer           │  │
│  │ (Bark)      │──│ Domain vocab │──│ AdaLoRA + Replay Buffer│  │
│  └─────────────┘  └──────────────┘  └────────────────────────┘  │
│       │                   │                     │               │
│       ▼                   ▼                     ▼               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              DATABASE (SQLite / PostgreSQL)              │  │
│  │ transcriptions • phoneme_tracking • phoneme_errors      │  │
│  │ priority_queue • replay_buffer • drift_events           │  │
│  │ vocabulary_terms • training_runs                         │  │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Contributing

1. Fork → feature branch → PR against `main`
2. All tests must pass (`pytest -m "not slow"`)
3. Follow existing code style (type hints, no redundant comments)
4. Update `DOCUMENTATION.md` and `HISTORY.md` for significant changes