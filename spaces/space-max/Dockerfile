FROM python:3.10-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    git \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# See space-free/Dockerfile for why: CPU-only torch wheel instead of PyPI's default
# CUDA-bundled one — installed first so both the NeMo install below and CosyVoice's
# own install further down see it already satisfied instead of each re-resolving
# their own (huge, CUDA-bundled) torch.
RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch==2.5.1 torchaudio==2.5.1

COPY requirements.txt .
RUN pip install --no-cache-dir --retries 10 --timeout 120 -r requirements.txt

# CosyVoice2 isn't pip-installable (no setup.py/pyproject.toml at repo root) — clone
# it and its Matcha-TTS submodule, install its own requirements, use via sys.path
# (see app.py). --recursive pulls third_party/Matcha-TTS, which CosyVoice2 imports from.
#
# Some of CosyVoice's own deps use a legacy setup.py that imports pkg_resources at
# build time. setuptools >=81 dropped pkg_resources entirely, and pip's build
# isolation resolves a *fresh* setuptools per-package regardless of what's installed
# globally — so pinning setuptools<81 alone isn't enough. --no-build-isolation makes
# these packages build against the outer (pinned, pkg_resources-having) environment
# instead of an isolated one that would just re-fetch latest setuptools anyway.
RUN pip install --no-cache-dir "setuptools<81" wheel \
    && git clone --recursive https://github.com/FunAudioLLM/CosyVoice.git /app/CosyVoice \
    && grep -vE "^--extra-index-url|tensorrt|deepspeed|onnxruntime-gpu|^torch==|^torchaudio==" \
        /app/CosyVoice/requirements.txt > /app/CosyVoice/requirements.cpu.txt \
    && echo "onnxruntime==1.18.0" >> /app/CosyVoice/requirements.cpu.txt \
    && pip install --no-cache-dir --no-build-isolation --retries 10 --timeout 120 -r /app/CosyVoice/requirements.cpu.txt

# CosyVoice's own requirements (installed above) get resolved as a separate pip
# invocation from the base torch/pytorch-lightning/datasets installs earlier in
# this file — pip doesn't remember those pins across invocations, so this step has
# silently upgraded pytorch-lightning past nemo's compatible range (dropping
# NeptuneLogger, which nemo imports unconditionally), dropped torchaudio entirely
# (needed by CosyVoice's own frontend.py for resampling), and upgraded datasets
# past nemo's compatible range too (calls a pyarrow API too new for the installed
# pyarrow). Re-pin all three as the final step so nothing installed afterward can
# disturb them again. --no-deps because we already know these exact versions are
# correct together; re-resolving would just repeat the problem this is fixing.
RUN pip install --no-cache-dir --no-deps \
    --index-url https://download.pytorch.org/whl/cpu torch==2.5.1 torchaudio==2.5.1 \
    && pip install --no-cache-dir --no-deps pytorch-lightning==2.2.5 "datasets<3"

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

HEALTHCHECK --interval=15s --timeout=5s --start-period=120s --retries=8 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:7860/health', timeout=3)" || exit 1

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]
