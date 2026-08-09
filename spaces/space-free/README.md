---
title: ADAPT-Synthetix Model Space — Free Tier
emoji: 🔊
colorFrom: cyan
colorTo: green
sdk: docker
app_port: 7860
pinned: false
---

Internal model-serving Space for ADAPT-Synthetix's Free-tier models (Distil-Whisper-Large-v3,
Kokoro-82M). Not meant for direct public use — called by the main backend over HTTP
with a shared-secret header (`SPACE_SECRET`). See the main repo's `MEMORY.md` for the
multi-Space architecture this belongs to.
