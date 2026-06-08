"""Mixture-of-experts LoRA router: one adapter per error type."""

import logging
from pathlib import Path
from lora_trainer import LoRATrainer
from config import MODELS_DIR

logger = logging.getLogger(__name__)


class LoRAExpertRouter:
    ERROR_TYPES = ["noise", "accent", "pronunciation"]

    def __init__(
        self,
        db_path,
        base_model="facebook/wav2vec2-base-960h",
        output_dir: str | None = None,
    ):
        self.db_path = str(db_path)
        self.base_model = base_model
        self.output_dir = Path(output_dir or str(MODELS_DIR / "lora_experts"))
        for error_type in self.ERROR_TYPES:
            (self.output_dir / error_type).mkdir(parents=True, exist_ok=True)

    def train_expert(self, error_type: str, epochs: int = 3) -> None:
        """Train a dedicated LoRA adapter for one error type."""
        if error_type not in self.ERROR_TYPES:
            raise ValueError(f"Unknown error_type '{error_type}'. Must be one of {self.ERROR_TYPES}")
        logger.info("Training expert: %s", error_type)
        trainer = LoRATrainer(
            db_path=self.db_path,
            model_name=self.base_model,
            output_dir=str(self.output_dir / error_type),
        )
        trainer.train(epochs=epochs, error_type=error_type)

    def train_all(self, epochs: int = 3) -> None:
        """Train one expert adapter per error type sequentially."""
        for i, error_type in enumerate(self.ERROR_TYPES, start=1):
            logger.info("[%d/%d] Starting expert: %s", i, len(self.ERROR_TYPES), error_type)
            self.train_expert(error_type=error_type, epochs=epochs)
        logger.info("All experts complete.")

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
