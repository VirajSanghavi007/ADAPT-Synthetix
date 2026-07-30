# Mercury

Adaptive speech-to-text and text-to-speech for lecture and medical transcription, with
phoneme-level error diagnostics. Six tier-gated ASR/TTS models, a REST API + MCP server
for third-party/agent access, enterprise accounts, and a Next.js frontend.

- **ASR** (tiered): [Distil-Whisper-Large-v3](https://huggingface.co/distil-whisper/distil-large-v3) (Free) · [Whisper-Large-v3-Turbo](https://huggingface.co/openai/whisper-large-v3-turbo) (Pro) · [Parakeet-TDT-0.6B-v2](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v2) (Max/Enterprise)
- **TTS** (tiered): [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) (Free) · [Bark](https://huggingface.co/suno/bark) (Pro) · [CosyVoice2-0.5B](https://github.com/FunAudioLLM/CosyVoice) (Max/Enterprise)
- **Auth**: Supabase (email/password, Google OAuth, TOTP 2FA) — enterprise accounts use a custom employee-ID factor instead of TOTP
- **API**: REST (`/api/*`, session bearer or `X-API-Key`) + MCP server (`/mcp`) for agent access

None of the 6 models are fine-tuned yet — pretrained inference only, fine-tuning is planned separately (see `MEMORY.md`).

## Local setup

```bash
cp .env.example .env         # fill in Supabase URL/keys, DB password — never commit real values
cd frontend-next && cp .env.local.example .env.local  # if present, else see .env.local
docker compose up -d          # starts Redis (DB is Supabase, not local)
run.bat                       # creates venv, installs deps, starts backend, opens browser
```

Frontend dev server: `cd frontend-next && npm install && npm run dev`.

Database migrations live in `Backend/migrations/*.sql` — applied by hand via the
Supabase SQL editor, no runner script yet. Apply in numeric order.

## Deploying

Docker-based (`Dockerfile` + `render.yaml`), currently targeting **Render**. See
`render.yaml` for the service config — set real secrets in Render's dashboard, not in
the yaml. `Backend/scripts/prefetch_models.py` can bake all 6 models' weights into the
image at build time (`PREFETCH_MODELS=true` build arg) to avoid runtime cold-start
downloads.

## Project structure

- `Backend/` — FastAPI app, model catalog + tier gating (`tiers.py`), ASR/TTS engines
  (`asr_pipeline.py`), MCP server, API keys, enterprise/account/profile endpoints
- `frontend-next/` — Next.js 16 app (dashboard, error analysis, account/profile,
  subscription, settings, onboarding, docs)
- `mobile/` — Expo/React Native scaffold (record/transcribe, TTS)
- `n8n/` — workflow JSON for retrain-threshold notification and account-deletion cron
- `design-system/mercury/MASTER.md` — the frontend's design tokens/style guide

See `MEMORY.md` for the full version history and architecture narrative.
