# MEMORY.md — Mercury Project Changelog & Version History

(Renamed from HISTORY.md on 2026-07-30 — same purpose: persistent project memory.)

## Project Overview
**Mercury** — Adaptive Closed-Loop ASR Framework with Phoneme-Level Error Diagnosis
- **Original Repo**: https://github.com/VirajSanghavi007/Mercury
- **Current Branch**: Test (work happens here — see CLAUDE.md branch policy: Test → Stage by Claude, Stage → main only by Viraj)
- **Language**: Python 3.11+ (Backend), Next.js 16 + React 19 (Frontend)
- **Architecture**: FastAPI + Supabase (Auth + Postgres) + Redis + multi-engine ASR/TTS (NeMo/HF transformers/Kokoro/Bark/CosyVoice2)

---

## Version History

### v5.4.0 — "Platform Buildout" (2026-07-30)
**Status**: Backend/frontend feature-complete for a single large session; nothing deployed or end-to-end tested yet. See VERSION.md (gitignored, local) for the terse changelog going forward.

Major additions in one continuous session, on top of the v3.0.0 rebuild below:
- **Data layer**: switched from local Docker Postgres back to Supabase Postgres (session pooler) for logging. Added `PhonemeError`, `ApiKey`, `TrainingMarker`, `AccountDeletionRequest` tables plus `profiles` columns for tier/username/avatar/enterprise/company/role.
- **Phoneme-error tracking** ported from v2's `drift_detector.py`/`diagnostics.py`: `Backend/phoneme_diagnostics.py` (g2p + Levenshtein alignment), `/api/errors/report` confusion-matrix endpoint, Error Analysis dashboard page. CUSUM confidence-drift detection NOT ported (needs per-phoneme confidence the new ASR pipeline doesn't expose yet).
- **Model catalog** (`Backend/tiers.py`, `Backend/asr_pipeline.py`): 6 models total — ASR: Parakeet-TDT-0.6B (Max), Whisper-Large-v3-Turbo (Pro), Distil-Whisper-Large-v3 (Free); TTS: CosyVoice2-0.5B (Max), Bark (Pro), Kokoro-82M (Free). Multi-engine dispatch (NeMo / HF transformers pipeline / Kokoro / Bark / CosyVoice2), lazy-loaded and cached per model. Tier-based rate limiting via Redis (free 30/hr, pro 300/hr, max/enterprise 5000/hr). None of the 6 fine-tuned yet — deliberately deferred.
- **Audio format handling**: `soundfile` (wav/flac/ogg) with `pydub`+ffmpeg fallback for mp3/mp4/aac/3gpp/amr; explicit 415 for anything else.
- **API key service** (`Backend/api_keys.py`): third-party keys, tiered rate limits, `X-API-Key` auth alternative to Supabase session bearer.
- **MCP server** (`Backend/mcp_server.py`, mounted at `/mcp`): exposes transcribe/synthesize/list_models/error_report as MCP tools, same API-key auth. Header passthrough to MCP tool context is UNVERIFIED (no real install tested).
- **Bulk ingestion** (`Backend/ingest.py`): multi-file computer upload, Google Drive import (client-side OAuth token via `lib/googleDrive.ts`, never persisted server-side).
- **Frontend rebuild**: full shadcn (base-nova/@base-ui) + custom design system (cyan/health-green, Figtree+Noto Sans, generated via ui-ux-pro-max skill, `design-system/mercury/MASTER.md`). App shell with sidebar nav, Dashboard, Error Analysis, Profile (separate from Account), Account (security-only: email/phone-with-country-picker/password/2FA/Google link/delete), Settings (theme+notifs+guided-tour replay), Subscription (mock Stripe-style checkout UI, no real payment gateway), onboarding (username+10 built-in avatars), guided tour (skippable, replayable), cookie consent, Privacy Policy (India DPDP Act 2023), API reference docs page (`/api-reference`), right-click/copy guard (cosmetic only, not real protection).
- **Enterprise accounts**: separate signup (`/enterprise-signup`), free at Max-tier model access, no Subscription tab, collects company name + role, and a **custom employee-ID auth factor replacing TOTP entirely** (`Backend/enterprise.py`, `EnterpriseChallenge.tsx`) — Supabase MFA only supports totp/phone/webauthn natively, so this is fully custom, backend-checked against a hashed ID on the profile.
- **Account deletion**: email-verified (`Backend/account.py`), confirming schedules deletion **24 hours out** (not immediate) — full purge of `asr_logs`/`tts_logs`/`phoneme_errors`/`api_keys` plus the Supabase auth user, executed by a cron-secret-protected endpoint (`/api/account/delete/execute-pending`) triggered hourly via `n8n/account_deletion_cron.json`. Irreversible once executed. SMTP not configured by default — falls back to returning the confirm link directly in dev.
- **Mobile app** (`mobile/`): Expo/React Native scaffold — login (email/password only), record→transcribe, TTS. No enterprise mode (deliberately excluded). `npm install` never run, unverified.
- **Deployment**: `render.yaml` (Docker runtime, `/api/health` healthcheck, 20GB model-cache disk). Dockerfile can bake all 6 models' weights in at build time (`Backend/scripts/prefetch_models.py`, `PREFETCH_MODELS` build arg, HF token via BuildKit secret) to avoid runtime cold-start downloads — unverified, no real build run.
- **n8n workflows**: `retrain_trigger.json` (threshold-check + notify, not auto-retrain), `account_deletion_cron.json`.
- **Git workflow**: `Test` (day-to-day work) → `Stage` (Claude may push) → `main` (human-only from now on). Branch policy recorded in root `CLAUDE.md`.
- **Real bugs found and fixed along the way**: Next 16 base-ui `render` prop misuse (Button-as-Link anti-pattern, several places), a hydration mismatch from the theme-init script (needed `suppressHydrationWarning`), Supabase MFA duplicate-unverified-factor 422 (needed unenroll-stale + unique friendly_name), shadcn CLI silently overwriting the custom `accent` button variant twice.
- **Repeated secret exposure in chat** (again, same pattern as v3.0.0): Supabase service_role/secret keys, DB password, all pasted in plaintext during this session. Flagged each time; rotation recommended for the service_role/secret keys (anon key is public-safe by design, no rotation needed).

