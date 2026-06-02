# ADAPT-Synthetix
### Adaptive Closed-Loop ASR Framework with Phoneme-Level Error Diagnosis

ADAPT-Synthetix is a research-grade speech pipeline that links Wav2Vec2 automatic speech recognition with a multi-layer diagnostic engine and TTS-driven remediation. Beyond returning transcripts, it scores confidence, fingerprints acoustic noise, computes CER/phoneme errors against a reference, prioritises errors by domain criticality, detects model drift, and prepares LoRA fine-tuning data — all in a single closed loop. It is designed for iterative academic experimentation in noisy, accented, and domain-specific speech scenarios.

---

## Quick Setup

```bash
git clone https://github.com/VirajSanghavi007/ADAPT-Synthetix
cd ADAPT-Synthetix
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
uvicorn Backend.app:app --host 0.0.0.0 --port 5000 --reload
```

Open `http://localhost:5000` in your browser.

**PostgreSQL (production):**
```bash
USE_POSTGRES=true DATABASE_URL=postgresql://user:pass@localhost:5432/adaptsynthetix uvicorn Backend.app:app --port 5000
```

---

## Frontends

| Frontend | Path | Description |
|----------|------|-------------|
| Legacy (vanilla JS) | `Frontend/` | Dark terminal UI — mic recording, waveform, file upload |
| React UI | `frontend-react/` | Component-based UI — stats dashboard, history panel, drag-and-drop upload |

To run the React UI (requires Node.js):
```bash
cd frontend-react
npm install
npm start   # http://localhost:3000 — proxies API to :5000
```

---

## Full Documentation
- Technical reference: [`DOCUMENTATION.md`](DOCUMENTATION.md)
- Research paper draft: [`Documentation/RESEARCH_PAPER_DRAFT.md`](Documentation/RESEARCH_PAPER_DRAFT.md)

---

## Research Contributions

1. **Reference-Aligned Phoneme Error Diagnosis** — Maps transcription errors to phoneme edit operations rather than word-level summaries, identifying which sounds the model confuses.

2. **8-Feature Noise Fingerprinting** — Classifies background acoustic conditions (clean / traffic / crowd / machinery / indoor) using spectral centroid, bandwidth, rolloff, ZCR, RMS energy, MFCC variance, tempo, and harmonic ratio.

3. **Confidence-Weighted Priority Queue** — Weights remediation priority by model confidence score; low-confidence errors on medical or emergency vocabulary are escalated above low-priority filler errors.

4. **Phoneme-Level Drift Monitoring** — Tracks per-phoneme confidence trends across sessions with a 20-utterance window; triggers retraining alert when ≥5 phonemes enter high-risk state.

5. **Domain Vocabulary Injection** — Medical and emergency vocabulary list used to flag safety-critical transcription errors at higher remediation priority regardless of overall CER.

---

## Benchmark Results

> Pre-LoRA baseline using `facebook/wav2vec2-base-960h` on LibriSpeech test-clean.  
> LoRA training requires ≥5 remedial audio samples in the database.  
> Run `python benchmark.py --dataset Dataset/ --category clean` to populate these numbers.

| Category | Sample Count | Avg CER | Min CER | Max CER |
|----------|-------------|---------|---------|---------|
| clean    | 2620        | —       | —       | —       |
| noisy    | —           | —       | —       | —       |
| accented | —           | —       | —       | —       |
| medical  | —           | —       | —       | —       |

*(Run the benchmark after registering labelled samples to fill in CER values.)*

---

## Docker Quick Start
```bash
docker-compose up
# Open http://localhost:5000
```

## Deployment

ADAPT-Synthetix deploys to [Render](https://render.com) (free tier works for a research demo) with automatic CI/CD via GitHub Actions.

### One-time setup

1. **Fork & push** this repo to your GitHub account.
2. Go to [render.com](https://render.com) → New → Web Service → connect your GitHub repo.
   Render auto-detects `render.yaml` and configures the service.
3. Copy the **Deploy Hook URL** from Render dashboard → your service → Settings → Deploy Hook.
4. In your GitHub repo → Settings → Secrets → Actions, add a secret:
   - `RENDER_DEPLOY_HOOK_URL` = the URL copied above.

### How it works

Every push to `main` triggers the GitHub Actions pipeline (`.github/workflows/deploy.yml`):

1. **test** — runs `pytest tests/ -x -q` with the pinned CPU-only PyTorch stack.
2. **build-and-push** — builds the Docker image and pushes it to `ghcr.io/<your-repo>:latest`.
3. **deploy** — calls the Render deploy hook, which pulls the new image and restarts the service.

### Environment variables

Copy `.env.example` to `.env` for local Docker Compose runs:

```bash
cp .env.example .env
docker-compose up
```

For Render, set env vars in the Render dashboard (or `render.yaml`). The `RENDER_DEPLOY_HOOK_URL` secret stays in GitHub — Render never needs it.

### Persistent model cache

The `render.yaml` attaches a 10 GB disk at `/app/.cache` so HuggingFace models survive redeploys without re-downloading.
