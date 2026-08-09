import sys

import numpy as np
import pyarrow.parquet as pq

from Backend.asr_pipeline import transcribe_audio_with_confidence
from Backend.error_diagnosis import classify as classify_error_type
from Backend.noise_fingerprint import fingerprint as noise_fingerprint

MODEL_ID = "distil-whisper/distil-large-v3"


def main(parquet_path: str, n: int):
    pf = pq.ParquetFile(parquet_path)
    processed = 0
    results = []

    for batch in pf.iter_batches(batch_size=50, columns=["audio", "duration", "speaker_id"]):
        table = batch.to_pydict()
        for i in range(len(table["duration"])):
            if processed >= n:
                break
            duration = table["duration"][i]
            if duration is None or duration > 15:
                continue

            audio_struct = table["audio"][i]
            array = np.array(audio_struct["array"], dtype=np.float32)
            sr = int(audio_struct["sampling_rate"])
            speaker = table["speaker_id"][i]

            try:
                text, confidence = transcribe_audio_with_confidence(array, sr, MODEL_ID)
                fp = noise_fingerprint(array, sr)
                error_type = classify_error_type(confidence, None, fp["noise_category"])

                processed += 1
                results.append(
                    {
                        "speaker": speaker,
                        "duration": round(duration, 2),
                        "text": text[:60],
                        "confidence": round(confidence, 3) if confidence is not None else None,
                        "noise_category": fp["noise_category"],
                        "noise_source": fp["source"],
                        "error_type": error_type,
                    }
                )
                print(f"[{processed}/{n}] spk={speaker} dur={duration:.1f}s conf={confidence} "
                      f"noise={fp['noise_category']} err={error_type} text={text[:50]!r}")
            except Exception as exc:
                print(f"  skip (error: {exc})")
        if processed >= n:
            break

    print(f"\nProcessed {processed} real VoxAging clips through the pipeline.")
    return results


if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else "/tmp/voxaging.parquet"
    count = int(sys.argv[2]) if len(sys.argv) > 2 else 35
    main(path, count)
