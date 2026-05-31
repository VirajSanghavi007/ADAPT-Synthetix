"""
lora_experts.py — Mixture of LoRA Experts: one adapter per error type.

Each expert is a separate LoRA adapter trained exclusively on samples of its
error type, allowing the model to specialise per acoustic failure mode.
"""

from pathlib import Path
from lora_trainer import LoRATrainer


class LoRAExpertRouter:
    ERROR_TYPES = ["noise", "accent", "pronunciation"]

    def __init__(
        self,
        db_path,
        base_model="facebook/wav2vec2-base-960h",
        output_dir="Backend/models/lora_experts",
    ):
        self.db_path = str(db_path)
        self.base_model = base_model
        self.output_dir = Path(output_dir)
        for error_type in self.ERROR_TYPES:
            (self.output_dir / error_type).mkdir(parents=True, exist_ok=True)

    def train_expert(self, error_type: str, epochs: int = 3) -> None:
        """Train a dedicated LoRA adapter for one error type."""
        if error_type not in self.ERROR_TYPES:
            raise ValueError(f"Unknown error_type '{error_type}'. Must be one of {self.ERROR_TYPES}")
        print(f"[Experts] Training expert: {error_type}")
        trainer = LoRATrainer(
            db_path=self.db_path,
            model_name=self.base_model,
            output_dir=str(self.output_dir / error_type),
        )
        trainer.train(epochs=epochs, error_type=error_type)

    def train_all(self, epochs: int = 3) -> None:
        """Train one expert adapter per error type sequentially."""
        for i, error_type in enumerate(self.ERROR_TYPES, start=1):
            print(f"[Experts] [{i}/{len(self.ERROR_TYPES)}] Starting expert: {error_type}")
            self.train_expert(error_type=error_type, epochs=epochs)
        print("[Experts] All experts complete.")

    def get_adapter_status(self) -> dict:
        """
        Return a dict mapping each error_type to its adapter status.
        An adapter is considered to exist when at least one epoch_N
        subdirectory is present in the expert's output dir.
        """
        status = {}
        for error_type in self.ERROR_TYPES:
            expert_dir = self.output_dir / error_type
            epoch_dirs = list(expert_dir.glob("epoch_*")) if expert_dir.exists() else []
            status[error_type] = {
                "exists": bool(epoch_dirs),
                "path": str(expert_dir),
            }
        return status


if __name__ == "__main__":
    router = LoRAExpertRouter(db_path="Backend/data/adaptsynthetix.db")
    router.train_all(epochs=2)
