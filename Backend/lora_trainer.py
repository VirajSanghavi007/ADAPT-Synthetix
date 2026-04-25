import argparse
import datetime
import json
import os
import sqlite3
import sys
import time

import librosa
import numpy as np
import torch
import torchaudio
from peft import LoraConfig, TaskType, get_peft_model
from transformers import Wav2Vec2ForCTC, Wav2Vec2Processor


class LoRATrainer:
    def __init__(
        self,
        db_path,
        model_name="facebook/wav2vec2-base-960h",
        output_dir="Backend/models/lora",
    ):
        self.db_path = db_path
        self.model_name = model_name
        self.output_dir = output_dir
        os.makedirs(self.output_dir, exist_ok=True)
        self.lora_config = LoraConfig(
            task_type=TaskType.TOKEN_CLS,
            r=8,
            lora_alpha=32,
            target_modules=["q_proj", "v_proj"],
            lora_dropout=0.1,
            bias="none",
        )

    def _connect(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _count_parameters(self, model):
        total = sum(p.numel() for p in model.parameters())
        trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
        return trainable, total

    def load_remedial_samples(self, error_type=None, limit=50):
        query = """
            SELECT remedial_audio_path AS audio_path, transcription, error_type, confidence_score
            FROM transcriptions
            WHERE remedial_audio_path IS NOT NULL
              AND TRIM(remedial_audio_path) != ''
        """
        params = []
        if error_type:
            query += " AND error_type = ?"
            params.append(error_type)
        query += " ORDER BY COALESCE(confidence_score, 1.0) ASC LIMIT ?"
        params.append(int(limit))

        with self._connect() as conn:
            rows = conn.execute(query, tuple(params)).fetchall()

        return [dict(row) for row in rows]

    def prepare_model(self):
        processor = Wav2Vec2Processor.from_pretrained(self.model_name)
        model = Wav2Vec2ForCTC.from_pretrained(self.model_name)
        model = get_peft_model(model, self.lora_config)
        trainable, total = self._count_parameters(model)
        print(f"Trainable parameters: {trainable:,} / {total:,}")
        return model, processor

    def dry_run(self):
        print("╔════════════════════════════════════╗")
        print("║     ADAPT-Synthetix LoRA Trainer   ║")
        print("╠════════════════════════════════════╣")
        print("║ Mode          : DRY RUN            ║")
        print(f"║ Base Model    : {self.model_name:<18}║")
        print("║ LoRA Rank     : 8                  ║")
        print("║ LoRA Alpha    : 32                 ║")
        print("║ Target Modules: q_proj, v_proj     ║")
        print("║ Dropout       : 0.1                ║")
        print("╚════════════════════════════════════╝")
        samples = self.load_remedial_samples()
        print(f"Remedial samples found: {len(samples)}")
        model, _ = self.prepare_model()
        trainable, total = self._count_parameters(model)
        print(f"Trainable vs total: {trainable:,} / {total:,}")
        print(f"DRY RUN COMPLETE — Ready to train on {len(samples)} samples")

    def train(self, epochs=3, learning_rate=1e-4, error_type=None):
        start = time.time()
        samples = self.load_remedial_samples(error_type=error_type)
        if len(samples) < 5:
            print("[LoRA] Not enough remedial samples (<5). Skipping training.")
            return

        model, processor = self.prepare_model()
        model.train()
        optimizer = torch.optim.AdamW(model.parameters(), lr=learning_rate)
        final_loss = None

        for epoch in range(1, int(epochs) + 1):
            epoch_losses = []
            for sample in samples:
                audio_path = sample.get("audio_path")
                transcript = (sample.get("transcription") or "").strip()
                if not audio_path or not transcript or not os.path.exists(audio_path):
                    continue

                audio, _sr = librosa.load(audio_path, sr=16000)
                inputs = processor(audio, sampling_rate=16000, return_tensors="pt", padding=True)
                with processor.as_target_processor():
                    labels = processor(transcript, return_tensors="pt").input_ids

                outputs = model(**inputs, labels=labels)
                loss = outputs.loss
                optimizer.zero_grad()
                loss.backward()
                optimizer.step()

                loss_value = float(loss.item())
                epoch_losses.append(loss_value)
                final_loss = loss_value

            mean_loss = float(np.mean(epoch_losses)) if epoch_losses else float("nan")
            print(f"[LoRA] Epoch {epoch}/{epochs} - loss: {mean_loss:.4f}")
            save_dir = os.path.join(self.output_dir, f"epoch_{epoch}")
            os.makedirs(save_dir, exist_ok=True)
            model.save_pretrained(save_dir)

        duration = time.time() - start
        timestamp = datetime.datetime.now().strftime("%Y%m%dT%H%M%S")
        log_path = os.path.join(self.output_dir, f"training_log_{timestamp}.json")
        training_log = {
            "epochs": int(epochs),
            "samples_used": len(samples),
            "final_loss": final_loss,
            "duration_seconds": round(duration, 2),
            "trained_at": datetime.datetime.now().isoformat(),
        }
        with open(log_path, "w", encoding="utf-8") as fp:
            json.dump(training_log, fp, indent=2)
        print(f"[LoRA] Training log saved to {log_path}")

    def evaluate(self, test_samples):
        from diagnostics import calculate_cer

        model, processor = self.prepare_model()
        model.eval()
        cer_before = []
        cer_after = []

        for sample in test_samples:
            audio_path = sample.get("audio_path")
            reference = (sample.get("reference") or "").strip()
            baseline = sample.get("baseline_hypothesis")
            if not audio_path or not reference or not os.path.exists(audio_path):
                continue

            audio, _sr = librosa.load(audio_path, sr=16000)
            inputs = processor(audio, sampling_rate=16000, return_tensors="pt", padding=True)
            with torch.no_grad():
                logits = model(**inputs).logits
            predicted_ids = torch.argmax(logits, dim=-1)
            hypothesis = processor.batch_decode(predicted_ids)[0]

            after = calculate_cer(reference, hypothesis)
            before = calculate_cer(reference, baseline) if baseline else None
            if before is not None:
                cer_before.append(before)
            if after is not None:
                cer_after.append(after)
            print(
                f"Sample: {os.path.basename(audio_path)} | "
                f"CER before: {before if before is not None else 'N/A'} | CER after: {after}"
            )

        avg_before = float(np.mean(cer_before)) if cer_before else None
        avg_after = float(np.mean(cer_after)) if cer_after else None
        print("╔════════════════════════════════════╗")
        print("║      LoRA Evaluation Summary       ║")
        print("╠════════════════════════════════════╣")
        print(f"║ Avg CER Before: {str(avg_before):<18}║")
        print(f"║ Avg CER After : {str(avg_after):<18}║")
        print("╚════════════════════════════════════╝")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--error-type", default=None)
    parser.add_argument("--epochs", type=int, default=3)
    args = parser.parse_args()

    trainer = LoRATrainer(db_path="Backend/data/adaptsynthetix.db")
    if args.dry_run:
        trainer.dry_run()
    else:
        trainer.train(epochs=args.epochs, error_type=args.error_type)
