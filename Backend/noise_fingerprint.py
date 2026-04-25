import numpy as np
import librosa


class NoiseFingerprinter:
    CLEAN_RMS_THRESHOLD = 0.01
    TRAFFIC_CENTROID_THRESHOLD = 3000
    TRAFFIC_ZCR_THRESHOLD = 0.1
    CROWD_RMS_THRESHOLD = 0.05
    CROWD_MFCC_VAR_THRESHOLD = 50
    MACHINERY_ZCR_THRESHOLD = 0.15

    def __init__(self):
        self._spectral_centroid = librosa.feature.spectral_centroid
        self._spectral_bandwidth = librosa.feature.spectral_bandwidth
        self._spectral_rolloff = librosa.feature.spectral_rolloff
        self._zero_crossing_rate = librosa.feature.zero_crossing_rate
        self._rms = librosa.feature.rms
        self._mfcc = librosa.feature.mfcc
        self._beat_track = librosa.beat.beat_track
        self._harmonic = librosa.effects.harmonic

    def extract_features(self, audio_array, sr=16000) -> dict:
        y = np.asarray(audio_array, dtype=np.float32)
        if y.size == 0:
            y = np.zeros(1, dtype=np.float32)

        spectral_centroid = float(np.mean(self._spectral_centroid(y=y, sr=sr)))
        spectral_bandwidth = float(np.mean(self._spectral_bandwidth(y=y, sr=sr)))
        spectral_rolloff = float(np.mean(self._spectral_rolloff(y=y, sr=sr)))
        zero_crossing_rate = float(np.mean(self._zero_crossing_rate(y=y)))
        rms_energy = float(np.mean(self._rms(y=y)))
        mfcc = self._mfcc(y=y, sr=sr, n_mfcc=13)
        mfcc_variance = float(np.mean(np.var(mfcc, axis=1)))
        tempo, _ = self._beat_track(y=y, sr=sr)
        harmonic_audio = self._harmonic(y=y)
        harmonic_ratio = float(np.mean(harmonic_audio))

        return {
            "spectral_centroid": spectral_centroid,
            "spectral_bandwidth": spectral_bandwidth,
            "spectral_rolloff": spectral_rolloff,
            "zero_crossing_rate": zero_crossing_rate,
            "rms_energy": rms_energy,
            "mfcc_variance": mfcc_variance,
            "tempo": float(np.atleast_1d(tempo)[0]),
            "harmonic_ratio": harmonic_ratio,
        }

    def classify(self, features) -> str:
        rms_energy = float(features.get("rms_energy", 0.0))
        spectral_centroid = float(features.get("spectral_centroid", 0.0))
        spectral_rolloff = float(features.get("spectral_rolloff", 0.0))
        zero_crossing_rate = float(features.get("zero_crossing_rate", 0.0))
        mfcc_variance = float(features.get("mfcc_variance", 0.0))
        spectral_bandwidth = float(features.get("spectral_bandwidth", 0.0))
        tempo = float(features.get("tempo", 0.0))
        harmonic_ratio = float(features.get("harmonic_ratio", 0.0))

        if rms_energy < self.CLEAN_RMS_THRESHOLD:
            return "clean"
        if (
            spectral_centroid > self.TRAFFIC_CENTROID_THRESHOLD
            and zero_crossing_rate > self.TRAFFIC_ZCR_THRESHOLD
            and spectral_rolloff >= 0.0
            and tempo == tempo
        ):
            return "traffic"
        if rms_energy > self.CROWD_RMS_THRESHOLD and mfcc_variance > self.CROWD_MFCC_VAR_THRESHOLD:
            return "crowd"
        if (
            zero_crossing_rate > self.MACHINERY_ZCR_THRESHOLD
            and spectral_bandwidth > 2000
            and harmonic_ratio == harmonic_ratio
            and tempo == tempo
        ):
            return "machinery"
        return "indoor"

    def fingerprint(self, audio_array, sr=16000) -> dict:
        features = self.extract_features(audio_array, sr=sr)
        noise_type = self.classify(features)
        return {"noise_type": noise_type, **features}

    def compare(self, fp1, fp2) -> dict:
        feature_keys = [
            "spectral_centroid",
            "spectral_bandwidth",
            "spectral_rolloff",
            "zero_crossing_rate",
            "rms_energy",
            "mfcc_variance",
            "tempo",
            "harmonic_ratio",
        ]
        relative_diffs = {}
        for key in feature_keys:
            v1 = float(fp1.get(key, 0.0))
            v2 = float(fp2.get(key, 0.0))
            denom = abs(v1) + abs(v2) + 1e-9
            relative_diffs[key] = abs(v1 - v2) / denom

        mean_diff = float(np.mean(list(relative_diffs.values()))) if relative_diffs else 1.0
        similarity = max(0.0, min(1.0, 1.0 - mean_diff))
        dominant_difference = max(relative_diffs, key=relative_diffs.get) if relative_diffs else "none"
        return {"similarity": similarity, "dominant_difference": dominant_difference}
