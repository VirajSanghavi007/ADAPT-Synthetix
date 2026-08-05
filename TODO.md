# Mercury — Roadmap / TODO

Not scheduled, not prioritized against each other — just the list of "later" items
as they've come up, so they don't get lost.

## Product surfaces

- **Software (Enterprise)** — dedicated enterprise deployment/offering, beyond the
  existing enterprise account tier (free Max-tier access + employee-ID auth). Likely
  means: self-hosted or dedicated-tenant deployment, admin console, SSO, audit export.
- **Mobile App ("Smaller Detachment")** — the existing Expo/React Native scaffold in
  `mobile/` is unbuilt/unverified (login only, record→transcribe, TTS, no enterprise
  mode). "Smaller detachment" — a deliberately reduced feature set vs the web app,
  not a full port.
- **Browser Extension** — convert live audio on the page (a video call, a lecture
  stream, anything playing in the tab) to text, and convert typed/selected text to
  audio, without leaving the page. Needs: tab-audio capture permission, a lightweight
  in-page UI, and reuse of the existing `/api/transcribe` / `/api/tts` endpoints
  (probably via an API key, not a full user session, given the extension context).
  Same tier-naming (Echo/Apollo/Thoth, Freyr/Horus/Odin) applies here too — the
  extension's model picker/UI copy should use those names, not raw model ids.
- **CLI ("Developer Mode")** — a command-line client against the existing REST API /
  MCP server, for scripting and CI use. `mercury transcribe file.wav`,
  `mercury tts "text" -o out.mp3`, config via `~/.mercury/config` or an API key env var.
- **"The brain"** — quantize/prune Kimi K2 (or whatever model ends up right-sized)
  down to something that fits on Oracle Cloud's free tier, and run it as a reasoning
  layer alongside ASR/TTS — the "Claude but for speech" framing. Big undertaking,
  blocked on actually having the Oracle Cloud instance (still pending signup as of
  this writing) and on picking a model that's actually small enough post-quantization
  to run acceptably on free-tier hardware — needs real benchmarking before committing,
  not just picking a parameter count that sounds right.
- **True streaming ASR** — Live Recording (shipped) currently approximates "live" by
  recording ~6-second segments and transcribing each as a discrete request, so text
  lands a few seconds behind and stutters at segment boundaries. Real low-latency
  streaming needs a persistent connection (WebSocket) to a model that supports
  incremental/streaming inference (not all of Echo/Apollo/Thoth's engines do —
  worth checking per-engine before assuming this is just a backend wiring change).

## Infrastructure (explicitly "not now, future")

- **Kubernetes** — once there's more than one physical host to schedule across;
  today everything is a single docker-compose stack on one machine.
- **Oracle Cloud (free tier)** — move off the local machine (which has proven
  unreliable this session — Docker Desktop crashed repeatedly) onto an always-on VM.
- **Cloudflare** — in front of the public deployment, primarily to cut down on bot
  traffic before it reaches the app; WAF/rate-limiting at the edge.
- **Chatbot** — not a popup widget; a persistent panel with a text input, scope TBD.
  Depends on the above infra being in place first.
- **Client-side obfuscation** — minify/obfuscate the shipped JS/CSS so the frontend
  isn't trivially copyable. Next.js's production build already minifies; this would
  go further (name-mangling, control-flow obfuscation) — evaluate whether the
  performance/debuggability cost is worth it before doing it.

## Known gaps / things to revisit

- Google Drive import needs a real Google OAuth client ID configured
  (`NEXT_PUBLIC_GOOGLE_CLIENT_ID` is empty) — nothing will work until that's set up
  in Google Cloud Console and wired into `.env`/`.env.local`.
- Login flow — currently defaults straight into "try a passkey" for every visitor,
  which is a bad first-run experience for anyone who's never made one. Wants: an
  explicit Google-vs-email choice up front, and for email, a password-vs-passkey
  choice where passkey walks a first-timer through creating one rather than assuming
  it already exists.
- No object storage bucket provisioned yet — profile pictures are stored as a
  `data:` URL directly on the row (see `docs/MEMORY.md`) as a stopgap; revisit once
  a real bucket exists.
- `space-max` (Thoth/Parakeet+CosyVoice2) has had five real dependency-drift bugs
  found and fixed this session but never got a clean, uninterrupted test window —
  worth a dedicated retest pass once the environment (Docker Desktop crashing
  repeatedly) is stable.
- Pro/Max tiers are deprioritized for now — focus is on Free tier working end-to-end
  before circling back to them.
