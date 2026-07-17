# ── Stage 1: build dependencies ───────────────────────────────────────────────
FROM python:3.11-slim AS builder

WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /install /usr/local

COPY . .

RUN mkdir -p Backend/data/audio Backend/logs Backend/temp Backend/models/lora Dataset .cache/huggingface

# Pre-download NLTK data so g2p_en works at container startup without network access
RUN python -c "import nltk; nltk.download('averaged_perceptron_tagger_eng', quiet=True); nltk.download('cmudict', quiet=True)" 2>/dev/null || true

ENV PYTHONUNBUFFERED=1
ENV TRANSFORMERS_CACHE=/app/.cache/huggingface
ENV HF_HOME=/app/.cache/huggingface
ENV PYTHONPATH=/app:/app/Backend
ENV PORT=7860

EXPOSE 7860

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:7860/health')" || exit 1

# -w 1: single worker — model loaded once (--preload forks after model load)
# Async concurrency handles multiple simultaneous requests within one worker.
CMD ["gunicorn", "-w", "1", "--preload", "-k", "uvicorn.workers.UvicornWorker", "Backend.app:app", "--bind", "0.0.0.0:7860", "--timeout", "120"]
