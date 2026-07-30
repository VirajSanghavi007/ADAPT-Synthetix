"""Pre-downloads all 6 catalog models at Docker build time, so containers start with
weights already cached (no runtime download / cold-start on first request).

Run manually: python -m Backend.scripts.prefetch_models
"""
import sys

from Backend.asr_pipeline import get_asr_model, get_tts_pipeline
from Backend.tiers import ASR_CATALOG, TTS_CATALOG


def main():
    for model_id in ASR_CATALOG:
        print(f"Prefetching ASR model: {model_id}")
        try:
            get_asr_model(model_id)
        except Exception as e:
            print(f"  FAILED: {e}", file=sys.stderr)

    for model_id in TTS_CATALOG:
        print(f"Prefetching TTS model: {model_id}")
        try:
            get_tts_pipeline(model_id)
        except Exception as e:
            print(f"  FAILED: {e}", file=sys.stderr)


if __name__ == "__main__":
    main()
