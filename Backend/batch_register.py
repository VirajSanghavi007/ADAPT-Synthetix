"""
batch_register.py — Register multiple audio samples from a CSV file.

CSV columns (required): audio_path, transcript, category, noise_type

Usage:
    python batch_register.py --csv /path/to/samples.csv

Example CSV:
    audio_path,transcript,category,noise_type
    /path/to/file.wav,hello world,clean,clean
"""

import argparse
import csv
import sys
from pathlib import Path

from dataset_manager import DatasetManager
from config import ROOT_DIR

VALID_CATEGORIES = {"noisy", "accented", "medical", "clean"}
VALID_NOISE_TYPES = {"clean", "traffic", "crowd", "machinery", "indoor"}
REQUIRED_COLUMNS = {"audio_path", "transcript", "category", "noise_type"}


def main():
    parser = argparse.ArgumentParser(description="Batch-register audio samples from a CSV file.")
    parser.add_argument("--csv", required=True, help="Path to the CSV file")
    args = parser.parse_args()

    csv_path = Path(args.csv)
    if not csv_path.exists():
        print(f"ERROR: CSV file not found: {csv_path}", file=sys.stderr)
        sys.exit(1)

    dm = DatasetManager(dataset_dir=str(ROOT_DIR / "Dataset"))

    registered = 0
    skipped = 0

    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        missing = REQUIRED_COLUMNS - set(reader.fieldnames or [])
        if missing:
            print(f"ERROR: CSV is missing required columns: {', '.join(sorted(missing))}", file=sys.stderr)
            sys.exit(1)

        for line_num, row in enumerate(reader, start=2):
            audio_path = row["audio_path"].strip()
            transcript = row["transcript"].strip()
            category = row["category"].strip().lower()
            noise_type = row["noise_type"].strip().lower()

            if category not in VALID_CATEGORIES:
                print(f"  SKIP row {line_num}: invalid category '{category}'")
                skipped += 1
                continue
            if noise_type not in VALID_NOISE_TYPES:
                print(f"  SKIP row {line_num}: invalid noise_type '{noise_type}'")
                skipped += 1
                continue
            if not Path(audio_path).exists():
                print(f"  SKIP row {line_num}: audio file not found: {audio_path}")
                skipped += 1
                continue

            try:
                sample_id = dm.register_sample(
                    audio_path=audio_path,
                    transcription=transcript,
                    category=category,
                    noise_type=noise_type,
                )
                print(f"  Registered {sample_id} — category={category} noise={noise_type} transcript={transcript[:60]}")
                registered += 1
            except Exception as exc:
                print(f"  SKIP row {line_num}: {exc}")
                skipped += 1

    print(f"\nDone. {registered} registered, {skipped} skipped.")


if __name__ == "__main__":
    main()
