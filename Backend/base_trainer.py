"""
base_trainer.py — Fine-tune Whisper (or Wav2Vec2) on a locally downloaded dataset.

Unlike lora_trainer.py which targets remedial samples, this trainer runs on a full
public corpus (LibriSpeech, synthetic medical, etc.) to build a domain-adapted base
before LoRA adaptation layers are applied.

Architecture:
  - Loads manifest.jsonl from DATASETS_DIR/<dataset_name>/
  - Applies LoRA adapters (same config as WhisperLoRATrainer)
  - Saves trained adapters to MODELS_DIR/base_finetuned/
  - On completion, asr_module.py prefers the local adapter over the raw HF weights
"""
from __future__ import annotations

import datetime
import json
import logging
import os
import threading
import time
from pathlib import Path
from typing import Callable, Optional

import numpy as np
import torch
from peft import LoraConfig, get_peft_model

logger = logging.getLogger(__name__)


def _get_dirs():
    from config import DATASETS_DIR, MODELS_DIR
    return DATASETS_DIR, MODELS_DIR


# ── In-memory training status ─────────────────────────────────────────────────
_bt_lock = threading.Lock()
_bt_status: dict = {
    "state":    "idle",   # idle | running | done | error
    "dataset":  None,
    "progress": 0,
    "epoch":    0,
    "epochs":   0,
    "loss":     None,
    "message":  "",
    "error":    None,
    "trained_at": None,
}


def get_base_training_status() -> dict:
    with _bt_lock:
        return dict(_bt_status)


def _bt_set(**kwargs):
    with _bt_lock:
        _bt_status.update(kwargs)
        _, MODELS_DIR = _get_dirs()
        try:
            (MODELS_DIR / "base_training_status.json").write_text(json.dumps(_bt_status))
        except Exception:
            pass


# ── Data loading ──────────────────────────────────────────────────────────────

