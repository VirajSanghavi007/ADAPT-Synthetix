import json
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path


class DatasetManager:
    def __init__(self, dataset_dir="Dataset"):
        self.dataset_dir = Path(dataset_dir)
        self.labels_dir = self.dataset_dir / "labels"
        self.noisy_dir = self.dataset_dir / "noisy"
        self.accented_dir = self.dataset_dir / "accented"
        self.medical_dir = self.dataset_dir / "medical"
        self.manifest_path = self.dataset_dir / "manifest.json"

        self.dataset_dir.mkdir(parents=True, exist_ok=True)
        self.labels_dir.mkdir(parents=True, exist_ok=True)
        self.noisy_dir.mkdir(parents=True, exist_ok=True)
        self.accented_dir.mkdir(parents=True, exist_ok=True)
        self.medical_dir.mkdir(parents=True, exist_ok=True)

        if not self.manifest_path.exists():
            self._save_manifest([])

    def _load_manifest(self):
        if not self.manifest_path.exists():
            return []
        try:
            with open(self.manifest_path, "r", encoding="utf-8") as file_obj:
                data = json.load(file_obj)
            return data if isinstance(data, list) else []
        except (json.JSONDecodeError, OSError):
            return []

    def _save_manifest(self, entries):
        with open(self.manifest_path, "w", encoding="utf-8") as file_obj:
            json.dump(entries, file_obj, indent=2, ensure_ascii=True)

    def _category_to_dir(self, category):
        category_normalized = str(category or "").strip().lower()
        category_map = {
            "noisy": self.noisy_dir,
            "accented": self.accented_dir,
            "medical": self.medical_dir,
        }
        return category_map.get(category_normalized, self.dataset_dir), category_normalized or "uncategorized"

    def register_sample(self, audio_path, transcription, category, noise_type="clean"):
        source_path = Path(audio_path)
        if not source_path.exists() or not source_path.is_file():
            raise FileNotFoundError(f"Audio file not found: {source_path}")

        sample_id = str(uuid.uuid4())[:8]
        target_dir, normalized_category = self._category_to_dir(category)
        extension = source_path.suffix or ".wav"
        copied_audio_name = f"{sample_id}{extension}"
        copied_audio_path = target_dir / copied_audio_name
        shutil.copy2(source_path, copied_audio_path)

        label_path = self.labels_dir / f"{sample_id}.txt"
        with open(label_path, "w", encoding="utf-8") as label_file:
            label_file.write(str(transcription or "").strip())

        entries = self._load_manifest()
        entry = {
            "id": sample_id,
            "audio_path": str(copied_audio_path),
            "transcription": str(transcription or "").strip(),
            "category": normalized_category,
            "noise_type": str(noise_type or "clean").strip().lower() or "clean",
            "registered_at": datetime.now(timezone.utc).isoformat(),
        }
        entries.append(entry)
        self._save_manifest(entries)
        return sample_id

    def get_samples(self, category=None, noise_type=None):
        entries = self._load_manifest()
        category_filter = str(category).strip().lower() if category is not None else None
        noise_filter = str(noise_type).strip().lower() if noise_type is not None else None

        filtered = []
        for entry in entries:
            if category_filter and str(entry.get("category", "")).lower() != category_filter:
                continue
            if noise_filter and str(entry.get("noise_type", "")).lower() != noise_filter:
                continue
            filtered.append(entry)
        return filtered

    def get_stats(self):
        entries = self._load_manifest()
        by_category = {}
        by_noise_type = {}

        for entry in entries:
            category = str(entry.get("category", "uncategorized")).lower()
            noise = str(entry.get("noise_type", "clean")).lower()
            by_category[category] = by_category.get(category, 0) + 1
            by_noise_type[noise] = by_noise_type.get(noise, 0) + 1

        return {
            "total": len(entries),
            "by_category": by_category,
            "by_noise_type": by_noise_type,
        }
