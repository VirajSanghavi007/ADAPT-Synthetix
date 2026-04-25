import numpy as np
import torch
import librosa
from jiwer import cer
from g2p_en import G2p

_G2P = G2p()


def calculate_cer(reference, hypothesis):
    if not reference:
        return None
    return round(float(cer(reference, hypothesis)), 4)


def extract_phonemes(text):
    phonemes = _G2P(text or "")
    return [str(token) for token in phonemes if str(token).strip()]


def classify_noise_profile(audio_array, sr=16000):
    spectral_centroid = float(np.mean(librosa.feature.spectral_centroid(y=audio_array, sr=sr)))
    zero_crossing_rate = float(np.mean(librosa.feature.zero_crossing_rate(y=audio_array)))
    rms_energy = float(np.mean(librosa.feature.rms(y=audio_array)))
    mfcc = librosa.feature.mfcc(y=audio_array, sr=sr)
    mfcc_variance = float(np.mean(np.var(mfcc, axis=1)))

    if rms_energy < 0.01:
        noise_type = "clean"
    elif spectral_centroid > 3000 and zero_crossing_rate > 0.1:
        noise_type = "traffic"
    elif rms_energy > 0.05 and mfcc_variance > 50:
        noise_type = "crowd"
    else:
        noise_type = "indoor"

    return {
        "noise_type": noise_type,
        "spectral_centroid": spectral_centroid,
        "zero_crossing_rate": zero_crossing_rate,
        "rms_energy": rms_energy,
        "mfcc_variance": mfcc_variance,
    }


def extract_confidence(logits_tensor):
    probabilities = torch.softmax(logits_tensor, dim=-1)
    max_probabilities = probabilities.max(dim=-1).values
    confidence = max_probabilities.mean().item()
    return round(float(confidence), 4)


def classify_error_type(cer_score, noise_profile, confidence_score):
    score = cer_score if cer_score is not None else 0.0
    if noise_profile.get("noise_type") != "clean" and score > 0.2:
        return "noise"
    if confidence_score < 0.4 and score > 0.15:
        return "accent"
    if score > 0.1:
        return "pronunciation"
    return "clean"
