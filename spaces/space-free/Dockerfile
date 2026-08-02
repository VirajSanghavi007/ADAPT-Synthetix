FROM python:3.10-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    espeak-ng \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# PyPI's default `torch` wheel bundles full CUDA (~2GB of nvidia-cublas/cudnn/nccl
# packages) even though we only ever run on CPU here — pulling from PyTorch's own
# CPU-only wheel index first cuts this down to ~200MB and avoids re-resolving a CUDA
# build later (torch is deliberately not pinned in requirements.txt, so later installs
# see it already satisfied and leave it alone).
RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch==2.5.1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# Kokoro's G2P backend (misaki) needs spaCy's English model — not pulled in by pip.
RUN python -m spacy download en_core_web_sm

COPY app.py .

RUN useradd -m spaceuser
USER spaceuser

ENV PYTHONUNBUFFERED=1
EXPOSE 7860

HEALTHCHECK --interval=10s --timeout=5s --start-period=60s --retries=5 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:7860/health', timeout=3)" || exit 1

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]
