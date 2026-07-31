FROM python:3.10-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    git \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# CosyVoice2 isn't pip-installable (no setup.py/pyproject.toml at repo root) — clone
# it and its Matcha-TTS submodule, install its own requirements, use via sys.path
# (see app.py). --recursive pulls third_party/Matcha-TTS, which CosyVoice2 imports from.
RUN git clone --recursive https://github.com/FunAudioLLM/CosyVoice.git /app/CosyVoice \
    && pip install --no-cache-dir -r /app/CosyVoice/requirements.txt

COPY app.py .

RUN useradd -m spaceuser
USER spaceuser

ENV PYTHONUNBUFFERED=1
EXPOSE 7860

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]
