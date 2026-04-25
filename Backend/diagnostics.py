import numpy as np
import torch
import librosa
from jiwer import cer
from g2p_en import G2p
from noise_fingerprint import NoiseFingerprinter

_G2P = G2p()
fingerprinter = NoiseFingerprinter()


def calculate_cer(reference, hypothesis):
    if not reference:
        return None
    return round(float(cer(reference, hypothesis)), 4)


def extract_phonemes(text):
    phonemes = _G2P(text or "")
    return [str(token) for token in phonemes if str(token).strip()]


def classify_noise_profile(audio_array, sr=16000):
    return fingerprinter.fingerprint(audio_array, sr=sr)


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
