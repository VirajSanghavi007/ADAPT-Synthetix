"""Error-type classification — free tier only.

Two paths, same bootstrap pattern as noise_fingerprint.py:
  - classify_rule_based() — the original v1-ported thresholds. Kept permanently as
    the cold-start fallback and as the pseudo-label source for training data before
    any real reference-checked examples exist.
  - classify_learned() — an ElasticNet-regularised multinomial logistic regression
    (sklearn, penalty="elasticnet", solver="saga") trained on accumulated
    (confidence, cer, noise_category) -> error_type samples. ElasticNet specifically
    (not plain L2) because it can zero out a genuinely uninformative feature entirely
    rather than just shrinking it — useful here since cer is often missing (None on
    most requests, since it needs a reference_text) and the model should be able to
    learn to mostly ignore it rather than being forced to weight a mostly-absent
    feature.

Every classify() call persists its inputs and (rule-based, until a learned model
exists) label as training data — this is a self-training bootstrap, not a static
rename of the old function.
"""
from __future__ import annotations

import os
import pickle

import numpy as np

from Backend.db import ErrorDiagnosisSample, get_session

ERROR_TYPES = ("clean", "noise-induced", "accent-related", "pronunciation-based")
NOISE_CATEGORIES = ("clean", "traffic", "crowd", "machinery", "indoor")

MODEL_PATH = "Backend/data/models/error_classifier.pkl"
MIN_SAMPLES_TO_FIT = 30


def classify_rule_based(confidence: float | None, cer: float | None, noise_category: str) -> str:
    """v1's thresholds, unchanged. See module docstring for why this stays."""
    if confidence is None:
        return "noise-induced" if noise_category != "clean" else "clean"
    if confidence > 0.85 and (cer is None or cer < 0.05):
        return "clean"
    if noise_category != "clean" and confidence < 0.6:
        return "noise-induced"
    if 0.55 <= confidence <= 0.80 and noise_category == "clean":
        return "accent-related"
    return "pronunciation-based"


def _feature_vector(confidence: float | None, cer: float | None, noise_category: str) -> list[float]:
    conf = confidence if confidence is not None else 0.5
    cer_val = cer if cer is not None else -1.0  # sentinel: "no reference available", distinct from a real 0.0
    noise_onehot = [1.0 if noise_category == cat else 0.0 for cat in NOISE_CATEGORIES]
    return [conf, cer_val, *noise_onehot]


def persist_sample(confidence: float | None, cer: float | None, noise_category: str, error_type: str) -> None:
    db = get_session()
    try:
        db.add(
            ErrorDiagnosisSample(
                confidence=confidence, cer=cer, noise_category=noise_category, error_type=error_type
            )
        )
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


def fit_classifier(min_samples: int = MIN_SAMPLES_TO_FIT) -> dict:
    """Fit the ElasticNet classifier on accumulated samples. Called periodically
    (admin-triggered, see mlops.py), not per-request."""
    from sklearn.linear_model import LogisticRegression
    from sklearn.preprocessing import StandardScaler

    db = get_session()
    try:
        rows = db.query(ErrorDiagnosisSample).all()
    finally:
        db.close()

    if len(rows) < min_samples:
        return {"fit": False, "reason": f"only {len(rows)} samples, need {min_samples}"}

    X = np.array([_feature_vector(r.confidence, r.cer, r.noise_category) for r in rows])
    y = [r.error_type for r in rows]

    if len(set(y)) < 2:
        return {"fit": False, "reason": "need at least 2 distinct error_type labels to train a classifier"}

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    model = LogisticRegression(
        penalty="elasticnet", l1_ratio=0.5, solver="saga", max_iter=2000, multi_class="auto"
    )
    model.fit(X_scaled, y)

    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    with open(MODEL_PATH, "wb") as f:
        pickle.dump({"scaler": scaler, "model": model}, f)

    return {"fit": True, "n_samples": len(rows), "classes": list(model.classes_)}


def classify_learned(confidence: float | None, cer: float | None, noise_category: str) -> str | None:
    if not os.path.exists(MODEL_PATH):
        return None
    try:
        with open(MODEL_PATH, "rb") as f:
            saved = pickle.load(f)
        X = np.array([_feature_vector(confidence, cer, noise_category)])
        X_scaled = saved["scaler"].transform(X)
        return str(saved["model"].predict(X_scaled)[0])
    except Exception:
        return None


def classify(confidence: float | None, cer: float | None, noise_category: str) -> str:
    """Entry point callers should use. Always computes the rule-based label (used as
    the pseudo-label for training data regardless of which path is returned), then
    prefers the learned model once one exists."""
    rule_label = classify_rule_based(confidence, cer, noise_category)
    persist_sample(confidence, cer, noise_category, rule_label)

    learned_label = classify_learned(confidence, cer, noise_category)
    return learned_label if learned_label is not None else rule_label
