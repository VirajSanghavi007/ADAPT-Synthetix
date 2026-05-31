"""
run_evaluation.py — Compare Wav2Vec2 CER before and after LoRA adaptation.

Usage:
    # Use last 10 entries from the dataset manifest (default):
    python run_evaluation.py

    # Use a custom holdout CSV (columns: audio_path, transcript):
    python run_evaluation.py --holdout /path/to/holdout.csv

The script:
  1. Loads holdout samples from the manifest or a CSV.
  2. Produces baseline hypotheses using the unmodified Wav2Vec2 model.
  3. Calls LoRATrainer.evaluate() which runs the LoRA-adapted model and
     reports per-sample and average CER before/after.
"""

import argparse
import csv
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from config import DB_PATH, ROOT_DIR
from dataset_manager import DatasetManager
from asr_module import transcribe_audio
from lora_trainer import LoRATrainer


def load_from_manifest(n: int = 10) -> list[dict]:
    dm = DatasetManager(dataset_dir=str(ROOT_DIR / "Dataset"))
    samples = dm.get_samples()
    labelled = [s for s in samples if str(s.get("transcription", "")).strip()]
    return labelled[-n:]


def load_from_csv(csv_path: str) -> list[dict]:
    rows = []
    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        required = {"audio_path", "transcript"}
        missing = required - set(reader.fieldnames or [])
        if missing:
            print(f"ERROR: holdout CSV missing columns: {', '.join(sorted(missing))}", file=sys.stderr)
            sys.exit(1)
        for row in reader:
            rows.append({"audio_path": row["audio_path"].strip(), "transcription": row["transcript"].strip()})
    return rows


def main():
    parser = argparse.ArgumentParser(description="Evaluate LoRA adaptation CER improvement.")
    parser.add_argument("--holdout", default=None, help="Path to holdout CSV (audio_path, transcript)")
    parser.add_argument("--n", type=int, default=10, help="Number of manifest samples to use (default: 10)")
    args = parser.parse_args()

    if args.holdout:
        raw_samples = load_from_csv(args.holdout)
    else:
        raw_samples = load_from_manifest(args.n)

    if not raw_samples:
        print("No holdout samples found. Register samples via collect_dataset.py or provide --holdout CSV.")
        sys.exit(0)

    print(f"Loaded {len(raw_samples)} holdout sample(s). Generating baselines...")
    test_samples = []
    for s in raw_samples:
        audio_path = str(s.get("audio_path", ""))
        reference = str(s.get("transcription", "")).strip()
        if not audio_path or not reference or not Path(audio_path).exists():
            print(f"  SKIP: {audio_path or '(no path)'}")
            continue
        hypothesis, _ = transcribe_audio(audio_path)
        test_samples.append({
            "audio_path": audio_path,
            "reference": reference,
            "baseline_hypothesis": hypothesis,
        })
        print(f"  Baseline [{Path(audio_path).name}]: {hypothesis[:60]}")

    if not test_samples:
        print("No valid holdout samples after filtering. Exiting.")
        sys.exit(0)

    print(f"\nRunning LoRA evaluation on {len(test_samples)} sample(s)...")
    trainer = LoRATrainer(db_path=str(DB_PATH))
    trainer.evaluate(test_samples)


if __name__ == "__main__":
    main()