**Explicitly deferred to later** (per Viraj's direction, not forgotten): fine-tuning all 6 models (LoRA/PEFT recommended, Kaggle GPU), enterprise bring-your-own-database (dropped — no raw audio is persisted server-side, so the original concern doesn't apply), MLOps (eval harness, experiment tracking, drift detection — planned after first deploy + bugfix pass, "over the basic very very small models"), real payment gateway wiring, hCaptcha → Cloudflare Turnstile switch, Cloudflare Tunnel/WAF for the public deployment.

---

### v3.0.0 — "Clean Rebuild"
**Date**: July 2026
**Status**: In progress — rebuilt from scratch after v2.0.0 was archived (tag `v2.0-legacy`) for being largely vibe-coded via Antigravity with no clear mental model of its own architecture. Goal: a stable, demo-ready product, ASR/TTS on modern pretrained models, real auth, deployable to HF Spaces + a real host.

#### Decision: full restart, not incremental cleanup
Old codebase kept in git history only (`git checkout v2.0-legacy` recovers it in full). Working directory wiped to `.git/`, `.claude/`, `HISTORY.md` before rebuilding, so v3 has no inherited cruft.

#### Model research (for future fine-tuning, not yet trained)
- **ASR fine-tuning targets** — NVIDIA Canary-Qwen 2.5B (best accuracy, #1 Open ASR Leaderboard, CC-BY-4.0, needs NeMo nightly/trunk) vs. **Parakeet-TDT-0.6B-v2** (chosen — CC-BY-4.0, stable NeMo release, faster, proven to load on Kaggle CPU already)
- **TTS fine-tuning targets** — CosyVoice2 (Alibaba, Apache 2.0, official fine-tune recipes, voice cloning) chosen over F5-TTS (better quality but CC-BY-NC, blocks commercial use) and XTTS-v2 (CPML license, GPU-heavy)
- **Demo-pair (zero training, ships today)**: faster-whisper (`small`, int8, CPU) + Kokoro TTS (82M params, Apache 2.0, 54 voices) — chosen over Bark (old project's choice — slow, unstable, hallucinates) for the always-on interactive demo, separate from the fine-tuning track above
- Reference/competitor research: medical ASR (Nuance Dragon Medical One, Suki AI, Abridge, DeepScribe, Nabla, Ambience Healthcare), lecture transcription (Otter.ai, Sonix, Notta, Panopto), and — closest to Mercury's original phoneme-diagnosis angle — ASR confidence/drift monitoring is a genuinely under-served niche (Hamming AI is the closest commercial analog; academic refs: arXiv 2503.15124, arXiv 2107.00099)

#### Fine-tuning datasets identified (not yet integrated into training)
- **Real**: PriMock57 (57 real clinician consultations, free, cloned locally to `Dataset/primock57`, 3.8GB) — manifest-building parser for its actual file layout still TODO in the Kaggle notebook
- **Synthetic**: MedDialog-Audio (HF, 147,476 TTS-synthesized files, ~165GB full size — notebook streams a bounded 5,000-sample subset instead of the full set, which exceeds Kaggle's disk quota), CC BY-NC 4.0

#### Kaggle fine-tuning notebook (`notebooks/mercury_finetune.ipynb`)
Installs NeMo (Parakeet) + CosyVoice2 deps, downloads both pretrained models (confirmed working: Parakeet loaded successfully, 617M params — but on CPU, since the Kaggle session wasn't running with a GPU accelerator enabled), streams PriMock57 + bounded MedDialog-Audio, builds NeMo-format train/val manifests, leaves fine-tune training cells as scaffolded-but-inert until manifests are populated for real.

#### v1 backend/frontend (superseded within this same session)
First pass: FastAPI + faster-whisper + Kokoro, custom WebAuthn passkey auth (own `users`/`credentials` Postgres tables, signed cookie sessions), vanilla HTML/JS/CSS frontend with light/dark/system theme toggle. Fully working (verified via curl + browser) before being replaced.

#### Pivot: Supabase as the auth/DB backend
Decision driven by a pasted task-queue spec assuming Supabase Auth (Google OAuth, RLS-based admin panel) — confirmed as the real direction via user Q&A: keep Supabase (not custom WebAuthn-only), real patient data is eventually planned (**HIPAA implications flagged**: Supabase's Free/Pro tiers are not HIPAA-eligible: a signed BAA requires the Team plan, ~$599/mo — fine for dev now, blocking before any real patient data lands), frontend moves to Next.js (needed for the admin panel).

**Supabase project**: `ojqxzojribpmknxxjije`, region `ap-southeast-1`. Google OAuth provider configured via Google Cloud Console client. DB access via the session pooler (`aws-0-ap-southeast-1.pooler.supabase.com:5432`) — the direct `db.<ref>.supabase.co` hostname doesn't resolve on the free tier without the paid IPv4 add-on.

**DB migration** (`Backend/migrations/001_supabase_auth.sql`): `profiles` table (auto-created via `on_auth_user_created` trigger on `auth.users` insert), `is_admin()` SECURITY DEFINER helper (avoids RLS self-recursion), RLS-enabled `asr_logs`/`tts_logs`/`admin_audit_log`, all FK'd to `auth.users.id` (uuid). Verified live against the real Supabase Postgres instance (5 tables, RLS on 4, FK constraints confirmed by a real failed insert test).

**Auth rewrite** — old WebAuthn/cookie-session code fully removed:
- `Backend/jwks.py` — verifies Supabase-issued JWTs against the public JWKS endpoint (ES256, no shared secret needed)
- `Backend/auth.py` — passkey WebAuthn re-implemented as a *bridge* into real Supabase sessions: verify the WebAuthn assertion server-side, then use the Supabase Admin API's `generate_link` (magiclink) to mint a token, which the client exchanges via `verifyOtp()` for a real session — the pattern needed because Supabase has no native passkey primitive
- `Backend/admin.py` — server-side role-gated admin routes (`/api/admin/users`, `/api/admin/audit-log`), every access logged to `admin_audit_log`
- `Backend/supabase_admin.py` — service_role admin client wrapper

**Final auth model** (per explicit user spec): Google OAuth2, email+password (Supabase-native bcrypt — user asked for Argon2, but Supabase's hosted GoTrue only supports bcrypt; user chose to accept bcrypt over building a custom Argon2 bridge), passkey-primary-with-fallback, forgot-password → email reset link → dedicated `/reset-password` page. Email confirmation-before-login is a Supabase dashboard toggle (Authentication → Providers → Email → "Confirm email") — Google sign-ins are exempt since Google already verifies the address.

**TOTP 2FA**: `MFAEnroll`/`MFAChallenge` components using Supabase's native `auth.mfa` API (enroll → QR code → verify; sign-in gated on `getAuthenticatorAssuranceLevel()` — if a TOTP factor exists but the session hasn't stepped up to aal2, the main app page shows a challenge screen before rendering anything).

**CAPTCHA**: identified as available (Supabase supports hCaptcha/Turnstile natively) but not wired — needs a sitekey from an external provider the user has to sign up for first.

#### Frontend rewrite: vanilla JS → Next.js
`frontend-next/` — Next.js 16.2.10 (App Router, static export via `output: 'export'` + `trailingSlash: true` so FastAPI's `StaticFiles(html=True)` can serve nested routes), Tailwind. Routes: `/` (main app, mic/TTS/theme, gated on session + 2FA), `/login` (all 4 auth methods + passkey/2FA enrollment), `/admin` (role-gated user list + audit log, PII redacted-by-default with a reveal toggle), `/reset-password`. Old vanilla `frontend/` deleted entirely. `Backend/main.py` and the `Dockerfile` both updated to serve/build `frontend-next/out` instead.

Response-time timers added to the transcribe and speak actions (`performance.now()` around the fetch, shown next to the status line in seconds).

#### Infra: Redis + Docker
- **Redis** integrated for the passkey WebAuthn challenge store and slowapi rate-limiting — both were single-process in-memory dicts before (would silently break on restart or multi-worker). `Backend/redis_client.py` pings before use and gracefully falls back to in-memory if Redis is unreachable, so local dev without Docker running still works.
- **Docker**: `docker-compose.yml` rewritten — dropped the dead local-Postgres service (DB is Supabase now, not local Postgres), added `redis` + a real `app` service that builds the `Dockerfile`. `Dockerfile` rewritten as a multi-stage build (Node stage builds `frontend-next`, copies the static export into the Python image) — the old one referenced the deleted vanilla `frontend/` dir and was broken. Neither has been build-tested yet — Docker Desktop's daemon wasn't running on this machine during the session.

#### Security: red-team pass on the Supabase Auth rewrite
Found and fixed one **critical** and one **medium** vulnerability, both self-discovered and self-fixed within the same session (no external pentest):

- **Critical — privilege self-escalation**: the `profiles_update_own` RLS policy (`using (auth.uid() = id)`, no `with check`) restricted which *row* a user could update but not which *columns* — meaning any signed-in user could `PATCH` their own `profiles.role` to `'admin'` directly via Supabase's public REST API (using only the public anon key + their own JWT) and gain full admin panel access. **Fixed** via `Backend/migrations/002_fix_role_escalation.sql`: revoked `UPDATE` on `profiles` from the `authenticated` Postgres role entirely, re-granted it only on `display_name` — a Postgres column-level grant, enforced beneath RLS, verified against `information_schema.column_privileges` after applying.
- **Medium — user enumeration via passkey login**: `/api/auth/passkey/login/begin` returned a distinguishing 401 for emails with no registered passkey, letting an attacker script account-existence checks against a list of emails. **Fixed**: restored the same-shape-response trick the pre-Supabase custom auth code originally had (a deterministic fake credential ID when no real one exists), so the endpoint always returns 200 with WebAuthn options regardless of whether the account exists.
- Clarified for the record: Supabase does **not** manage RLS policy content automatically — `ENABLE ROW LEVEL SECURITY` only turns the gate on, and whatever policies exist are exactly what's enforced (including the gap above). RLS also only applies to connections using the `anon`/`authenticated` Postgres roles (i.e. calls through PostgREST/supabase-js) — the FastAPI backend connects via `DATABASE_URL` as the `postgres` superuser/table-owner role, which bypasses RLS entirely regardless of policy content unless `FORCE ROW LEVEL SECURITY` is explicitly set (it isn't). Backend endpoints are protected by their own app-level `require_user`/`require_admin` checks, not by RLS.

#### Operational note: repeated credential exposure in chat
Across this session the user pasted several live secrets directly into chat (Supabase service_role key, DB password, legacy JWT secret) despite repeated warnings to put them in `.env`/the dashboard instead. Each was flagged in the moment and the service_role key + DB password were rotated. Recorded as a standing behavioral note for future sessions — not a code fix, a process one.

---

### v2.0.0 — "Semester 5+6 Integration" (Archived — see `v2.0-legacy` git tag)
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
| **MEMORY.md** | This file — version history, changelog, documentation index (renamed from HISTORY.md) | **New** |
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
4. Update `DOCUMENTATION.md` and `MEMORY.md` for significant changes