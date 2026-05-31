import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
BACKEND = ROOT / "Backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from lora_trainer import LoRATrainer


@pytest.fixture
def trainer(tmp_path):
    db_path = tmp_path / "lora_test.db"
    # Ensure schema exists
    import sqlite3
    conn = sqlite3.connect(str(db_path))
    conn.execute("""
        CREATE TABLE IF NOT EXISTS transcriptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT, timestamp TEXT, audio_filename TEXT, audio_path TEXT,
            transcription TEXT, reference_transcript TEXT DEFAULT NULL,
            duration_seconds REAL, model_used TEXT,
            cer_score REAL DEFAULT NULL, error_type TEXT DEFAULT NULL,
            confidence_score REAL DEFAULT NULL, noise_profile TEXT DEFAULT NULL,
            remedial_audio_path TEXT DEFAULT NULL
        )
    """)
    conn.commit()
    conn.close()
    return LoRATrainer(db_path=str(db_path), output_dir=str(tmp_path / "lora_out"))


@pytest.mark.slow
def test_lora_dry_run_completes(trainer):
    trainer.dry_run()


@pytest.mark.slow
def test_lora_load_remedial_samples_returns_list(trainer):
    result = trainer.load_remedial_samples()
    assert isinstance(result, list)


@pytest.mark.slow
def test_lora_evaluate_empty_list(trainer):
    trainer.evaluate([])  # must not raise
