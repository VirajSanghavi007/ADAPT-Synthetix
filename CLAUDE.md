# ADAPT-Synthetix — Developer Reference

## Project Layout

```
ADAPT-Synthetix/
├── Backend/                           # FastAPI application (Python 3.11+)
│   ├── app.py                         # All API routes (lifespan pattern)
│   ├── config.py                      # Env-var config + directory initialization
│   ├── database.py                    # SQLite / PostgreSQL dual-mode layer
│   │
│   ├── Core ML Modules
│   ├── asr_module.py                  # Whisper ASR inference + logits
│   ├── tts_engine.py                  # Bark TTS (thread-safe, int16 output)
│   ├── lora_trainer.py                # AdaLoRA fine-tuning with layer freezing
│   ├── lora_experts.py                # LoRA Expert Router (MoE architecture)
│   ├── experience_replay.py           # Replay buffer for continual learning
│   │
│   ├── Diagnostics & Monitoring
│   ├── diagnostics.py                 # CTC confidence, PER, WER, SNR, phonemes
│   ├── drift_detector.py              # CUSUM + MMD drift, calibration metrics
│   ├── noise_fingerprint.py           # Acoustic noise classifier
│   ├── priority_queue.py              # Remediation queue with domain multipliers
│   ├── session_logger.py              # JSONL session logging with rotation
│   │
│   ├── Data Management
│   ├── dataset_manager.py             # Dataset registration and stats
│   ├── dataset_downloader.py          # Google Drive dataset fetching
│   ├── auth.py                        # API authentication (optional)
│   ├── db_utils.py                    # Database utility functions
│   └── models/                        # Local model checkpoints (git-ignored)
│       ├── whisper/                   # Local Whisper model
│       ├── bark-small/                # Local Bark TTS model
│       └── lora/                      # LoRA adapter checkpoints
│
├── frontend-react/                    # React 18 + Vite frontend
│   ├── index.html                     # Vite entry point
│   ├── vite.config.js                 # Vite config with proxy + code splitting
│   ├── src/
│   │   ├── main.jsx                   # React root + QueryClient + Router
│   │   ├── App.jsx                    # Routes (lazy-loaded pages)
│   │   ├── styles/globals.css         # CSS custom properties + resets
│   │   ├── lib/
│   │   │   ├── theme.js               # Design tokens (C.* color constants)
│   │   │   └── api.js                 # All API functions (typed, no axios)
│   │   ├── store/index.js             # Zustand — useSessionStore + useUIStore
│   │   ├── hooks/
│   │   │   ├── useRecorder.js         # MediaRecorder hook
│   │   │   └── useKeyboardShortcuts.js  # Keyboard nav + Cmd+K
│   │   ├── components/
│   │   │   ├── layout/                # Layout, Sidebar, TopBar
│   │   │   ├── ui/                    # Button, Card, Badge, Toast, Waveform, etc.
│   │   │   └── charts/                # Histograms, heatmaps, pie charts
│   │   └── pages/                     # Dashboard, Transcribe, Analytics, etc.
│
├── tests/                             # pytest test suite
├── docs/RESEARCH.md                   # Academic papers & algorithms
├── .env.example                       # All environment variables
├── requirements.txt                   # Python dependencies (cleaned)
├── Dockerfile                         # Multi-stage CPU-only build
├── docker-compose.yml                 # App + Postgres + volumes
├── render.yaml                        # Render.com deployment config
└── .github/workflows/deploy.yml       # CI → Docker push → Render deploy
```

## Running Locally

### Prerequisites
- **Python 3.11+** (backend)
- **Node.js 18+** (frontend)
- **PyTorch CPU** or **CUDA 11.8+** (already in requirements.txt)

### Setup & Start

**Terminal 1: Backend**
```bash
# Create and activate virtual environment
python -m venv venv
venv\Scripts\activate              # Windows
# source venv/bin/activate         # macOS/Linux

# Install dependencies (CPU-only by default)
pip install -r requirements.txt

# Set Python path and start server
set PYTHONPATH=%CD%;%CD%\Backend   # Windows
# export PYTHONPATH=$PWD:$PWD/Backend  # macOS/Linux
uvicorn Backend.app:app --host 0.0.0.0 --port 5000 --reload
```

**Terminal 2: Frontend** (requires Node.js 18+)
```bash
cd frontend-react
npm install
npm run dev        # Opens http://localhost:3000/app (proxies to :5000)
```

### Populate Demo Data (Optional)
```bash
python Backend/seed_demo.py --count 40
# Use --clear to truncate existing data before seeding
```

