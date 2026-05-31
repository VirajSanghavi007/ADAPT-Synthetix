"""
One-time setup script — downloads ASR and TTS models to Backend/models/.
Run this once before starting the server:
    python Backend/download_models.py

After this, the server loads models from disk instead of fetching from
HuggingFace on every start.
"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BACKEND = ROOT / "Backend"
MODELS_DIR = BACKEND / "models"

ASR_LOCAL = MODELS_DIR / "wav2vec2"
TTS_LOCAL = MODELS_DIR / "bark-small"


def download_asr() -> None:
    if (ASR_LOCAL / "config.json").exists():
        print(f"[SKIP] Wav2Vec2 already at {ASR_LOCAL}")
        return
    print("[DOWNLOAD] Wav2Vec2 ASR (facebook/wav2vec2-base-960h)...")
    from transformers import Wav2Vec2Processor, Wav2Vec2ForCTC
    ASR_LOCAL.mkdir(parents=True, exist_ok=True)
    Wav2Vec2Processor.from_pretrained("facebook/wav2vec2-base-960h").save_pretrained(str(ASR_LOCAL))
    Wav2Vec2ForCTC.from_pretrained("facebook/wav2vec2-base-960h").save_pretrained(str(ASR_LOCAL))
    print(f"[OK] Wav2Vec2 saved to {ASR_LOCAL}")


def download_tts() -> None:
    if (TTS_LOCAL / "config.json").exists():
        print(f"[SKIP] Bark-small already at {TTS_LOCAL}")
        return
    print("[DOWNLOAD] Bark TTS (suno/bark-small)...")
    from transformers import pipeline
    TTS_LOCAL.mkdir(parents=True, exist_ok=True)
    pipe = pipeline("text-to-speech", model="suno/bark-small")
    pipe.model.save_pretrained(str(TTS_LOCAL))
    pipe.tokenizer.save_pretrained(str(TTS_LOCAL))
    print(f"[OK] Bark-small saved to {TTS_LOCAL}")


if __name__ == "__main__":
    download_asr()
    download_tts()
    print("\nAll models ready. Start the server with:")
    print("  uvicorn Backend.app:app --host 0.0.0.0 --port 5000")
