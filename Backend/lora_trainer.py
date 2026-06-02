"""
lora_trainer.py — LoRA / AdaLoRA fine-tuning for wav2vec2.

Research improvements applied:
  • AdaLoRA (Zhang et al. ICLR 2023) as default — adaptive rank per layer
  • Gradient clipping (max_norm=1.0) added to prevent divergence
  • Layer freezing: CNN feature extractor frozen (Pekarek Rosin, ICANN 2023)
  • 10% replay ratio per batch (Pekarek Rosin 2023)
  • Audio mono-enforcement and vocabulary filtering
  • Hardcoded paths replaced with config values
  • gradient_checkpointing to reduce memory footprint
"""
from __future__ import annotations

import argparse
import datetime
import json
import logging
import os
import sys
import time
from pathlib import Path

import librosa
import numpy as np
import torch
from peft import LoraConfig, get_peft_model
from transformers import Wav2Vec2ForCTC, Wav2Vec2Processor

from config import DB_PATH, MODELS_DIR

logger = logging.getLogger(__name__)

_DEFAULT_OUTPUT = str(MODELS_DIR / "lora")

# Try AdaLoRA if available (peft >= 0.6)
try:
    from peft import AdaLoraConfig
    _HAS_ADALORA = True
except ImportError:
    _HAS_ADALORA = False


