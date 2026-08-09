FROM python:3.10-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# See space-free/Dockerfile for why: CPU-only torch wheel instead of PyPI's default
# CUDA-bundled one, installed first so later steps see it already satisfied.
RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch==2.5.1 torchaudio==2.5.1

COPY requirements.txt .
RUN pip install --no-cache-dir --retries 10 --timeout 120 -r requirements.txt

COPY app.py .

# See space-free/Dockerfile for why the HF cache dir is pre-created with spaceuser
# ownership before the named volume mounts over it.
RUN useradd -m spaceuser \
    && mkdir -p /home/spaceuser/.cache/huggingface \
    && chown -R spaceuser:spaceuser /home/spaceuser
USER spaceuser

# See space-free/Dockerfile for why.
ENV HF_HUB_DISABLE_XET=1
ENV PYTHONUNBUFFERED=1
EXPOSE 7860

HEALTHCHECK --interval=10s --timeout=5s --start-period=60s --retries=5 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:7860/health', timeout=3)" || exit 1

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]
