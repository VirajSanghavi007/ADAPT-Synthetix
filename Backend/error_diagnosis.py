from __future__ import annotations

import os
import pickle

import numpy as np

from Backend.db import ErrorDiagnosisSample, get_session

ERROR_TYPES = ("clean", "noise-induced", "accent-related", "pronunciation-based", "hallucinated", "language-violation")
NOISE_CATEGORIES = ("clean", "traffic", "crowd", "machinery", "indoor")

MODEL_PATH = "Backend/data/models/error_classifier.pkl"
MIN_SAMPLES_TO_FIT = 30

HER_THRESHOLD = 0.3
WPR_THRESHOLD = 0.5


def classify_rule_based(
    confidence: float | None,
    cer: float | None,
    noise_category: str,
    her: float | None = None,
    wpr: float | None = None,
) -> str:
    if wpr is not None and wpr >= WPR_THRESHOLD:
        return "language-violation"
    if her is not None and her >= HER_THRESHOLD:
        return "hallucinated"
    if confidence is None:
        return "noise-induced" if noise_category != "clean" else "clean"
    if confidence > 0.85 and (cer is None or cer < 0.05):
        return "clean"
    if noise_category != "clean" and confidence < 0.6:
        return "noise-induced"
    if 0.55 <= confidence <= 0.80 and noise_category == "clean":
        return "accent-related"
    return "pronunciation-based"


def _feature_vector(
    confidence: float | None, cer: float | None, noise_category: str, her: float | None, wpr: float | None
) -> list[float]:
    conf = confidence if confidence is not None else 0.5
    cer_val = cer if cer is not None else -1.0
    her_val = her if her is not None else -1.0
    wpr_val = wpr if wpr is not None else -1.0
    noise_onehot = [1.0 if noise_category == cat else 0.0 for cat in NOISE_CATEGORIES]
    return [conf, cer_val, her_val, wpr_val, *noise_onehot]


def persist_sample(
    confidence: float | None,
    cer: float | None,
    noise_category: str,
    error_type: str,
    her: float | None = None,
    wpr: float | None = None,
) -> None:
    db = get_session()
    try:
        db.add(
            ErrorDiagnosisSample(
                confidence=confidence, cer=cer, her=her, wpr=wpr,
                noise_category=noise_category, error_type=error_type,
            )
        )
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


def fit_classifier(min_samples: int = MIN_SAMPLES_TO_FIT) -> dict:
    from sklearn.linear_model import LogisticRegression
    from sklearn.preprocessing import StandardScaler

    db = get_session()
    try:
        rows = db.query(ErrorDiagnosisSample).all()
    finally:
        db.close()

    if len(rows) < min_samples:
        return {"fit": False, "reason": f"only {len(rows)} samples, need {min_samples}"}

    X = np.array([_feature_vector(r.confidence, r.cer, r.noise_category, r.her, r.wpr) for r in rows])
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


def classify_learned(
    confidence: float | None, cer: float | None, noise_category: str, her: float | None, wpr: float | None
) -> str | None:
    if not os.path.exists(MODEL_PATH):
        return None
    try:
        with open(MODEL_PATH, "rb") as f:
            saved = pickle.load(f)
        X = np.array([_feature_vector(confidence, cer, noise_category, her, wpr)])
        X_scaled = saved["scaler"].transform(X)
        return str(saved["model"].predict(X_scaled)[0])
    except Exception:
        return None


def classify(
    confidence: float | None,
    cer: float | None,
    noise_category: str,
    her: float | None = None,
    wpr: float | None = None,
) -> str:
    rule_label = classify_rule_based(confidence, cer, noise_category, her, wpr)
    persist_sample(confidence, cer, noise_category, rule_label, her, wpr)

    learned_label = classify_learned(confidence, cer, noise_category, her, wpr)
    return learned_label if learned_label is not None else rule_label
