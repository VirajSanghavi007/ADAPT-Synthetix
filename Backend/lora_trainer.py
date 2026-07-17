"""LoRA/AdaLoRA fine-tuning for Wav2Vec2 on remedial samples."""
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
from experience_replay import ReplayBuffer

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
        self.replay_buffer = ReplayBuffer(db_path=self.db_path)
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
        samples = self.replay_buffer.sample(n)
        if samples:
            return samples
        # Fallback SQL query on first training run before buffer is populated
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

    def prepare_model(self, total_steps: int | None = None):
        processor = Wav2Vec2Processor.from_pretrained(self.model_name)
        model     = Wav2Vec2ForCTC.from_pretrained(self.model_name)

        if self.use_adalora:
            # Estimate total steps for AdaLoRA (will be refined in train())
            total_steps = 1000
            config = AdaLoraConfig(
                init_r=12,
                target_r=8,
                beta1=0.85,
                beta2=0.85,
                tinit=100,
                tfinal=500,
                deltaT=10,
                lora_alpha=16,
                lora_dropout=0.05,
                target_modules=["q_proj", "v_proj", "k_proj", "out_proj"],
                orth_reg_weight=0.5,
                total_step=total_steps,
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
        logger.info("Trainable: %s / %s (%.2f%%)", f"{trainable:,}", f"{total:,}", 100 * trainable / total)
        return model, processor

    # ── Training ──────────────────────────────────────────────

    def train(self, epochs: int = 3, lr: float = 1e-4, error_type: str | None = None, on_epoch=None) -> None:
        start   = time.time()
        samples = self.load_remedial_samples(error_type=error_type)
        if len(samples) < 5:
            logger.warning("Not enough remedial samples (<5). Skipping.")
            return

        # 10% replay ratio (Pekarek Rosin 2023)
        n_replay = max(1, len(samples) // 10)
        replay   = self.load_replay_samples(n_replay)

        # Compute total steps for AdaLoRA scheduler
        total_steps = epochs * (len(samples) + len(replay))

        model, processor = self.prepare_model(total_steps=total_steps)
        model.train()
        model.gradient_checkpointing_enable()
        optimizer = torch.optim.AdamW(
            [p for p in model.parameters() if p.requires_grad],
            lr=lr,
            weight_decay=0.01,
        )
        # Cosine LR scheduler
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
                self.replay_buffer.add(
                    path,
                    transcript,
                    s.get("error_type") or "unknown",
                )

            mean = float(np.mean(epoch_losses)) if epoch_losses else float("nan")
            logger.info("Epoch %d/%d — loss %.4f — lr %.2e", epoch, epochs, mean, scheduler.get_last_lr()[0])
            if on_epoch is not None:
                on_epoch(epoch, epochs, mean)
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
        logger.info("Training log → %s", log_path)

    # ── Evaluation ────────────────────────────────────────────

    def evaluate(self, samples: list) -> dict:
        """
        Evaluate LoRA-adapted model on holdout samples.

        Args:
            samples: list of dicts with keys 'audio_path' and 'reference' (or 'transcription')

        Returns:
            {"wer": float, "per": float, "sample_count": int}
        """
        from asr_module import transcribe_audio_with_logits
        import diagnostics as _diag

        if not samples:
            return {"wer": 0.0, "per": 0.0, "sample_count": 0}

        wer_scores: list[float] = []
        per_scores: list[float] = []
        for s in samples:
            audio_path = str(s.get("audio_path", ""))
            reference  = str(s.get("reference") or s.get("transcription") or "").strip()
            if not audio_path or not reference or not os.path.exists(audio_path):
                continue
            try:
                hypothesis, _, _, _ = transcribe_audio_with_logits(audio_path)
                wer = _diag.calculate_wer(reference, hypothesis)
                per = _diag.phoneme_error_rate(reference, hypothesis)
                if wer is not None:
                    wer_scores.append(wer)
                if per is not None:
                    per_scores.append(per)
            except Exception as exc:
                logger.warning("evaluate: skipping %s — %s", audio_path, exc)

        n = len(wer_scores)
        result = {
            "wer":          round(sum(wer_scores) / n, 4) if n else 0.0,
            "per":          round(sum(per_scores) / len(per_scores), 4) if per_scores else 0.0,
            "sample_count": n,
        }
        logger.info("Evaluation complete: %s", result)
        return result

    def dry_run(self) -> None:
        samples = self.load_remedial_samples()
        model, _ = self.prepare_model()
        t, n = self._count_params(model)
        logger.info("Samples: %d  |  Trainable: %s/%s  |  AdaLoRA: %s", len(samples), f"{t:,}", f"{n:,}", self.use_adalora)
        logger.info("DRY RUN COMPLETE")


class WhisperLoRATrainer:
    """
    LoRA fine-tuning for WhisperForConditionalGeneration.

    Fine-tunes the cross-attention (q_proj / v_proj) in both the encoder and decoder
    while keeping the CNN front-end and positional embeddings frozen.  Uses the same
    10 % experience-replay ratio as LoRATrainer (Pekarek Rosin & Wermter, ICANN 2023).
    """

    def __init__(
        self,
        db_path=None,
        model_name: str | None = None,
        output_dir: str | None = None,
    ) -> None:
        from config import ASR_MODEL
        self.db_path    = str(db_path or DB_PATH)
        self.model_name = model_name or ASR_MODEL
        self.output_dir = output_dir or str(MODELS_DIR / "whisper_lora")
        self.replay_buffer = ReplayBuffer(db_path=self.db_path)
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

    def prepare_model(self):
        from transformers import WhisperForConditionalGeneration, WhisperProcessor

        logger.info("Loading Whisper model for LoRA training: %s", self.model_name)
        processor = WhisperProcessor.from_pretrained(self.model_name)
        model     = WhisperForConditionalGeneration.from_pretrained(self.model_name)

        lora_cfg = LoraConfig(
            r=8,
            lora_alpha=16,
            # Target cross-attention in both encoder and decoder
            target_modules=["q_proj", "v_proj"],
            lora_dropout=0.05,
            bias="none",
        )
        model = get_peft_model(model, lora_cfg)

        # Freeze CNN front-end (conv layers) — equivalent to feature extractor freeze
        for name, param in model.named_parameters():
            if "conv" in name and "embed" not in name:
                param.requires_grad = False

        trainable, total = self._count_params(model)
        logger.info("Whisper LoRA — trainable: %s / %s (%.2f%%)",
                    f"{trainable:,}", f"{total:,}", 100 * trainable / total)
        return model, processor

    def train(
        self,
        epochs: int = 3,
        lr: float = 1e-4,
        error_type: str | None = None,
        on_epoch=None,
    ) -> None:
        start   = time.time()
        samples = self.load_remedial_samples(error_type=error_type)
        if len(samples) < 5:
            logger.warning("WhisperLoRATrainer: not enough remedial samples (<5). Skipping.")
            return

        n_replay = max(1, len(samples) // 10)
        replay   = self.replay_buffer.sample(n_replay) or []

        model, processor = self.prepare_model()
        model.train()
        optimizer = torch.optim.AdamW(
            [p for p in model.parameters() if p.requires_grad],
            lr=lr,
            weight_decay=0.01,
        )
        total_steps = epochs * (len(samples) + len(replay))
        scheduler   = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=max(1, total_steps))

        final_loss = None
        pad_token_id = processor.tokenizer.pad_token_id

        for epoch in range(1, epochs + 1):
            epoch_losses: list[float] = []
            batch = list(samples) + list(replay)

            for s in batch:
                path       = s.get("audio_path", "")
                transcript = (s.get("transcription") or "").strip()
                if not path or not transcript or not os.path.exists(path):
                    continue

                try:
                    audio, _ = librosa.load(path, sr=16000, mono=True)
                    input_features = processor(
                        audio, sampling_rate=16000, return_tensors="pt"
                    ).input_features

                    label_ids = processor(text=transcript, return_tensors="pt").input_ids
                    # Mask padding with -100 so it doesn't contribute to loss
                    label_ids[label_ids == pad_token_id] = -100

                    outputs = model(input_features=input_features, labels=label_ids)
                    loss = outputs.loss
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
                    self.replay_buffer.add(path, transcript, s.get("error_type") or "unknown")
                except Exception as exc:
                    logger.warning("WhisperLoRATrainer: skipping sample %s — %s", path, exc)

            mean = float(np.mean(epoch_losses)) if epoch_losses else float("nan")
            logger.info("Whisper epoch %d/%d — loss %.4f", epoch, epochs, mean)
            if on_epoch is not None:
                on_epoch(epoch, epochs, mean)
            ep_dir = os.path.join(self.output_dir, f"epoch_{epoch}")
            os.makedirs(ep_dir, exist_ok=True)
            model.save_pretrained(ep_dir)

        duration = time.time() - start
        ts       = datetime.datetime.now().strftime("%Y%m%dT%H%M%S")
        log_path = os.path.join(self.output_dir, f"training_log_{ts}.json")
        with open(log_path, "w", encoding="utf-8") as fp:
            json.dump({
                "backend":          "whisper",
                "model":            self.model_name,
                "epochs":           int(epochs),
                "samples_used":     len(samples),
                "replay_used":      len(replay),
                "final_loss":       final_loss,
                "duration_seconds": round(duration, 2),
                "trained_at":       datetime.datetime.now().isoformat(),
            }, fp, indent=2)
        logger.info("Whisper LoRA training log → %s", log_path)

    def evaluate(self, samples: list) -> dict:
        """Evaluate LoRA-adapted Whisper on holdout samples. Returns WER dict."""
        from asr_module import transcribe_audio_with_logits
        import diagnostics as _diag

        if not samples:
            return {"wer": 0.0, "per": 0.0, "sample_count": 0}

        wer_scores: list[float] = []
        per_scores: list[float] = []
        for s in samples:
            audio_path = str(s.get("audio_path", ""))
            reference  = str(s.get("reference") or s.get("transcription") or "").strip()
            if not audio_path or not reference or not os.path.exists(audio_path):
                continue
            try:
                hypothesis, _, _, _ = transcribe_audio_with_logits(audio_path)
                w = _diag.calculate_wer(reference, hypothesis)
                p = _diag.phoneme_error_rate(reference, hypothesis)
                if w is not None:
                    wer_scores.append(w)
                if p is not None:
                    per_scores.append(p)
            except Exception as exc:
                logger.warning("WhisperLoRATrainer.evaluate: skipping %s — %s", audio_path, exc)

        n = len(wer_scores)
        result = {
            "wer":          round(sum(wer_scores) / n, 4) if n else 0.0,
            "per":          round(sum(per_scores) / len(per_scores), 4) if per_scores else 0.0,
            "sample_count": n,
        }
        logger.info("Whisper evaluation complete: %s", result)
        return result


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
