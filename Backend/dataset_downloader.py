"""
dataset_downloader.py — Download public speech corpora for local Whisper fine-tuning.

Supported datasets:
  librispeech-dev-clean   337 MB   LibriSpeech dev-clean (5.4h read English)
  librispeech-clean-100   6.3 GB   LibriSpeech train-clean-100 (100h read English)
  medical-synthetic       local    Synthetic medical vocab generated via TTS Bark

All datasets are stored under DATASETS_DIR/<name>/ as:
  - raw audio files (FLAC or WAV)
  - manifest.jsonl  {"audio_path": "...", "transcription": "..."}
"""
from __future__ import annotations

import json
import logging
import os
import re
import tarfile
import threading
import time
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# Defer import to avoid circular at module level
def _datasets_dir() -> Path:
    from config import DATASETS_DIR
    return DATASETS_DIR


# ── In-memory status (one download at a time) ─────────────────────────────────
_lock    = threading.Lock()
_current = {
    "state":    "idle",   # idle | downloading | extracting | generating | done | error
    "dataset":  None,
    "progress": 0,        # 0-100
    "message":  "",
    "error":    None,
    "n_samples": 0,
}


def get_status() -> dict:
    with _lock:
        return dict(_current)


def _set(**kwargs):
    with _lock:
        _current.update(kwargs)
        try:
            (_datasets_dir() / "download_status.json").write_text(json.dumps(_current))
        except Exception:
            pass


# ── Dataset catalogue ─────────────────────────────────────────────────────────
DATASETS: dict[str, dict] = {
    "medical-synthetic": {
        "url":         None,
        "size_mb":     0,
        "description": "Synthetic medical vocabulary — generated locally via Bark TTS (~50 samples, no download needed)",
        "type":        "synthetic",
    },
    "librispeech-dev-clean": {
        "url":         "https://www.openslr.org/resources/12/dev-clean.tar.gz",
        "size_mb":     337,
        "description": "LibriSpeech dev-clean (337 MB · 5.4 h · high-quality read English)",
        "type":        "librispeech",
    },
    "librispeech-clean-100": {
        "url":         "https://www.openslr.org/resources/12/train-clean-100.tar.gz",
        "size_mb":     6387,
        "description": "LibriSpeech train-clean-100 (6.3 GB · 100 h · full training corpus)",
        "type":        "librispeech",
    },
}


def get_available_datasets() -> list[dict]:
    out = []
    for name, cfg in DATASETS.items():
        cache_dir    = _datasets_dir() / name
        manifest     = cache_dir / "manifest.jsonl"
        n_samples    = 0
        if manifest.exists():
            with open(manifest) as f:
                n_samples = sum(1 for _ in f)
        out.append({
            "name":        name,
            "description": cfg["description"],
            "size_mb":     cfg["size_mb"],
            "downloaded":  manifest.exists(),
            "n_samples":   n_samples,
        })
    return out


# ── LibriSpeech downloader ─────────────────────────────────────────────────────

def _download_file(url: str, dest: Path) -> None:
    """Stream-download url → dest with progress updates."""
    import urllib.request

    dest.parent.mkdir(parents=True, exist_ok=True)
    _set(state="downloading", message=f"Downloading {url.split('/')[-1]}…", progress=2)

    with urllib.request.urlopen(url, timeout=120) as resp:
        total = int(resp.headers.get("Content-Length", 0))
        downloaded = 0
        chunk = 1 << 18  # 256 KB
        with open(dest, "wb") as f:
            while True:
                data = resp.read(chunk)
                if not data:
                    break
                f.write(data)
                downloaded += len(data)
                if total:
                    pct = int(50 * downloaded / total)
                    _set(progress=pct, message=f"Downloading… {downloaded//(1<<20)} / {total//(1<<20)} MB")

    _set(progress=52, message="Download complete. Extracting…")


def _extract_librispeech(archive: Path, cache_dir: Path) -> None:
    """Extract tar.gz and build manifest.jsonl."""
    _set(state="extracting", progress=52, message="Extracting archive…")
    with tarfile.open(archive, "r:gz") as tf:
        members = tf.getmembers()
        for i, member in enumerate(members):
            tf.extract(member, path=cache_dir)
            if i % 500 == 0:
                pct = 52 + int(35 * i / len(members))
                _set(progress=pct, message=f"Extracting {i}/{len(members)} files…")

    _set(progress=88, message="Building manifest…")
    _build_librispeech_manifest(cache_dir)


def _build_librispeech_manifest(cache_dir: Path) -> int:
    """Walk LibriSpeech directory, pair FLAC files with transcripts."""
    manifest_path = cache_dir / "manifest.jsonl"
    count = 0
    with open(manifest_path, "w", encoding="utf-8") as f:
        # LibriSpeech structure: LibriSpeech/<split>/<speaker>/<chapter>/<files>
        for trans_file in cache_dir.rglob("*.trans.txt"):
            chapter_dir = trans_file.parent
            with open(trans_file, encoding="utf-8") as tf:
                for line in tf:
                    line = line.strip()
                    if not line:
                        continue
                    parts = line.split(" ", 1)
                    if len(parts) != 2:
                        continue
                    file_id, text = parts
                    audio = chapter_dir / f"{file_id}.flac"
                    if audio.exists():
                        f.write(json.dumps({
                            "audio_path":    str(audio),
                            "transcription": text.lower(),
                        }) + "\n")
                        count += 1
    logger.info("Manifest: %d samples → %s", count, manifest_path)
    return count


