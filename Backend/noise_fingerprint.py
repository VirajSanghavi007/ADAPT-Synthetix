from __future__ import annotations

import os
import pickle

import numpy as np

from Backend.db import NoiseFeatureSample, get_session

NOISE_CATEGORIES = ("clean", "traffic", "crowd", "machinery", "indoor")

MODEL_PATH = "Backend/data/models/noise_clusters.pkl"
MIN_SAMPLES_TO_FIT = 30
DEFAULT_K = 5

_FEATURE_ORDER = (
    "spectral_centroid", "spectral_bandwidth", "spectral_rolloff", "zero_crossing_rate",
    "rms_energy", "mfcc_variance", "tempo", "harmonic_ratio",
)


def extract_features(audio: np.ndarray, sr: int) -> dict[str, float]:
    import librosa

    if audio.size == 0:
        return {k: 0.0 for k in _FEATURE_ORDER}

    y = audio.astype(np.float32)

    centroid = float(np.mean(librosa.feature.spectral_centroid(y=y, sr=sr)))
    bandwidth = float(np.mean(librosa.feature.spectral_bandwidth(y=y, sr=sr)))
    rolloff = float(np.mean(librosa.feature.spectral_rolloff(y=y, sr=sr, roll_percent=0.85)))
    zcr = float(np.mean(librosa.feature.zero_crossing_rate(y=y)))
    rms = float(np.mean(librosa.feature.rms(y=y)))
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
    mfcc_variance = float(np.mean(np.var(mfcc, axis=1)))

    try:
        tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
        tempo = float(tempo if np.isscalar(tempo) else tempo[0])
    except Exception:
        tempo = 0.0

    try:
        harmonic, _percussive = librosa.effects.hpss(y)
        harmonic_energy = float(np.sum(harmonic ** 2))
        total_energy = float(np.sum(y ** 2)) or 1.0
        harmonic_ratio = harmonic_energy / total_energy
    except Exception:
        harmonic_ratio = 0.0

    return {
        "spectral_centroid": centroid,
        "spectral_bandwidth": bandwidth,
        "spectral_rolloff": rolloff,
        "zero_crossing_rate": zcr,
        "rms_energy": rms,
        "mfcc_variance": mfcc_variance,
        "tempo": tempo,
        "harmonic_ratio": harmonic_ratio,
    }


def classify(features: dict[str, float]) -> str:
    zcr = features["zero_crossing_rate"]
    rms = features["rms_energy"]
    bandwidth = features["spectral_bandwidth"]
    harmonic_ratio = features["harmonic_ratio"]
    mfcc_var = features["mfcc_variance"]

    if rms < 0.01:
        return "clean"
    if harmonic_ratio < 0.35 and bandwidth > 2000:
        return "machinery"
    if zcr > 0.15 and mfcc_var > 80:
        return "crowd"
    if bandwidth > 1500 and rms > 0.05 and harmonic_ratio >= 0.35:
        return "traffic"
    if 0.3 <= harmonic_ratio < 0.6 and bandwidth < 1500:
        return "indoor"
    return "clean"


def _feature_vector(features: dict[str, float]) -> list[float]:
    return [features[k] for k in _FEATURE_ORDER]


def persist_sample(features: dict[str, float], heuristic_label: str) -> None:
    db = get_session()
    try:
        row = NoiseFeatureSample(
            spectral_centroid=features["spectral_centroid"],
            spectral_bandwidth=features["spectral_bandwidth"],
            spectral_rolloff=features["spectral_rolloff"],
            zero_crossing_rate=features["zero_crossing_rate"],
            rms_energy=features["rms_energy"],
            mfcc_variance=features["mfcc_variance"],
            tempo=features["tempo"],
            harmonic_ratio=features["harmonic_ratio"],
            heuristic_label=heuristic_label,
        )
        db.add(row)
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


def fit_clusters(k: int = DEFAULT_K, min_samples: int = MIN_SAMPLES_TO_FIT) -> dict:
    from sklearn.cluster import KMeans
    from sklearn.preprocessing import StandardScaler

    db = get_session()
    try:
        rows = db.query(NoiseFeatureSample).all()
    finally:
        db.close()

    if len(rows) < min_samples:
        return {"fit": False, "reason": f"only {len(rows)} samples, need {min_samples}"}

    X = np.array([[getattr(r, f) for f in _FEATURE_ORDER] for r in rows])
    heuristic_labels = [r.heuristic_label for r in rows]

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    k = min(k, len(rows))
    kmeans = KMeans(n_clusters=k, n_init=10, random_state=42)
    cluster_ids = kmeans.fit_predict(X_scaled)

    cluster_labels: dict[int, str] = {}
    for cluster_id in range(k):
        members = [heuristic_labels[i] for i in range(len(rows)) if cluster_ids[i] == cluster_id]
        if members:
            cluster_labels[cluster_id] = max(set(members), key=members.count)
        else:
            cluster_labels[cluster_id] = "clean"

    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    with open(MODEL_PATH, "wb") as f:
        pickle.dump({"scaler": scaler, "kmeans": kmeans, "cluster_labels": cluster_labels}, f)

    return {"fit": True, "n_samples": len(rows), "k": k, "cluster_labels": cluster_labels}


def classify_learned(features: dict[str, float]) -> str | None:
    if not os.path.exists(MODEL_PATH):
        return None
    try:
        with open(MODEL_PATH, "rb") as f:
            model = pickle.load(f)
        X = np.array([_feature_vector(features)])
        X_scaled = model["scaler"].transform(X)
        cluster_id = int(model["kmeans"].predict(X_scaled)[0])
        return model["cluster_labels"].get(cluster_id, "clean")
    except Exception:
        return None


def fingerprint(audio: np.ndarray, sr: int) -> dict:
    features = extract_features(audio, sr)
    heuristic_label = classify(features)
    persist_sample(features, heuristic_label)

    learned_label = classify_learned(features)
    category = learned_label if learned_label is not None else heuristic_label
    return {
        "noise_category": category,
        "features": features,
        "source": "learned" if learned_label is not None else "heuristic",
    }
