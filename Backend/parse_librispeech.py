"""
parse_librispeech.py — Parse a LibriSpeech directory and register all samples.

Walks the LibriSpeech test-clean structure:
    <root>/<speaker_id>/<chapter_id>/<speaker>-<chapter>-<utterance>.flac
    <root>/<speaker_id>/<chapter_id>/<speaker>-<chapter>.trans.txt

Usage:
    python Backend/parse_librispeech.py --librispeech "C:/Users/viraj/Downloads/test-clean/LibriSpeech/test-clean"
    python Backend/parse_librispeech.py --librispeech "..." --limit 200
    python Backend/parse_librispeech.py --librispeech "..." --csv-only output.csv
"""

import argparse
import csv
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from config import ROOT_DIR
from dataset_manager import DatasetManager


def parse_transcripts(librispeech_root: Path) -> list[dict]:
    """Walk the LibriSpeech tree and return list of {audio_path, transcript}."""
    entries = []
    for trans_file in sorted(librispeech_root.rglob("*.trans.txt")):
        chapter_dir = trans_file.parent
        for line in trans_file.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            parts = line.split(" ", 1)
            if len(parts) != 2:
                continue
            utterance_id, transcript = parts
            flac_path = chapter_dir / f"{utterance_id}.flac"
            if flac_path.exists():
                entries.append({"audio_path": str(flac_path), "transcript": transcript.strip()})
    return entries


def main():
    parser = argparse.ArgumentParser(description="Register LibriSpeech samples into ADAPT-Synthetix dataset.")
    parser.add_argument("--librispeech", required=True, help="Path to the LibriSpeech test-clean root folder")
    parser.add_argument("--limit", type=int, default=None, help="Max number of samples to register (default: all)")
    parser.add_argument("--csv-only", default=None, metavar="OUTPUT.CSV",
                        help="Write a CSV instead of registering — useful for inspection")
    args = parser.parse_args()

    root = Path(args.librispeech)
    if not root.exists():
        print(f"ERROR: Path not found: {root}", file=sys.stderr)
        sys.exit(1)

    print(f"Scanning {root} ...")
    entries = parse_transcripts(root)
    if not entries:
        print("No .flac / .trans.txt pairs found. Check the path.", file=sys.stderr)
        sys.exit(1)

    if args.limit:
        entries = entries[:args.limit]

    print(f"Found {len(entries)} samples.")

    # --- CSV-only mode ---
    if args.csv_only:
        out = Path(args.csv_only)
        with open(out, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=["audio_path", "transcript", "category", "noise_type"])
            writer.writeheader()
            for e in entries:
                writer.writerow({**e, "category": "clean", "noise_type": "clean"})
        print(f"CSV written to {out} — review then run: python Backend/batch_register.py --csv {out}")
        return

    # --- Direct registration ---
    dm = DatasetManager(dataset_dir=str(ROOT_DIR / "Dataset"))
    registered = 0
    skipped = 0
    for e in entries:
        try:
            sample_id = dm.register_sample(
                audio_path=e["audio_path"],
                transcription=e["transcript"],
                category="clean",
                noise_type="clean",
            )
            print(f"  [{registered + 1}/{len(entries)}] {sample_id} — {e['transcript'][:60]}")
            registered += 1
        except Exception as exc:
            print(f"  SKIP {e['audio_path']}: {exc}")
            skipped += 1

    print(f"\nDone. {registered} registered, {skipped} skipped.")


if __name__ == "__main__":
    main()