class LoRATrainer:
    def __init__(
        self,
        db_path=None,
        model_name: str = "facebook/wav2vec2-base-960h",
        output_dir: str = _DEFAULT_OUTPUT,
        use_adalora: bool = True,
    ) -> None:
        self.db_path    = str(db_path or DB_PATH)
        self.model_name = model_name
        self.output_dir = output_dir
        self.use_adalora = use_adalora and _HAS_ADALORA
        os.makedirs(self.output_dir, exist_ok=True)

    def _connect(self):
        import sqlite3
        c = sqlite3.connect(self.db_path)
        c.row_factory = sqlite3.Row
        return c

    def _count_params(self, model) -> tuple[int, int]:
        total     = sum(p.numel() for p in model.parameters())
        trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
        return trainable, total

    # ── Data loading ──────────────────────────────────────────

    def load_remedial_samples(self, error_type: str | None = None, limit: int = 50) -> list[dict]:
        q = """SELECT remedial_audio_path AS audio_path,
                      COALESCE(NULLIF(TRIM(reference_transcript), ''), transcription) AS transcription,
                      error_type, confidence_score
               FROM transcriptions
               WHERE remedial_audio_path IS NOT NULL AND TRIM(remedial_audio_path) != ''"""
        params: list = []
        if error_type:
            q += " AND error_type = ?"
            params.append(error_type)
        q += " ORDER BY COALESCE(confidence_score, 1.0) ASC LIMIT ?"
        params.append(int(limit))
        with self._connect() as c:
            return [dict(r) for r in c.execute(q, params).fetchall()]

    def load_replay_samples(self, n: int = 20) -> list[dict]:
        with self._connect() as c:
            rows = c.execute("""
                SELECT remedial_audio_path AS audio_path,
                       COALESCE(NULLIF(TRIM(reference_transcript),''), transcription) AS transcription,
                       COALESCE(error_type,'unknown') AS error_type
                FROM transcriptions
                WHERE remedial_audio_path IS NOT NULL AND TRIM(remedial_audio_path) != ''
                ORDER BY RANDOM() LIMIT ?
            """, (n,)).fetchall()
        return [dict(r) for r in rows]

    # ── Model prep ────────────────────────────────────────────

    def prepare_model(self):
        processor = Wav2Vec2Processor.from_pretrained(self.model_name)
        model     = Wav2Vec2ForCTC.from_pretrained(self.model_name)

        if self.use_adalora:
            config = AdaLoraConfig(
                init_r=12,
                target_r=8,
                beta1=0.85,
                beta2=0.85,
                tinit=200,
                tfinal=1000,
                deltaT=10,
                lora_alpha=16,
                lora_dropout=0.05,
                target_modules=["q_proj", "v_proj", "k_proj", "out_proj"],
                orth_reg_weight=0.5,
            )
            logger.info("Using AdaLoRA (adaptive rank per layer)")
        else:
            config = LoraConfig(
                r=8,
                lora_alpha=16,
                target_modules=["q_proj", "v_proj"],
                lora_dropout=0.05,
                bias="none",
            )
            logger.info("Using fixed-rank LoRA (r=8)")

        model = get_peft_model(model, config)

        # Freeze CNN feature extractor (Pekarek Rosin 2023)
        for name, param in model.named_parameters():
            if "feature_extractor" in name or "feature_projection" in name:
                param.requires_grad = False

        trainable, total = self._count_params(model)
        logger.info(f"Trainable: {trainable:,} / {total:,} ({100*trainable/total:.2f}%)")
        return model, processor

    # ── Training ──────────────────────────────────────────────

    def train(self, epochs: int = 3, lr: float = 1e-4, error_type: str | None = None) -> None:
        start   = time.time()
        samples = self.load_remedial_samples(error_type=error_type)
        if len(samples) < 5:
            logger.warning("Not enough remedial samples (<5). Skipping.")
            return

        # 10% replay ratio (Pekarek Rosin 2023)
        n_replay = max(1, len(samples) // 10)
        replay   = self.load_replay_samples(n_replay)

        model, processor = self.prepare_model()
        model.train()
        model.gradient_checkpointing_enable()
        optimizer = torch.optim.AdamW(
            [p for p in model.parameters() if p.requires_grad],
            lr=lr,
            weight_decay=0.01,
        )
        # Cosine LR scheduler
        total_steps = epochs * (len(samples) + len(replay))
        scheduler   = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=total_steps)

        final_loss = None
        vocab = set(processor.tokenizer.get_vocab().keys())

        for epoch in range(1, epochs + 1):
            epoch_losses: list[float] = []

            # Mix: samples + replay in 10% ratio
            batch = list(samples) + list(replay)

            for s in batch:
                path       = s.get("audio_path", "")
                transcript = (s.get("transcription") or "").strip()
                if not path or not transcript or not os.path.exists(path):
                    continue

                audio, _ = librosa.load(path, sr=16000, mono=True)
                if audio.ndim != 1:
                    audio = audio.flatten()

                # Filter out-of-vocab chars
                transcript = "".join(ch for ch in transcript.upper() if ch in vocab or ch == " ")
                if not transcript.strip():
                    continue

                inputs = processor(audio, sampling_rate=16000, return_tensors="pt", padding=True)
                labels = processor.tokenizer(transcript, return_tensors="pt").input_ids

                outputs = model(**inputs, labels=labels)
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

            mean = float(np.mean(epoch_losses)) if epoch_losses else float("nan")
            logger.info(f"Epoch {epoch}/{epochs} — loss {mean:.4f} — lr {scheduler.get_last_lr()[0]:.2e}")
            ep_dir = os.path.join(self.output_dir, f"epoch_{epoch}")
            os.makedirs(ep_dir, exist_ok=True)
            model.save_pretrained(ep_dir)

        duration = time.time() - start
        ts       = datetime.datetime.now().strftime("%Y%m%dT%H%M%S")
        log_path = os.path.join(self.output_dir, f"training_log_{ts}.json")
        with open(log_path, "w", encoding="utf-8") as fp:
            json.dump({
                "epochs":           int(epochs),
                "samples_used":     len(samples),
                "replay_used":      len(replay),
                "final_loss":       final_loss,
                "duration_seconds": round(duration, 2),
                "trained_at":       datetime.datetime.now().isoformat(),
                "adalora":          self.use_adalora,
            }, fp, indent=2)
        logger.info(f"Training log → {log_path}")

    def dry_run(self) -> None:
        samples = self.load_remedial_samples()
        model, _ = self.prepare_model()
        t, n = self._count_params(model)
        print(f"Samples: {len(samples)}  |  Trainable: {t:,}/{n:,}  |  AdaLoRA: {self.use_adalora}")
        print("DRY RUN COMPLETE")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run",    action="store_true")
    parser.add_argument("--error-type", default=None)
    parser.add_argument("--epochs",     type=int,   default=3)
    parser.add_argument("--lr",         type=float, default=1e-4)
    parser.add_argument("--no-adalora", action="store_true")
    args = parser.parse_args()

    trainer = LoRATrainer(use_adalora=not args.no_adalora)
    if args.dry_run:
        trainer.dry_run()
    else:
        trainer.train(epochs=args.epochs, lr=args.lr, error_type=args.error_type)
