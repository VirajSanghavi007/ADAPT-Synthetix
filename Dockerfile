FROM node:20-slim AS frontend-build

WORKDIR /frontend
COPY frontend-next/package*.json ./
RUN npm ci
COPY frontend-next .
RUN npm run build

FROM python:3.10-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    espeak-ng \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY Backend ./Backend
COPY --from=frontend-build /frontend/out ./frontend-next/out

# Bakes all 6 catalog models' weights into the image at build time, so containers
# start with no runtime download / cold-start. Adds significant build time + image
# size (GB-scale) — set PREFETCH_MODELS=false to skip for faster iterative builds.
ARG PREFETCH_MODELS=true
RUN --mount=type=secret,id=hf_token \
    if [ "$PREFETCH_MODELS" = "true" ]; then \
      HF_TOKEN=$(cat /run/secrets/hf_token 2>/dev/null || echo "") \
      HF_HOME=/app/.cache/huggingface \
      python -m Backend.scripts.prefetch_models; \
    fi

RUN mkdir -p Backend/data && useradd -m mercury && chown -R mercury:mercury /app
USER mercury

ENV PYTHONUNBUFFERED=1
EXPOSE 7860

CMD ["uvicorn", "Backend.main:app", "--host", "0.0.0.0", "--port", "7860"]
