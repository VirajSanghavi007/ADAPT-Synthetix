import os
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean, Column, Date, DateTime, Float, Integer, String, Text,
    create_engine,
)
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./Backend/data/adapt-synthetix.db")

_connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=_connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def utcnow():
    return datetime.now(timezone.utc)


class ASRLog(Base):
    __tablename__ = "asr_logs"

    id = Column(Integer, primary_key=True)
    user_id = Column(String(36), nullable=True, index=True)
    transcript = Column(Text, nullable=False)
    duration_sec = Column(Float, nullable=True)
    model_id = Column(String(80), nullable=True)
    wpr = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)


class TTSLog(Base):
    __tablename__ = "tts_logs"

    id = Column(Integer, primary_key=True)
    user_id = Column(String(36), nullable=True, index=True)
    input_text = Column(Text, nullable=False)
    voice = Column(String(64), nullable=False)
    model_id = Column(String(80), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)


class PhonemeError(Base):
    __tablename__ = "phoneme_errors"

    id = Column(Integer, primary_key=True)
    transcription_id = Column(Integer, nullable=True, index=True)
    operation = Column(String(16), nullable=False)
    reference_phoneme = Column(String(16), nullable=True)
    hypothesis_phoneme = Column(String(16), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)


class ApiKey(Base):
    __tablename__ = "api_keys"

    id = Column(Integer, primary_key=True)
    user_id = Column(String(36), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    key_prefix = Column(String(12), nullable=False, index=True)
    key_hash = Column(String(64), nullable=False, unique=True)
    tier = Column(String(16), nullable=False, default="free")
    revoked = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    last_used_at = Column(DateTime(timezone=True), nullable=True)


class AccountDeletionRequest(Base):
    __tablename__ = "account_deletion_requests"

    id = Column(Integer, primary_key=True)
    user_id = Column(String(36), nullable=False, index=True)
    token = Column(String(64), nullable=False, unique=True)
    confirmed = Column(Integer, nullable=False, default=0)
    confirmed_at = Column(DateTime(timezone=True), nullable=True)
    executed = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), default=utcnow)


class EvalMetric(Base):
    __tablename__ = "eval_metrics"

    id = Column(Integer, primary_key=True)
    asr_log_id = Column(Integer, nullable=True, index=True)
    model_id = Column(String(80), nullable=False, index=True)
    wer = Column(Float, nullable=False)
    cer = Column(Float, nullable=False)
    her = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)


class ModelRegistry(Base):
    __tablename__ = "model_registry"

    id = Column(Integer, primary_key=True)
    kind = Column(String(8), nullable=False)
    tier = Column(String(16), nullable=False)
    model_id = Column(String(120), nullable=False)
    version_tag = Column(String(40), nullable=False, default="base")
    is_live = Column(Integer, nullable=False, default=1)
    notes = Column(Text, nullable=True)
    promoted_at = Column(DateTime(timezone=True), default=utcnow)


class RequestLatency(Base):
    __tablename__ = "request_latency"

    id = Column(Integer, primary_key=True)
    kind = Column(String(8), nullable=False)
    model_id = Column(String(120), nullable=False, index=True)
    tier = Column(String(16), nullable=False)
    latency_ms = Column(Float, nullable=False)
    success = Column(Integer, nullable=False, default=1)
    cold = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)


class TrainingMarker(Base):
    __tablename__ = "training_marker"

    key = Column(String(64), primary_key=True)
    value_timestamp = Column(DateTime(timezone=True), nullable=False, default=utcnow)


class PriorityQueueEntry(Base):
    __tablename__ = "priority_queue"

    id = Column(Integer, primary_key=True)
    asr_log_id = Column(Integer, nullable=True, index=True)
    priority_score = Column(Float, nullable=False, index=True)
    domain_match_count = Column(Integer, nullable=False, default=0)
    error_type = Column(String(32), nullable=False)
    status = Column(String(16), nullable=False, default="pending")
    created_at = Column(DateTime(timezone=True), default=utcnow)
    human_importance = Column(Integer, nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    reviewed_by = Column(String(36), nullable=True)


class RemedialAudio(Base):
    __tablename__ = "remedial_audio"

    id = Column(Integer, primary_key=True)
    transcription_id = Column(Integer, nullable=True, index=True)
    reference_phoneme = Column(String(16), nullable=True)
    hypothesis_phoneme = Column(String(16), nullable=True)
    carrier_text = Column(Text, nullable=False)
    audio_path = Column(String(255), nullable=False)
    model_id = Column(String(80), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)


class PhonemeDriftEvent(Base):
    __tablename__ = "phoneme_drift_events"

    id = Column(Integer, primary_key=True)
    model_id = Column(String(120), nullable=False, index=True)
    phoneme = Column(String(16), nullable=False, index=True)
    day = Column(Date, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)


class DriftTriggerEvent(Base):
    __tablename__ = "drift_trigger_events"

    id = Column(Integer, primary_key=True)
    model_id = Column(String(120), nullable=False, index=True)
    drifting_phonemes = Column(Text, nullable=False)
    reason = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)


class NoiseFeatureSample(Base):
    __tablename__ = "noise_feature_samples"

    id = Column(Integer, primary_key=True)
    spectral_centroid = Column(Float, nullable=False)
    spectral_bandwidth = Column(Float, nullable=False)
    spectral_rolloff = Column(Float, nullable=False)
    zero_crossing_rate = Column(Float, nullable=False)
    rms_energy = Column(Float, nullable=False)
    mfcc_variance = Column(Float, nullable=False)
    tempo = Column(Float, nullable=False)
    harmonic_ratio = Column(Float, nullable=False)
    heuristic_label = Column(String(16), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)


class ErrorDiagnosisSample(Base):
    __tablename__ = "error_diagnosis_samples"

    id = Column(Integer, primary_key=True)
    confidence = Column(Float, nullable=True)
    cer = Column(Float, nullable=True)
    her = Column(Float, nullable=True)
    wpr = Column(Float, nullable=True)
    noise_category = Column(String(16), nullable=False)
    error_type = Column(String(32), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)


def init_db():
    if DATABASE_URL.startswith("sqlite"):
        os.makedirs("Backend/data", exist_ok=True)
    Base.metadata.create_all(engine)


def get_session() -> Session:
    return SessionLocal()
