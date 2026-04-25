import argparse
from pathlib import Path

from jiwer import cer

from Backend.asr_module import transcribe_audio
from Backend.dataset_manager import DatasetManager


def _fit(text, width):
    value = str(text or "")
    if len(value) <= width:
        return value.ljust(width)
    if width <= 3:
        return value[:width]
    return (value[: width - 3] + "...").ljust(width)


def _print_report(rows, dataset_arg, category_label):
    line = "╠════════════════════════════════════════════════════════════════╣"
    print("╔════════════════════════════════════════════════════════════════╗")
    print("║              ADAPT-Synthetix Benchmark Report                  ║")
    print(line)
    print("║ Model    : facebook/wav2vec2-base-960h                         ║")
    print(f"║ Dataset  : {_fit(dataset_arg, 52)}║")
    print(f"║ Samples  : {_fit(str(len(rows)), 52)}║")
    print(f"║ Category : {_fit(category_label, 52)}║")
    print(line)
    print("║ Sample ID │ Category │ Noise  │ CER    │ Transcription (40c)  ║")
    print(line)

    for row in rows:
        print(
            "║ "
            + _fit(row["id"], 8)
            + " │ "
            + _fit(row["category"], 8)
            + " │ "
            + _fit(row["noise_type"], 6)
            + " │ "
            + _fit(f"{row['cer']:.4f}", 6)
            + " │ "
            + _fit(row["prediction"], 19)
            + " ║"
        )

    avg_cer = sum(r["cer"] for r in rows) / len(rows)
    best_cer = min(r["cer"] for r in rows)
    worst_cer = max(r["cer"] for r in rows)
    print(line)
    print(f"║ AVERAGE CER : {_fit(f'{avg_cer:.4f}', 46)}║")
    print(f"║ BEST CER    : {_fit(f'{best_cer:.4f}', 46)}║")
    print(f"║ WORST CER   : {_fit(f'{worst_cer:.4f}', 46)}║")
    print("╚════════════════════════════════════════════════════════════════╝")


def main():
    parser = argparse.ArgumentParser(description="Run ADAPT-Synthetix benchmarking on registered dataset samples.")
    parser.add_argument("--dataset", default="Dataset", help="Dataset directory path (default: Dataset)")
    parser.add_argument("--category", default=None, help="Optional category filter (e.g., noisy)")
    args = parser.parse_args()

    dataset_dir = Path(args.dataset)
    manager = DatasetManager(dataset_dir=str(dataset_dir))
    samples = manager.get_samples(category=args.category)
    labelled_samples = [s for s in samples if str(s.get("transcription", "")).strip()]

    if not labelled_samples:
        print("No labelled samples found. Use dataset_manager.register_sample() to add samples with ground truth.")
        raise SystemExit(0)

    report_rows = []
    for sample in labelled_samples:
        audio_path = Path(str(sample.get("audio_path", "")))
        if not audio_path.exists() or not audio_path.is_file():
            continue

        reference = str(sample.get("transcription", "")).strip()
        if not reference:
            continue

        prediction, _duration = transcribe_audio(str(audio_path))
        score = float(cer(reference, prediction))
        report_rows.append(
            {
                "id": str(sample.get("id", "unknown")),
                "category": str(sample.get("category", "unknown")),
                "noise_type": str(sample.get("noise_type", "clean")),
                "cer": score,
                "prediction": prediction.strip(),
            }
        )

    if not report_rows:
        print("No labelled samples found. Use dataset_manager.register_sample() to add samples with ground truth.")
        raise SystemExit(0)

    category_label = args.category if args.category else "all"
    _print_report(report_rows, str(dataset_dir), category_label)


if __name__ == "__main__":
    main()
