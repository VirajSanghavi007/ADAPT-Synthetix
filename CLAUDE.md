# ADAPT-Synthetix — Developer Reference

## Project Layout

```
ADAPT-Synthetix/
├── Backend/                   # FastAPI application (Python 3.11+)
│   ├── app.py                 # All API routes (lifespan pattern)
│   ├── config.py              # Env-var configuration + init_directories()
│   ├── database.py            # SQLite / PostgreSQL dual-mode DB layer
│   ├── diagnostics.py         # CTC confidence, PER, WER, SNR, phoneme alignment
│   ├── drift_detector.py      # CUSUM + MMD drift detection, calibration metrics
│   ├── noise_fingerprint.py   # Acoustic noise classifier (fixed harmonic_ratio)
│   ├── priority_queue.py      # Remediation queue with domain multipliers
│   ├── asr_module.py          # Wav2Vec2 inference
│   ├── tts_engine.py          # Bark TTS (thread-safe, int16 output)
│   ├── lora_trainer.py        # AdaLoRA fine-tuning with layer freezing
│   ├── lora_experts.py        # LoRA Expert Router (MoE architecture)
│   ├── experience_replay.py   # Replay buffer for continual learning
│   ├── session_logger.py      # JSONL session logging with rotation
│   ├── dataset_manager.py     # Dataset registration and stats
│   └── models/                # Local model checkpoints (git-ignored)
│       ├── wav2vec2/          # Optional local ASR model
│       ├── bark-small/        # Optional local TTS model
│       └── lora/              # LoRA adapter checkpoints
│
├── frontend-react/            # React 18 + Vite frontend
│   ├── index.html             # Vite entry point (root, not public/)
│   ├── vite.config.js         # Vite config with proxy + code splitting
│   ├── src/
│   │   ├── main.jsx           # React root + QueryClient + Router
│   │   ├── App.jsx            # Routes (lazy-loaded pages)
│   │   ├── styles/globals.css # CSS custom properties + resets
│   │   ├── lib/
│   │   │   ├── theme.js       # Design tokens (C.* color constants)
│   │   │   └── api.js         # All API functions (typed, no axios)
│   │   ├── store/index.js     # Zustand — useSessionStore + useUIStore
│   │   ├── hooks/
│   │   │   ├── useRecorder.js       # MediaRecorder hook (fixed dep array)
│   │   │   └── useKeyboardShortcuts.js  # d/t/a/p/q/h/m nav + Cmd+K
│   │   ├── components/
│   │   │   ├── layout/        # Layout, Sidebar, TopBar
│   │   │   ├── ui/            # Card, Badge, Button, StatCard, Toast, Waveform, Spinner, CommandPalette
│   │   │   └── charts/        # ConfidenceHistogram, NoiseBreakdown, ErrorTypePie, PhonemeHeatmap
│   │   └── pages/             # Dashboard, Transcribe, Analytics, PhonemeExplorer, PriorityQueue, History, ModelHub
│
├── Frontend/                  # Vanilla JS frontend (still served at /)
│
├── tests/                     # pytest test suite
├── docs/RESEARCH.md           # Academic papers implemented
├── .env.example               # All env vars documented
├── Dockerfile                 # Multi-stage CPU-only build
├── docker-compose.yml         # App + Postgres + named volumes
├── render.yaml                # Render.com deployment config
└── .github/workflows/deploy.yml  # CI → Docker push → Render deploy
```

## Running Locally

```bash
# Backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
set PYTHONPATH=%CD%;%CD%\Backend
uvicorn Backend.app:app --host 0.0.0.0 --port 5000 --reload

# Frontend (separate terminal — Node.js 18+ required)
cd frontend-react
npm install
npm run dev                  # http://localhost:3000/app
```

## Key Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `USE_POSTGRES` | `false` | Switch to PostgreSQL |
| `DATABASE_URL` | sqlite | PostgreSQL connection string |
| `CONFIDENCE_TEMPERATURE` | `1.0` | CTC calibration temperature |
| `CONF_THRESHOLD_LOW` | `0.40` | Accent detection threshold |
| `SNR_THRESHOLD_LOW` | `10.0` | Noise SNR threshold (dB) |
| `TRANSFORMERS_CACHE` | `.cache/hf` | HuggingFace model cache |
| `MAX_AUDIO_MB` | `50` | Max upload size |
| `CORS_ORIGINS` | `http://localhost:3000` | Allowed CORS origins |

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

## Demo Data

Populate the dashboards with synthetic data on first run:

```bash
python Backend/seed_demo.py --count 40
```

Use `--clear` to truncate existing data before seeding. The script inserts realistic transcription rows, phoneme tracking records, and priority queue items.

## Tests

```bash
pytest tests/ -x -q
```

All tests use temporary SQLite databases — no real DB affected.

## Frontend Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `d` | Dashboard |
| `t` | Transcribe |
| `a` | Analytics |
| `p` | Phoneme Explorer |
| `q` | Queue |
| `h` | History |
| `m` | Model Hub |
| `Cmd+K` | Command palette |
