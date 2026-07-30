---
title: Mercury Model Space — Pro Tier
emoji: 🔊
colorFrom: cyan
colorTo: green
sdk: docker
app_port: 7860
pinned: false
---

Internal model-serving Space for Mercury's Pro-tier models (Whisper-Large-v3-Turbo,
Bark). Not meant for direct public use — called by the main backend over HTTP with a
shared-secret header (`SPACE_SECRET`).
