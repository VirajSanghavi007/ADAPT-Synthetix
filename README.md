---
title: Mercury
emoji: 🎙️
colorFrom: blue
colorTo: purple
sdk: docker
pinned: false
license: mit
---

# Mercury — Adaptive Closed-Loop ASR Framework

Mercury is a research-grade speech pipeline that combines ASR, diagnostics, drift monitoring, and TTS-driven remediation into a single closed loop.

## Features

- **ASR Backends**: Whisper (default) or Wav2Vec2
- **Diagnostics**: Confidence scoring, CER/WER/PER, noise fingerprinting, phoneme error alignment
- **Drift Detection**: CUSUM trend detection + confusion matrix (30% threshold)
- **Priority Queue**: Domain-weighted remediation (medical/emergency vocabulary)
- **LoRA Fine-Tuning**: AdaLoRA + Experience Replay + Mixture of Experts
- **TTS Remediation**: Bark synthesis for corrective audio

## Quick Start (Local)

```bash
# Backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
set PYTHONPATH=%CD%;%CD%\Backend
uvicorn Backend.app:app --host 0.0.0.0 --port 5000 --reload

# Frontend (separate terminal)
cd frontend-react
npm install
npm run dev
```

## Docker

```bash
docker-compose up --build
```

## Hugging Face Spaces

This Space runs the full Mercury stack (FastAPI backend + React frontend) in a single container.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `USE_POSTGRES` | `false` | Enable PostgreSQL |
| `DATABASE_URL` | - | PostgreSQL connection string |
| `ASR_BACKEND` | `whisper` | `whisper` or `wav2vec2` |
| `ASR_MODEL` | `openai/whisper-small` | HF model ID |
| `TTS_MODEL` | `suno/bark-small` | Bark TTS model |
| `AUTH_ENABLED` | `false` | Enable Google OAuth |
| `AUTH_SECRET_KEY` | **required** | JWT signing key (32+ chars) |
| `BACKDOOR_KEY` | **required** | Owner access key |
| `ENABLE_DENOISING` | `true` | Spectral noise reduction |
| `AUTO_TRAIN_THRESHOLD` | `50` | Min samples for auto-LoRA |

### Required Secrets

Set these in Space Settings → Variables and secrets:
- `AUTH_SECRET_KEY` — `python -c "import secrets; print(secrets.token_hex(32))"`
- `BACKDOOR_KEY` — strong random string
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (if `AUTH_ENABLED=true`)

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/transcribe` | ASR + full diagnostics |
| POST | `/synthesize` | TTS synthesis |
| GET | `/sessions` | Recent transcriptions |
| GET | `/drift_report` | Phoneme drift analysis |
| GET | `/priority_queue` | Remediation queue |
| GET | `/lora_status` | LoRA adapter state |
| POST | `/train` | Trigger LoRA training |
| POST | `/fetch_drive` | Download from Google Drive |

## Architecture

```
Audio Input → ASR (Whisper/Wav2Vec2) → Diagnostics → Drift Detector
                    ↓
              Priority Queue ← Domain Vocab
                    ↓
              TTS Remediation ← LoRA Trainer (AdaLoRA + Replay)
```

## Research Contributions

1. **Reference-Aligned Phoneme Error Diagnosis** — maps errors to phoneme edit operations
2. **8-Feature Noise Fingerprinting** — spectral centroid, bandwidth, rolloff, ZCR, RMS, MFCC variance, tempo, harmonic ratio
3. **Confidence-Weighted Priority Queue** — escalates domain-critical errors
4. **CUSUM Drift Monitoring** — detects sustained degradation per phoneme
5. **Domain Vocabulary Injection** — medical/emergency terms prioritized

## License

MIT