import os
import torch
import librosa
from transformers import Wav2Vec2Processor, Wav2Vec2ForCTC

print("Loading ASR model (facebook/wav2vec2-base-960h)...")
PROCESSOR = Wav2Vec2Processor.from_pretrained("facebook/wav2vec2-base-960h")
MODEL = Wav2Vec2ForCTC.from_pretrained("facebook/wav2vec2-base-960h")
MODEL.eval()
print("ASR Model loaded successfully.")

def transcribe_audio(filepath):
    """
    Transcribe audio file to text using Wav2Vec2.
    """
    # 1. Resample to 16kHz mono using librosa
    audio_input, sr = librosa.load(filepath, sr=16000)
    
    # 2. Run through Wav2Vec2
    inputs = PROCESSOR(audio_input, sampling_rate=16000, return_tensors="pt", padding=True)
    
    with torch.no_grad():
        logits = MODEL(**inputs).logits
    
    predicted_ids = torch.argmax(logits, dim=-1)
    transcription = PROCESSOR.batch_decode(predicted_ids)[0]
    
    return transcription, librosa.get_duration(y=audio_input, sr=sr)


def transcribe_audio_with_logits(filepath):
    """
    Transcribe audio and return transcription, duration, logits and audio array.
    """
    audio_input, sr = librosa.load(filepath, sr=16000)
    inputs = PROCESSOR(audio_input, sampling_rate=16000, return_tensors="pt", padding=True)

    with torch.no_grad():
        logits = MODEL(**inputs).logits

    predicted_ids = torch.argmax(logits, dim=-1)
    transcription = PROCESSOR.batch_decode(predicted_ids)[0]
    duration = librosa.get_duration(y=audio_input, sr=sr)
    return transcription, duration, logits, audio_input