def _load_manifest(dataset_name: str) -> list[dict]:
    DATASETS_DIR, _ = _get_dirs()
    manifest = DATASETS_DIR / dataset_name / "manifest.jsonl"
    if not manifest.exists():
        raise FileNotFoundError(f"No manifest found for '{dataset_name}'. Download the dataset first.")
    rows = []
    with open(manifest, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    rows.append(json.loads(line))
                except json.JSONDecodeError:
                    pass
    return rows


# ── Whisper fine-tuning ───────────────────────────────────────────────────────

class BaseTrainer:
    """
    Fine-tune Whisper on a full corpus using LoRA adapters.

    The trained adapter is saved to MODELS_DIR/base_finetuned/<dataset_name>/
    and is automatically picked up by asr_module.py on next load.
    """

    def __init__(
        self,
        dataset_name: str = "librispeech-dev-clean",
        epochs: int = 3,
        lr: float = 5e-5,
        max_samples: int = 2000,
        model_name: Optional[str] = None,
    ) -> None:
        from config import ASR_MODEL
        self.dataset_name = dataset_name
        self.epochs       = epochs
        self.lr           = lr
        self.max_samples  = max_samples
        self.model_name   = model_name or ASR_MODEL
        _, MODELS_DIR     = _get_dirs()
        self.output_dir   = MODELS_DIR / "base_finetuned" / dataset_name
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def _prepare_whisper(self):
        from transformers import WhisperForConditionalGeneration, WhisperProcessor
        logger.info("Loading Whisper for base fine-tuning: %s", self.model_name)
        processor = WhisperProcessor.from_pretrained(self.model_name)
        model     = WhisperForConditionalGeneration.from_pretrained(self.model_name)

        lora_cfg = LoraConfig(
            r=16,
            lora_alpha=32,
            target_modules=["q_proj", "v_proj"],
            lora_dropout=0.05,
            bias="none",
        )
        model = get_peft_model(model, lora_cfg)

        # Freeze CNN front-end conv layers
        for name, param in model.named_parameters():
            if "conv" in name and "embed" not in name:
                param.requires_grad = False

        trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
        total     = sum(p.numel() for p in model.parameters())
        logger.info("Trainable: %s / %s (%.2f%%)", f"{trainable:,}", f"{total:,}",
                    100 * trainable / total)
        return model, processor

    def train(self, on_progress: Optional[Callable] = None) -> dict:
        _bt_set(state="running", dataset=self.dataset_name,
                epochs=self.epochs, progress=0, error=None,
                message="Loading dataset…")

        rows = _load_manifest(self.dataset_name)
        if not rows:
            raise ValueError("Manifest is empty — no samples to train on.")

        # Cap to max_samples for CPU training
        if len(rows) > self.max_samples:
            import random
            random.shuffle(rows)
            rows = rows[:self.max_samples]

        logger.info("Base training: %d samples, %d epochs, lr=%s", len(rows), self.epochs, self.lr)
        _bt_set(message=f"Loaded {len(rows)} samples. Building model…", progress=2)

        model, processor = self._prepare_whisper()
        model.train()

        optimizer   = torch.optim.AdamW(
            [p for p in model.parameters() if p.requires_grad],
            lr=self.lr, weight_decay=0.01,
        )
        total_steps = self.epochs * len(rows)
        scheduler   = torch.optim.lr_scheduler.CosineAnnealingLR(
            optimizer, T_max=max(1, total_steps)
        )

        pad_token_id = processor.tokenizer.pad_token_id
        start_time   = time.time()
        final_loss   = None

        for epoch in range(1, self.epochs + 1):
            _bt_set(epoch=epoch, message=f"Epoch {epoch}/{self.epochs}…")
            epoch_losses: list[float] = []

            for i, row in enumerate(rows):
                audio_path = row.get("audio_path", "")
                text       = (row.get("transcription") or "").strip()

                if not audio_path or not text or not os.path.exists(audio_path):
                    continue

                try:
                    import librosa
                    audio, _ = librosa.load(audio_path, sr=16_000, mono=True)
                    if len(audio) < 400:
                        continue

                    input_features = processor(
                        audio, sampling_rate=16_000, return_tensors="pt"
                    ).input_features

                    label_ids = processor(text=text, return_tensors="pt").input_ids
                    label_ids[label_ids == pad_token_id] = -100

                    outputs = model(input_features=input_features, labels=label_ids)
                    loss    = outputs.loss
                    if loss is None or torch.isnan(loss):
                        continue

                    optimizer.zero_grad()
                    loss.backward()
                    torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
                    optimizer.step()
                    scheduler.step()

                    v = float(loss.item())
                    epoch_losses.append(v)
                    final_loss = v

                except Exception as exc:
                    logger.warning("Skipping %s: %s", audio_path, exc)

                # Progress: epochs are 5%–95%, split evenly
                global_step = (epoch - 1) * len(rows) + i + 1
                total_work  = self.epochs * len(rows)
                pct         = 5 + int(90 * global_step / total_work)
                _bt_set(progress=pct, loss=round(final_loss, 4) if final_loss else None)
                if on_progress:
                    on_progress(pct, epoch, self.epochs, final_loss)

            mean = float(np.mean(epoch_losses)) if epoch_losses else float("nan")
            logger.info("Epoch %d/%d — avg loss %.4f", epoch, self.epochs, mean)

            # Save adapter checkpoint per epoch
            ep_dir = self.output_dir / f"epoch_{epoch}"
            ep_dir.mkdir(exist_ok=True)
            model.save_pretrained(str(ep_dir))
            logger.info("Saved epoch %d adapter → %s", epoch, ep_dir)

        # Save final adapter
        final_dir = self.output_dir / "final"
        final_dir.mkdir(exist_ok=True)
        model.save_pretrained(str(final_dir))
        processor.save_pretrained(str(final_dir))

        duration = time.time() - start_time
        ts       = datetime.datetime.now().isoformat()
        result   = {
            "dataset":          self.dataset_name,
            "model":            self.model_name,
            "epochs":           self.epochs,
            "samples":          len(rows),
            "final_loss":       final_loss,
            "duration_seconds": round(duration, 1),
            "trained_at":       ts,
            "adapter_path":     str(final_dir),
        }
        log_path = self.output_dir / f"training_log_{datetime.datetime.now().strftime('%Y%m%dT%H%M%S')}.json"
        log_path.write_text(json.dumps(result, indent=2))

        _bt_set(state="done", progress=100,
                message=f"Done — {len(rows)} samples, {self.epochs} epochs, loss {final_loss:.4f}" if final_loss else "Done",
                trained_at=ts)
        logger.info("Base fine-tuning complete → %s", final_dir)
        return result


def run_base_training(dataset_name: str, epochs: int = 3, max_samples: int = 2000,
                      model_name: Optional[str] = None) -> None:
    """Entry point for BackgroundTasks. Catches all exceptions."""
    try:
        trainer = BaseTrainer(
            dataset_name=dataset_name,
            epochs=epochs,
            max_samples=max_samples,
            model_name=model_name,
        )
        trainer.train()
    except FileNotFoundError as exc:
        logger.error("Base training failed — dataset not found: %s", exc)
        _bt_set(state="error", error=str(exc),
                message="Dataset not downloaded yet — download it first")
    except Exception as exc:
        logger.exception("Base training failed: %s", exc)
        _bt_set(state="error", error=str(exc), message="Training failed — check logs")
