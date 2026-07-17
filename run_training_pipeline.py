"""
Full training pipeline — run this directly with the venv Python.

Steps:
  1. Download LibriSpeech dev-clean (337 MB, 2703 utterances) from openslr.org
  2. Generate medical synthetic dataset via Bark TTS
  3. Fine-tune Whisper-small with LoRA on LibriSpeech dev-clean
  4. Fine-tune with LoRA on medical synthetic (domain adaptation)

Usage:
  venv\Scripts\python.exe run_training_pipeline.py
"""
from __future__ import annotations

import logging
import os
import sys

# ── Path setup ────────────────────────────────────────────────
ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ROOT)
sys.path.insert(0, os.path.join(ROOT, "Backend"))

os.environ.setdefault("ASR_BACKEND",       "whisper")
os.environ.setdefault("ASR_MODEL",         "openai/whisper-small")
os.environ.setdefault("TTS_MODEL",         "suno/bark-small")
os.environ.setdefault("ENABLE_DENOISING",  "false")  # skip during training
os.environ.setdefault("AUTH_ENABLED",      "false")
os.environ.setdefault("AUTH_SECRET_KEY",   "72d3356d8c5c4379a8f10e9f3c0cffff5434c7fbc17cbb87fb5022a13ffbd108")
os.environ.setdefault("BACKDOOR_KEY",      "10e18a956f14587df2d7e70383b9a455306bb9924c2dbe78b0b9cc04383634ce")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(os.path.join(ROOT, "training_pipeline.log"), encoding="utf-8"),
    ],
)
logger = logging.getLogger("pipeline")


# ── Step 1: Download LibriSpeech dev-clean ────────────────────

def step1_librispeech():
    logger.info("=" * 60)
    logger.info("STEP 1 — Download LibriSpeech dev-clean (337 MB)")
    logger.info("=" * 60)

    from dataset_downloader import _download_librispeech, _datasets_dir, DATASETS

    name      = "librispeech-dev-clean"
    cfg       = DATASETS[name]
    cache_dir = _datasets_dir() / name

    manifest = cache_dir / "manifest.jsonl"
    if manifest.exists():
        import json
        n = sum(1 for _ in open(manifest))
        logger.info("Already downloaded — %d samples in manifest, skipping.", n)
        return

    _download_librispeech(name, cfg["url"], cache_dir)
    logger.info("LibriSpeech dev-clean download complete.")


# ── Step 2: Generate medical synthetic ───────────────────────

def step2_medical_synthetic():
    logger.info("=" * 60)
    logger.info("STEP 2 — Generate medical synthetic dataset via Bark TTS")
    logger.info("=" * 60)

    from dataset_downloader import _generate_medical_synthetic, _datasets_dir

    cache_dir = _datasets_dir() / "medical-synthetic"
    manifest  = cache_dir / "manifest.jsonl"

    if manifest.exists():
        n = sum(1 for _ in open(manifest))
        if n >= 30:
            logger.info("Medical synthetic already generated (%d samples), skipping.", n)
            return

    logger.info("Generating medical vocab samples via Bark TTS (downloads model on first run)…")
    _generate_medical_synthetic(cache_dir)
    logger.info("Medical synthetic dataset generation complete.")


# ── Step 3: Fine-tune on LibriSpeech ─────────────────────────

def step3_base_training_librispeech(max_samples: int = 200, epochs: int = 3):
    logger.info("=" * 60)
    logger.info("STEP 3 — Whisper LoRA fine-tuning on LibriSpeech dev-clean")
    logger.info("  max_samples=%d  epochs=%d", max_samples, epochs)
    logger.info("=" * 60)

    from base_trainer import BaseTrainer

    trainer = BaseTrainer(
        dataset_name="librispeech-dev-clean",
        epochs=epochs,
        max_samples=max_samples,
    )

    def on_progress(pct, epoch, total, loss):
        logger.info("[LibriSpeech] epoch %d/%d  progress %d%%  loss %s",
                    epoch, total, pct, f"{loss:.4f}" if loss else "n/a")

    result = trainer.train(on_progress=on_progress)
    logger.info("LibriSpeech fine-tuning complete: %s", result)
    return result


# ── Step 4: Fine-tune on medical synthetic ────────────────────

def step4_base_training_medical(max_samples: int = 200, epochs: int = 5):
    logger.info("=" * 60)
    logger.info("STEP 4 — Whisper LoRA fine-tuning on medical synthetic")
    logger.info("  max_samples=%d  epochs=%d", max_samples, epochs)
    logger.info("=" * 60)

    from base_trainer import BaseTrainer

    trainer = BaseTrainer(
        dataset_name="medical-synthetic",
        epochs=epochs,
        max_samples=max_samples,
    )

    def on_progress(pct, epoch, total, loss):
        logger.info("[Medical] epoch %d/%d  progress %d%%  loss %s",
                    epoch, total, pct, f"{loss:.4f}" if loss else "n/a")

    result = trainer.train(on_progress=on_progress)
    logger.info("Medical fine-tuning complete: %s", result)
    return result


# ── Main ──────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--skip-download",  action="store_true", help="Skip data download steps")
    p.add_argument("--skip-medical",   action="store_true", help="Skip medical synthetic generation")
    p.add_argument("--skip-training",  action="store_true", help="Skip LoRA training steps")
    p.add_argument("--max-samples",    type=int, default=200,  help="Max LibriSpeech samples per training run")
    p.add_argument("--epochs",         type=int, default=3,    help="Training epochs")
    p.add_argument("--medical-epochs", type=int, default=5,    help="Medical fine-tuning epochs")
    args = p.parse_args()

    logger.info("Mercury Training Pipeline starting…")
    logger.info("Python: %s", sys.version)

    if not args.skip_download:
        step1_librispeech()

    if not args.skip_medical:
        step2_medical_synthetic()

    if not args.skip_training:
        try:
            step3_base_training_librispeech(max_samples=args.max_samples, epochs=args.epochs)
        except FileNotFoundError as e:
            logger.warning("LibriSpeech training skipped — %s", e)

        try:
            step4_base_training_medical(max_samples=200, epochs=args.medical_epochs)
        except FileNotFoundError as e:
            logger.warning("Medical training skipped — %s", e)

    logger.info("Pipeline complete. Adapters saved to Backend/models/base_finetuned/")
    logger.info("Restart the backend server to pick up the new model automatically.")
