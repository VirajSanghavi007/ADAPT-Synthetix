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
    """One reference/hypothesis phoneme mismatch from an aligned transcription.
    Populated when /api/transcribe is called with a reference_text; powers the
    Error Analysis dashboard's confusion-matrix view."""
    __tablename__ = "phoneme_errors"

    id = Column(Integer, primary_key=True)
    transcription_id = Column(Integer, nullable=True, index=True)
    operation = Column(String(16), nullable=False)  # substitution | deletion | insertion
    reference_phoneme = Column(String(16), nullable=True)
    hypothesis_phoneme = Column(String(16), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)


class ApiKey(Base):
    """Third-party API keys for the transcribe/TTS API, tiered for rate limiting."""
    __tablename__ = "api_keys"

    id = Column(Integer, primary_key=True)
    user_id = Column(String(36), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    key_prefix = Column(String(12), nullable=False, index=True)  # first chars, shown in UI
    key_hash = Column(String(64), nullable=False, unique=True)  # sha256 hex digest
    tier = Column(String(16), nullable=False, default="free")  # free | pro | max
    revoked = Column(Integer, nullable=False, default=0)  # 0/1 (sqlite-friendly bool)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    last_used_at = Column(DateTime(timezone=True), nullable=True)


class AccountDeletionRequest(Base):
    """Email-verified account deletion. Confirming the emailed link schedules deletion
    24h out (not immediate) — a last window to notice a mistake before it's executed
    and becomes irreversible. See Backend/scripts/execute_pending_deletions.py."""
    __tablename__ = "account_deletion_requests"

    id = Column(Integer, primary_key=True)
    user_id = Column(String(36), nullable=False, index=True)
    token = Column(String(64), nullable=False, unique=True)
    confirmed = Column(Integer, nullable=False, default=0)
    confirmed_at = Column(DateTime(timezone=True), nullable=True)
    executed = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), default=utcnow)


class EvalMetric(Base):
    """WER/CER for one transcription against its reference_text — the basis for the
    per-model accuracy trend in the MLOps dashboard."""
    __tablename__ = "eval_metrics"

    id = Column(Integer, primary_key=True)
    asr_log_id = Column(Integer, nullable=True, index=True)
    model_id = Column(String(80), nullable=False, index=True)
    wer = Column(Float, nullable=False)
    cer = Column(Float, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)


class ModelRegistry(Base):
    """Which checkpoint is 'live' per tier/kind. All entries currently point at base
    HF Hub model ids (no fine-tuned checkpoints exist yet) — this table is the seam
    fine-tuning promotion will write to later."""
    __tablename__ = "model_registry"

    id = Column(Integer, primary_key=True)
    kind = Column(String(8), nullable=False)   # "asr" | "tts"
    tier = Column(String(16), nullable=False)  # "free" | "pro" | "max" | "enterprise"
    model_id = Column(String(120), nullable=False)
    version_tag = Column(String(40), nullable=False, default="base")  # "base" until a fine-tune is promoted
    is_live = Column(Integer, nullable=False, default=1)
    notes = Column(Text, nullable=True)
    promoted_at = Column(DateTime(timezone=True), default=utcnow)


class RequestLatency(Base):
    """Per-request inference latency, per model — the other half of "is this model
    good" alongside WER/CER (eval_metrics). Powers p50/p95 latency trend and lets you
    catch a model silently getting slower (e.g. a Space under memory pressure) even
    when accuracy hasn't moved."""
    __tablename__ = "request_latency"

    id = Column(Integer, primary_key=True)
    kind = Column(String(8), nullable=False)   # "asr" | "tts"
    model_id = Column(String(120), nullable=False, index=True)
    tier = Column(String(16), nullable=False)
    latency_ms = Column(Float, nullable=False)
    success = Column(Integer, nullable=False, default=1)
    cold = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)


class TrainingMarker(Base):
    """Key/value timestamps the n8n retrain-check workflow reads and updates
    (e.g. 'last_trained_at', 'last_notified_at')."""
    __tablename__ = "training_marker"

    key = Column(String(64), primary_key=True)
    value_timestamp = Column(DateTime(timezone=True), nullable=False, default=utcnow)


class PriorityQueueEntry(Base):
    """Domain-critical remediation queue, ported from ADAPT-Synthetix v1's validated
    priority formula. See Backend/priority_queue.py."""
    __tablename__ = "priority_queue"

    id = Column(Integer, primary_key=True)
    asr_log_id = Column(Integer, nullable=True, index=True)
    priority_score = Column(Float, nullable=False, index=True)
    domain_match_count = Column(Integer, nullable=False, default=0)
    error_type = Column(String(32), nullable=False)
    status = Column(String(16), nullable=False, default="pending")  # pending | in_progress | resolved
    created_at = Column(DateTime(timezone=True), default=utcnow)


class RemedialAudio(Base):
    """Phoneme-pair targeted corrective TTS output, ported from ADAPT-Synthetix v1's
    closed-loop remediation design. See Backend/tts_remediation.py."""
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
    """One misrecognition event for one phoneme on one day — the raw signal
    drift_detector.py aggregates into a rolling per-phoneme trend. See TODO.md P4.2
    for why this tracks error-rate rather than true per-phoneme confidence."""
    __tablename__ = "phoneme_drift_events"

    id = Column(Integer, primary_key=True)
    model_id = Column(String(120), nullable=False, index=True)
    phoneme = Column(String(16), nullable=False, index=True)
    day = Column(Date, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)


class DriftTriggerEvent(Base):
    """A recorded 'this model should be retrained' signal from drift_detector.py.
    Does not itself trigger a LoRA run — see that module's docstring."""
    __tablename__ = "drift_trigger_events"

    id = Column(Integer, primary_key=True)
    model_id = Column(String(120), nullable=False, index=True)
    drifting_phonemes = Column(Text, nullable=False)  # comma-separated phoneme codes
    reason = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)


def init_db():
    if DATABASE_URL.startswith("sqlite"):
        os.makedirs("Backend/data", exist_ok=True)
    Base.metadata.create_all(engine)


def get_session() -> Session:
    return SessionLocal()
