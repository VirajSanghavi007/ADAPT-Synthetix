# ADAPT-Synthetix 2.0

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
cp "Secret Files/.env.example" "Secret Files/.env"   # fill in Supabase URL/keys, DB password — never commit real values
cd Frontend && cp .env.local.example .env.local       # if present, else see .env.local
docker compose -f Docker/docker-compose.yml up -d     # starts Redis (DB is Supabase, not local)
run.bat                                                # creates venv, installs deps, starts backend, opens browser
```

Frontend dev server: `cd Frontend && npm install && npm run dev`.

Database migrations live in `Backend/migrations/*.sql` — applied by hand via the
Supabase SQL editor, no runner script yet. Apply in numeric order.

## Deploying

Docker-based (`Docker/Dockerfile`, `Docker/docker-compose.yml`) — build context is the
repo root, not `Docker/` itself, since the Dockerfile pulls in `Backend/`, `Frontend/`,
and `requirements.txt` from there. `Backend/scripts/prefetch_models.py` can bake all
model weights into the image at build time (`PREFETCH_MODELS=true` build arg) to avoid
runtime cold-start downloads. Pro/Max currently serve the same model as Free — the
differentiated catalog is paused, not fine-tuned yet.

## Project structure

- `Backend/` — FastAPI app, model catalog + tier gating (`tiers.py`), ASR/TTS engines
  (`asr_pipeline.py`), MCP server, API keys, enterprise/account/profile endpoints
- `Frontend/` — Next.js 16 app (dashboard, error analysis, account/profile,
  subscription, settings, onboarding, docs, enterprise demo)
- `Docker/` — `Dockerfile`, `docker-compose.yml`, and the ASR/TTS model `spaces/`
- `Documentation/` — internal dev-process docs, gitignored (repo is public)
- `Secret Files/` — env files, gitignored

See `Documentation/MEMORY.md` for the full version history and architecture narrative.
