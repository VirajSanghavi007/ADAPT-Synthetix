import os
import torch
import librosa
from pathlib import Path
from transformers import Wav2Vec2Processor, Wav2Vec2ForCTC

_LOCAL_MODEL = Path(__file__).parent / "models" / "wav2vec2"
ASR_MODEL_PATH = str(_LOCAL_MODEL) if (_LOCAL_MODEL / "config.json").exists() else "facebook/wav2vec2-base-960h"
print(f"ASR model configured ({ASR_MODEL_PATH}).")

PROCESSOR = None
MODEL = None


def load_model():
    global PROCESSOR, MODEL
    if PROCESSOR is None or MODEL is None:
        print(f"Loading ASR model ({ASR_MODEL_PATH})...")
        PROCESSOR = Wav2Vec2Processor.from_pretrained(ASR_MODEL_PATH)
        MODEL = Wav2Vec2ForCTC.from_pretrained(ASR_MODEL_PATH)
        MODEL.eval()
        print("ASR Model loaded successfully.")
    return PROCESSOR, MODEL

def transcribe_audio(filepath):
    """
    Transcribe audio file to text using Wav2Vec2.
    """
    processor, model = load_model()
    # 1. Resample to 16kHz mono using librosa
    audio_input, sr = librosa.load(filepath, sr=16000)
    
    # 2. Run through Wav2Vec2
    inputs = processor(audio_input, sampling_rate=16000, return_tensors="pt", padding=True)
    
    with torch.no_grad():
        logits = model(**inputs).logits
    
    predicted_ids = torch.argmax(logits, dim=-1)
    transcription = processor.batch_decode(predicted_ids)[0]
    
    return transcription, librosa.get_duration(y=audio_input, sr=sr)


def transcribe_audio_with_logits(filepath):
    """
    Transcribe audio and return transcription, duration, logits and audio array.
    """
    processor, model = load_model()
    audio_input, sr = librosa.load(filepath, sr=16000)
    inputs = processor(audio_input, sampling_rate=16000, return_tensors="pt", padding=True)

    with torch.no_grad():
        logits = model(**inputs).logits

    predicted_ids = torch.argmax(logits, dim=-1)
    transcription = processor.batch_decode(predicted_ids)[0]
    duration = librosa.get_duration(y=audio_input, sr=sr)
    return transcription, duration, logits, audio_input
