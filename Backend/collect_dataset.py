"""
collect_dataset.py — Register a single audio sample into the dataset.

Usage:
    python collect_dataset.py \
        --audio /path/to/file.wav \
        --transcript "hello world" \
        --category clean \
        --noise_type clean
"""

import argparse
import sys
from pathlib import Path

from dataset_manager import DatasetManager
from config import ROOT_DIR

VALID_CATEGORIES = {"noisy", "accented", "medical", "clean"}
VALID_NOISE_TYPES = {"clean", "traffic", "crowd", "machinery", "indoor"}


def main():
    parser = argparse.ArgumentParser(description="Register an audio sample into the ADAPT-Synthetix dataset.")
    parser.add_argument("--audio", required=True, help="Path to the audio file")
    parser.add_argument("--transcript", required=True, help="Ground-truth transcript text")
    parser.add_argument("--category", required=True, choices=sorted(VALID_CATEGORIES))
    parser.add_argument("--noise_type", required=True, choices=sorted(VALID_NOISE_TYPES))
    args = parser.parse_args()

    audio_path = Path(args.audio)
    if not audio_path.exists():
        print(f"ERROR: audio file not found: {audio_path}", file=sys.stderr)
        sys.exit(1)

    dm = DatasetManager(dataset_dir=str(ROOT_DIR / "Dataset"))
    sample_id = dm.register_sample(
        audio_path=str(audio_path),
        transcription=args.transcript,
        category=args.category,
        noise_type=args.noise_type,
    )
    print(f"Registered {sample_id} — category={args.category} noise={args.noise_type} transcript={args.transcript}")


if __name__ == "__main__":
    main()