## Key Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `USE_POSTGRES` | `false` | Use PostgreSQL instead of SQLite |
| `DATABASE_URL` | `sqlite:///Backend/data/adaptsynthetix.db` | PostgreSQL connection string (ignored if `USE_POSTGRES=false`) |
| `ASR_MODEL` | `openai/whisper-small` | ASR model ID (Hugging Face) |
| `TTS_MODEL` | `suno/bark-small` | TTS model ID |
| `CONFIDENCE_TEMPERATURE` | `1.0` | CTC confidence calibration scale |
| `CONF_THRESHOLD_LOW` | `0.40` | Min confidence for accent detection |
| `SNR_THRESHOLD_LOW` | `10.0` | Min SNR (dB) to bypass denoising |
| `TRANSFORMERS_CACHE` | `.cache/hf` | HuggingFace model cache directory |
| `MAX_AUDIO_MB` | `50` | Max upload size in MB |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated allowed origins |
| `AUTH_ENABLED` | `false` | Enable API authentication |
| `ENABLE_DENOISING` | `true` | Enable audio denoising (noisereduce) |
| `AUTO_TRAIN_THRESHOLD` | `5` | Min samples before auto fine-tuning |

See `.env.example` for all available variables.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | System health + session ID |
| POST | `/transcribe` | ASR + full diagnostics |
| POST | `/synthesize` | TTS synthesis (WAV response) |
| GET | `/sessions?limit=N` | Recent transcriptions (all dates) |
| GET | `/remediation_status` | Error counts + remediation rate |
| GET | `/drift_report` | CUSUM phoneme drift by trend |
| GET | `/confidence_histogram?bins=N` | Phoneme confidence histogram |
| GET | `/phoneme_error_report` | Top errors + systematic confusions |
| GET | `/calibration_metrics` | ECE + overconfidence ratio |
| GET | `/noise_report` | Noise type breakdown |
| GET | `/priority_queue` | Remediation queue |
| GET | `/vocabulary_check?text=X` | Domain vocabulary match |
| GET | `/lora_status` | LoRA adapter state |
| GET | `/lora_experts_status` | Per-expert adapter status |
| GET | `/dataset_stats` | Dataset composition |
| POST | `/fetch_drive` | Fetch audio from Google Drive |

## Research Papers Implemented

See `docs/RESEARCH.md` for full details. Key papers:

1. **Rumberg et al. Interspeech 2023** — CTC token uncertainty
2. **Ernez et al. PMLR 2023** — Conformal prediction priority queue
3. **DyPCL / POWER** — Phoneme confusion matrix (30% threshold)
4. **arXiv:2407.05375** — CUSUM drift detection
5. **Zhang et al. ICLR 2023** — AdaLoRA adaptive rank
6. **Mu et al. ICASSP 2025** — HDMoLE LoRA-MoE routing
7. **Pekarek Rosin & Wermter ICANN 2023** — Layer freezing + 10% replay
8. **Guo et al. ICML 2017** — Expected Calibration Error (ECE)

## Testing

```bash
# Run all tests
pytest tests/ -v

# Run specific test file
pytest tests/test_diagnostics.py -v

# Run with coverage
pytest tests/ --cov=Backend --cov-report=term-missing
```

All tests use **temporary SQLite databases** — no production DB affected.

### Test Database
Tests automatically create isolated databases via `database.py:get_test_db()`. Database is cleaned up after each test.

## Frontend Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `d` | Dashboard |
| `t` | Transcribe |
| `a` | Analytics |
| `p` | Phoneme Explorer |
| `q` | Priority Queue |
| `h` | History |
| `m` | Model Hub |
| `Cmd+K` (or `Ctrl+K`) | Command Palette |

## Debugging

### Backend Logs
```bash
# Enable debug logging (add to .env)
export LOGLEVEL=DEBUG
```

### Database Issues
```bash
# Reset SQLite database (WARNING: deletes all data)
rm Backend/data/adaptsynthetix.db

# Start fresh with demo data
python Backend/seed_demo.py --clear --count 40
```

### Model Issues
```bash
# Check ASR model is loaded
curl http://localhost:5000/health | jq '.asr_model'

# Force model download
export TRANSFORMERS_CACHE=.cache/hf
python -c "from transformers import AutoModelForCTC; AutoModelForCTC.from_pretrained('openai/whisper-small')"
```

### Frontend Dev Tools
- Open http://localhost:3000/app in browser
- Dev Tools → Network tab to inspect API calls
- React DevTools extension for component debugging

## Deployment

### Docker
```bash
# Build
docker build -t adapt-synthetix .

# Run with Docker Compose
docker-compose up

# App runs at http://localhost:5000
```

### Environment for Production
Copy `.env.example` → `.env.prod` and set:
```bash
USE_POSTGRES=true
DATABASE_URL=postgresql://user:pass@db:5432/adaptsynthetix
CORS_ORIGINS=https://your-domain.com
AUTH_ENABLED=true
```

## Code Style & Guidelines

### Python (Backend)
- Use **type hints** for all functions
- Keep modules focused: one responsibility per file
- Use existing patterns from `app.py` and `database.py`
- No comments unless WHY is non-obvious (avoid restating code)
- Tests are in `tests/` using pytest fixtures

### JavaScript/React (Frontend)
- Components in `src/components/`
- API calls go through `src/lib/api.js` (no axios/fetch in components)
- Use Zustand stores in `src/store/` for state
- CSS via CSS modules or `styles/globals.css`
- Lazy-load heavy pages in `src/pages/`

### Git Workflow
1. Create a feature branch: `git checkout -b feat/feature-name`
2. Make changes and commit
3. Push and open a PR against `main`
4. All tests must pass before merging