def _download_librispeech(name: str, url: str, cache_dir: Path) -> None:
    cache_dir.mkdir(parents=True, exist_ok=True)
    archive = cache_dir / "archive.tar.gz"

    if not archive.exists():
        _download_file(url, archive)
    else:
        logger.info("Archive already exists, skipping download.")
        _set(state="extracting", progress=52, message="Archive cached. Extracting…")

    _extract_librispeech(archive, cache_dir)

    # Free up disk space — keep only audio + manifest
    manifest = cache_dir / "manifest.jsonl"
    n = 0
    if manifest.exists():
        with open(manifest) as f:
            n = sum(1 for _ in f)
    _set(state="done", progress=100, message=f"Ready — {n} samples", n_samples=n)


# ── Synthetic medical dataset ─────────────────────────────────────────────────

MEDICAL_SENTENCES = [
    # vital signs
    "Blood pressure is ninety over sixty, heart rate one forty.",
    "Oxygen saturation is dropping to eighty-five percent.",
    "Temperature is thirty-nine point two degrees Celsius.",
    "Respiratory rate is twenty-two breaths per minute.",
    "Pulse oximetry shows ninety-two percent saturation.",

    # diagnoses / symptoms
    "The patient presents with dyspnea and tachycardia.",
    "Patient reports acute chest pain radiating to the left arm.",
    "The CT scan shows bilateral pulmonary infiltrates.",
    "Electrocardiogram reveals ST elevation in leads two and three.",
    "The patient is in ventricular fibrillation.",
    "Patient shows signs of anaphylactic shock.",
    "There is evidence of myocardial infarction.",
    "Bradycardia with a rate of forty-two beats per minute.",
    "Hypoxemia secondary to pulmonary embolism.",
    "Patient is diaphoretic and cyanotic.",

    # medications / procedures
    "Administer ten milligrams of morphine intravenously.",
    "Give epinephrine point three milligrams intramuscular.",
    "Dosage adjusted to five hundred milligrams twice daily.",
    "Prepare the defibrillator for immediate use.",
    "Begin chest compressions at one hundred per minute.",
    "Intubate the patient immediately.",
    "Start dobutamine infusion at five micrograms per kilogram per minute.",
    "Administer atropine zero point five milligrams IV.",
    "Apply one hundred percent oxygen via non-rebreather mask.",
    "Insert peripheral IV access in the right antecubital.",

    # reports
    "Cardiac output is reduced, initiate vasopressor support.",
    "Allergic reaction confirmed, discontinue penicillin.",
    "Patient is unresponsive to verbal stimulation.",
    "Neurological exam shows focal deficit in the right hemisphere.",
    "Renal function deteriorating, creatinine rising.",
    "Prepare for emergency caesarean section.",
    "Patient requires urgent dialysis due to hyperkalemia.",
    "Tachypnea with accessory muscle use noted.",
    "Bilateral crackles on auscultation.",
    "Pericardial effusion visible on echocardiogram.",
]


def _generate_medical_synthetic(cache_dir: Path) -> None:
    """Generate synthetic medical dataset using Bark TTS."""
    try:
        import tts_engine
        import numpy as np
        import soundfile as sf
    except ImportError as e:
        raise RuntimeError(f"TTS dependencies missing: {e}")

    audio_dir = cache_dir / "audio"
    audio_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = cache_dir / "manifest.jsonl"

    sentences = MEDICAL_SENTENCES * 2   # ~70 samples

    _set(state="generating", progress=5, message=f"Generating {len(sentences)} medical samples via Bark TTS…")

    with open(manifest_path, "w", encoding="utf-8") as mf:
        for i, sentence in enumerate(sentences):
            wav_path = audio_dir / f"medical_{i:04d}.wav"
            try:
                audio_bytes = tts_engine.synthesize_speech(sentence)
                wav_path.write_bytes(audio_bytes)
                mf.write(json.dumps({"audio_path": str(wav_path), "transcription": sentence}) + "\n")
            except Exception as exc:
                logger.warning("TTS failed for sample %d ('%s'): %s", i, sentence[:30], exc)
            pct = 5 + int(90 * (i + 1) / len(sentences))
            _set(progress=pct, message=f"Generated {i+1}/{len(sentences)} samples…")

    n = sum(1 for _ in open(manifest_path))
    _set(state="done", progress=100, message=f"Medical synthetic dataset ready — {n} samples", n_samples=n)
    logger.info("Medical synthetic dataset: %d samples → %s", n, manifest_path)


# ── Public entry point ─────────────────────────────────────────────────────────

def download(dataset_name: str) -> None:
    """Download / generate a dataset. Meant to run in a background thread."""
    if dataset_name not in DATASETS:
        _set(state="error", error=f"Unknown dataset: {dataset_name}", message="Unknown dataset")
        return

    cfg       = DATASETS[dataset_name]
    cache_dir = _datasets_dir() / dataset_name

    _set(state="idle", dataset=dataset_name, progress=0, message="Starting…", error=None, n_samples=0)

    try:
        if cfg["type"] == "synthetic":
            _generate_medical_synthetic(cache_dir)
        elif cfg["type"] == "librispeech":
            _download_librispeech(dataset_name, cfg["url"], cache_dir)
        else:
            _set(state="error", error="Unsupported dataset type")
    except Exception as exc:
        logger.exception("Dataset '%s' failed: %s", dataset_name, exc)
        _set(state="error", error=str(exc), message="Failed — check logs")
