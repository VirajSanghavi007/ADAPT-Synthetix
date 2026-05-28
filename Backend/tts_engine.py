from scipy.io.wavfile import write as write_wav
from transformers import pipeline

TTS_AVAILABLE = False
_tts_pipeline = None
_load_attempted = False


def load_tts():
    global TTS_AVAILABLE, _tts_pipeline, _load_attempted
    if _tts_pipeline is not None:
        return _tts_pipeline
    if _load_attempted:
        return None
    _load_attempted = True
    print("Loading TTS model...")
    try:
        _tts_pipeline = pipeline("text-to-speech", model="suno/bark-small")
        TTS_AVAILABLE = True
        print("TTS model ready.")
    except Exception as e:
        print(f"Failed to load TTS model: {e}")
        TTS_AVAILABLE = False
    return _tts_pipeline


def synthesize(text, output_path):
    load_tts()
    if not TTS_AVAILABLE or _tts_pipeline is None:
        raise RuntimeError("TTS model not loaded")

    result = _tts_pipeline(text)
    audio = result["audio"]
    sampling_rate = result["sampling_rate"]

    # Handle tensor outputs without forcing torch import at module level.
    if hasattr(audio, "detach"):
        audio = audio.detach().cpu().numpy()

    write_wav(output_path, sampling_rate, audio)
    duration_seconds = len(audio) / float(sampling_rate)
    return output_path, duration_seconds
