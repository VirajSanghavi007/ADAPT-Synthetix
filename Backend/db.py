import os
from datetime import datetime, timezone

from sqlalchemy import (
    Column, DateTime, Float, Integer, String, Text,
    create_engine,
)
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./Backend/data/mercury.db")

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
    created_at = Column(DateTime(timezone=True), default=utcnow)


class TTSLog(Base):
    __tablename__ = "tts_logs"

    id = Column(Integer, primary_key=True)
    user_id = Column(String(36), nullable=True, index=True)
    input_text = Column(Text, nullable=False)
    voice = Column(String(64), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)


def init_db():
    if DATABASE_URL.startswith("sqlite"):
        os.makedirs("Backend/data", exist_ok=True)
    Base.metadata.create_all(engine)


def get_session() -> Session:
    return SessionLocal()
