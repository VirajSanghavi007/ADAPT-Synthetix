FROM node:20-slim AS frontend-build

WORKDIR /frontend
COPY frontend-next/package*.json ./
RUN npm ci
COPY frontend-next .
RUN npm run build

FROM python:3.10-slim

WORKDIR /app

# ffmpeg is only needed for pydub's decode fallback (mp3/mp4/aac) when computing audio
# duration before forwarding to a model Space — no ML model runs in this image anymore.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY Backend ./Backend
COPY --from=frontend-build /frontend/out ./frontend-next/out

RUN mkdir -p Backend/data && useradd -m mercury && chown -R mercury:mercury /app
USER mercury

ENV PYTHONUNBUFFERED=1
EXPOSE 7860

CMD ["uvicorn", "Backend.main:app", "--host", "0.0.0.0", "--port", "7860"]
