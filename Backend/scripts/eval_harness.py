"""Eval harness: compare a candidate model against the currently-live one on a held-out
set, before promoting via POST /api/mlops/registry/promote.

Usage:
    python -m Backend.scripts.eval_harness --kind asr --tier pro \\
        --candidate openai/whisper-large-v3-turbo-medical-lora \\
        --eval-set eval_sets/medical_holdout.json

eval_sets/*.json format: [{"audio_path": "...", "reference": "..."}, ...]
"""
import argparse
import json

from jiwer import cer as compute_cer
from jiwer import wer as compute_wer

from Backend.asr_pipeline import decode_audio, transcribe_audio
from Backend.db import ModelRegistry, get_session
from Backend.tiers import ASR_CATALOG


def get_live_model(kind: str, tier: str) -> str:
    db = get_session()
    try:
        row = (
            db.query(ModelRegistry)
            .filter(ModelRegistry.kind == kind, ModelRegistry.tier == tier, ModelRegistry.is_live == 1)
            .first()
        )
        if row is None:
            raise SystemExit(f"no live model registered for {kind}/{tier}")
        return row.model_id
    finally:
        db.close()


def run_eval(model_id: str, eval_set: list[dict], engine: str) -> dict:
    refs, hyps = [], []
    for item in eval_set:
        with open(item["audio_path"], "rb") as f:
            audio, sr = decode_audio(f.read())
        hyps.append(transcribe_audio(audio, sr, model_id, engine=engine))
        refs.append(item["reference"])
    return {
        "model_id": model_id,
        "wer": compute_wer(refs, hyps) if refs else None,
        "cer": compute_cer(refs, hyps) if refs else None,
        "n": len(refs),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--kind", required=True, choices=["asr", "tts"])
    parser.add_argument("--tier", required=True, choices=["free", "pro", "max", "enterprise"])
    parser.add_argument("--candidate", required=True, help="model_id of the fine-tuned candidate")
    parser.add_argument("--eval-set", required=True, help="path to a JSON eval-set file")
    args = parser.parse_args()

    if args.kind == "tts":
        raise SystemExit("TTS eval (MOS/similarity scoring) isn't wired up yet — ASR only for now")

    with open(args.eval_set) as f:
        eval_set = json.load(f)

    live_model = get_live_model(args.kind, args.tier)
    if live_model not in ASR_CATALOG:
        raise SystemExit(f"live model {live_model} isn't in the ASR catalog — can't infer its engine")
    engine = ASR_CATALOG[live_model]["engine"]

    print(f"Live model: {live_model} (engine: {engine})")
    baseline = run_eval(live_model, eval_set, engine)
    print(f"Baseline  — WER: {baseline['wer']:.4f}  CER: {baseline['cer']:.4f}  (n={baseline['n']})")

    print(f"Candidate: {args.candidate} (assumed same engine: {engine})")
    candidate = run_eval(args.candidate, eval_set, engine)
    print(f"Candidate — WER: {candidate['wer']:.4f}  CER: {candidate['cer']:.4f}  (n={candidate['n']})")

    if candidate["wer"] < baseline["wer"]:
        print(f"\nCandidate beats baseline ({candidate['wer']:.4f} < {baseline['wer']:.4f}) — safe to promote:")
        print(
            f"  POST /api/mlops/registry/promote "
            f'{{"kind": "{args.kind}", "tier": "{args.tier}", "model_id": "{args.candidate}", "version_tag": "..."}}'
        )
    else:
        print(f"\nCandidate does NOT beat baseline ({candidate['wer']:.4f} >= {baseline['wer']:.4f}) — do not promote.")


if __name__ == "__main__":
    main()
