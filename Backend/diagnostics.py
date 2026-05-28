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


def align_phoneme_errors(reference_text, hypothesis_text):
    """
    Align reference and hypothesis phonemes and return edit operations.

    This is the first point where the project can honestly talk about
    phoneme-level errors: it requires a reference transcript.
    """
    reference = extract_phonemes(reference_text)
    hypothesis = extract_phonemes(hypothesis_text)
    rows = len(reference) + 1
    cols = len(hypothesis) + 1
    dp = [[0] * cols for _ in range(rows)]

    for i in range(rows):
        dp[i][0] = i
    for j in range(cols):
        dp[0][j] = j

    for i in range(1, rows):
        for j in range(1, cols):
            substitution_cost = 0 if reference[i - 1] == hypothesis[j - 1] else 1
            dp[i][j] = min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + substitution_cost,
            )

    errors = []
    i = len(reference)
    j = len(hypothesis)
    while i > 0 or j > 0:
        if i > 0 and j > 0 and reference[i - 1] == hypothesis[j - 1]:
            i -= 1
            j -= 1
        elif (
            i > 0
            and j > 0
            and dp[i][j] == dp[i - 1][j - 1] + 1
        ):
            errors.append({
                "operation": "substitution",
                "reference": reference[i - 1],
                "hypothesis": hypothesis[j - 1],
            })
            i -= 1
            j -= 1
        elif i > 0 and dp[i][j] == dp[i - 1][j] + 1:
            errors.append({
                "operation": "deletion",
                "reference": reference[i - 1],
                "hypothesis": "",
            })
            i -= 1
        else:
            errors.append({
                "operation": "insertion",
                "reference": "",
                "hypothesis": hypothesis[j - 1],
            })
            j -= 1

    errors.reverse()
    return {
        "reference_phonemes": reference,
        "hypothesis_phonemes": hypothesis,
        "distance": dp[-1][-1],
        "errors": errors,
    }


def classify_noise_profile(audio_array, sr=16000):
    return fingerprinter.fingerprint(audio_array, sr=sr)


def extract_confidence(logits_tensor):
    probabilities = torch.softmax(logits_tensor, dim=-1)
    max_probabilities = probabilities.max(dim=-1).values
    confidence = max_probabilities.mean().item()
    return round(float(confidence), 4)


def classify_error_type(cer_score, noise_profile, confidence_score):
    if cer_score is None:
        if noise_profile.get("noise_type") != "clean":
            return "noise"
        if confidence_score < 0.4:
            return "accent"
        return "clean"

    score = cer_score
    if noise_profile.get("noise_type") != "clean" and score > 0.2:
        return "noise"
    if confidence_score < 0.4 and score > 0.15:
        return "accent"
    if score > 0.1:
        return "pronunciation"
    return "clean"
