FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    ffmpeg \
    git \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p Backend/data/audio Backend/logs Backend/temp Backend/models/lora Dataset

EXPOSE 5000

ENV PYTHONUNBUFFERED=1
ENV TRANSFORMERS_CACHE=/app/.cache/huggingface

CMD ["uvicorn", "Backend.app:app", "--host", "0.0.0.0", "--port", "5000"]
