from pathlib import Path

# Project Root
ROOT_DIR = Path(__file__).parent.parent.absolute()

# Database
DB_DIR = ROOT_DIR / "Backend" / "data"
DB_PATH = DB_DIR / "adaptsynthetix.db"

# Data/Datasets
DATASET_DIR = ROOT_DIR / "dataset"
RAW_AUDIO_DIR = DATASET_DIR / "raw_audio"
REMEDIAL_AUDIO_DIR = DATASET_DIR / "remedial_audio"

# Logs
LOGS_DIR = ROOT_DIR / "Backend" / "logs"

# Models
MODELS_DIR = ROOT_DIR / "models"

# Temporary Uploads
TEMP_DIR = ROOT_DIR / "Backend" / "temp"

# Ensure critical directories exist
for d in [DB_DIR, RAW_AUDIO_DIR, REMEDIAL_AUDIO_DIR, LOGS_DIR, TEMP_DIR]:
    d.mkdir(parents=True, exist_ok=True)
