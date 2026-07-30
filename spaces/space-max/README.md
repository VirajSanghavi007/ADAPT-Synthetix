---
title: Mercury Model Space — Max Tier
emoji: 🔊
colorFrom: cyan
colorTo: green
sdk: docker
app_port: 7860
pinned: false
---

Internal model-serving Space for Mercury's Max/Enterprise-tier models
(Parakeet-TDT-0.6B-v2, CosyVoice2-0.5B). Not meant for direct public use — called by
the main backend over HTTP with a shared-secret header (`SPACE_SECRET`).
