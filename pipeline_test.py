import os
import sys
from datetime import datetime

import librosa
import torch
from transformers import Wav2Vec2ForCTC, Wav2Vec2Processor

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(ROOT_DIR, "Backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

import diagnostics  # noqa: E402
import tts_engine  # noqa: E402


def _fit(text, width):
    text = str(text)
    if len(text) > width:
        return text[: width - 3] + "..."
    return text.ljust(width)


def main():
    if len(sys.argv) < 2:
        print("Usage: python pipeline_test.py <audio_file_path>")
        sys.exit(1)

    audio_path = sys.argv[1]
    if not os.path.isfile(audio_path):
        print(f"Input file not found: {audio_path}")
        sys.exit(1)

    print("Step 1 — ASR")
    print("Loading wav2vec2-base-960h...")
    processor = Wav2Vec2Processor.from_pretrained("facebook/wav2vec2-base-960h")
    model = Wav2Vec2ForCTC.from_pretrained("facebook/wav2vec2-base-960h")
    model.eval()

    audio_input, sr = librosa.load(audio_path, sr=16000)
    inputs = processor(audio_input, sampling_rate=16000, return_tensors="pt", padding=True)
    with torch.no_grad():
        logits = model(**inputs).logits
    predicted_ids = torch.argmax(logits, dim=-1)
    transcription = processor.batch_decode(predicted_ids)[0]
    print(f"Transcription: {transcription}")

    print("\nStep 2 — Diagnostics")
    confidence_score = diagnostics.extract_confidence(logits)
    noise_profile = diagnostics.classify_noise_profile(audio_input, sr=16000)
    print(f"Confidence: {confidence_score}")
    print(f"Noise Profile: {noise_profile}")

    print("\nStep 3 — Error Classification")
    error_type = diagnostics.classify_error_type(None, noise_profile, confidence_score)
    print(f"Error Type: {error_type}")

    print("\nStep 4 — TTS Remediation")
    remedial_path = None
    if error_type != "clean":
        timestamp = datetime.now().strftime("%Y%m%dT%H%M%S")
        output_dir = os.path.join(ROOT_DIR, "Backend", "data", "audio")
        os.makedirs(output_dir, exist_ok=True)
        remedial_path = os.path.join(output_dir, f"remedial_{timestamp}.wav")
        if tts_engine.TTS_AVAILABLE:
            tts_engine.synthesize(transcription, remedial_path)
            print(f"Remedial audio saved to {remedial_path}")
        else:
            print("TTS model unavailable. Skipping remedial audio generation.")
            remedial_path = None
    else:
        print("No remediation needed (clean).")

    print("\nStep 5 — Summary")
    print("╔══════════════════════════════════════╗")
    print("║     ADAPT-Synthetix Pipeline Report  ║")
    print("╠══════════════════════════════════════╣")
    print(f"║ Input File    : {_fit(os.path.basename(audio_path), 22)}║")
    print(f"║ Transcription : {_fit(transcription, 22)}║")
    print(f"║ Confidence    : {_fit(confidence_score, 22)}║")
    print(f"║ Noise Type    : {_fit(noise_profile.get('noise_type', 'N/A'), 22)}║")
    print(f"║ Error Type    : {_fit(error_type, 22)}║")
    print(f"║ Remedial Audio: {_fit(remedial_path or 'None', 22)}║")
    print("╚══════════════════════════════════════╝")


if __name__ == "__main__":
    main()
