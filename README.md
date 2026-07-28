---
title: Mercury
emoji: 🔊
colorFrom: blue
colorTo: gray
sdk: docker
app_port: 7860
pinned: false
---

# Mercury

ASR + TTS demo — speak into the mic and see the transcript, or type text and hear it spoken. Passkey (WebAuthn) sign-in, no passwords. Postgres-backed logging locally, SQLite fallback when no external DB is configured (e.g. on HF Spaces).

- **ASR**: [faster-whisper](https://github.com/SYSTRAN/faster-whisper) (small, int8, CPU)
- **TTS**: [Kokoro](https://huggingface.co/hexgrad/Kokoro-82M) (82M, CPU)

## Local setup

```bash
cp .env.example .env    # fill in AUTH_SECRET_KEY, POSTGRES_PASSWORD
docker compose up -d    # starts Postgres
run.bat                 # creates venv, installs deps, starts backend, opens browser
```

## Deploying to Hugging Face Spaces

This repo's `Dockerfile` + this README's front-matter target a **Docker Space**.

1. Create a new Space (SDK: Docker), push this repo to it.
2. Set Space secrets: `AUTH_SECRET_KEY`, `RP_ID` (your Space's domain, e.g. `you-mercury.hf.space`), `ORIGIN` (`https://you-mercury.hf.space`), `CORS_ORIGINS` (same origin), `ENV=production`.
3. Optional: set `DATABASE_URL` to an external Postgres (e.g. Neon/Supabase free tier) for persistence — HF Spaces storage is ephemeral, so the SQLite fallback resets on rebuild.

See [HISTORY.md](HISTORY.md) for the project's background/changelog and [notebooks/mercury_finetune.ipynb](notebooks/mercury_finetune.ipynb) for the Parakeet/CosyVoice2 fine-tuning plan.
