from __future__ import annotations

import uuid
from collections.abc import Iterator
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    create_engine,
    event,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, relationship, sessionmaker

from .config import get_settings


def new_id() -> str:
    return str(uuid.uuid4())


def utcnow() -> datetime:
    return datetime.now(UTC)


class Base(DeclarativeBase):
    type_annotation_map = {dict[str, Any]: JSON, list[Any]: JSON, datetime: DateTime(timezone=True)}


# ---------------------------------------------------------------- users & billing


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    auth_provider: Mapped[str] = mapped_column(String(20))
    auth_subject: Mapped[str] = mapped_column(String(255), index=True)
    email: Mapped[str | None] = mapped_column(String(320), unique=True)
    display_name: Mapped[str | None] = mapped_column(String(120))
    plan_id: Mapped[str] = mapped_column(String(40), ForeignKey("plans.id"), default="free")
    status: Mapped[str] = mapped_column(String(20), default="active")
    created_at: Mapped[datetime] = mapped_column(default=utcnow)

    settings: Mapped[UserSettings] = relationship(back_populates="user", uselist=False, cascade="all")
    plan: Mapped[Plan] = relationship()


class UserSettings(Base):
    __tablename__ = "user_settings"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    language: Mapped[str] = mapped_column(String(10), default="en")
    theme: Mapped[str] = mapped_column(String(10), default="dark")
    quality_lane: Mapped[str] = mapped_column(String(10), default="balanced")
    default_image_format: Mapped[str] = mapped_column(String(8), default="jpg")
    default_video_format: Mapped[str] = mapped_column(String(8), default="mp4")
    default_resolution: Mapped[str] = mapped_column(String(10), default="original")
    naming_pattern: Mapped[str] = mapped_column(String(120), default="{original}_{recipe}")
    strip_metadata: Mapped[bool] = mapped_column(Boolean, default=True)
    auto_delete_days: Mapped[int] = mapped_column(Integer, default=30)
    notify_job_complete: Mapped[bool] = mapped_column(Boolean, default=True)
    updated_at: Mapped[datetime] = mapped_column(default=utcnow, onupdate=utcnow)

    user: Mapped[User] = relationship(back_populates="settings")


class Plan(Base):
    __tablename__ = "plans"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    name: Mapped[str] = mapped_column(String(60))
    monthly_credits: Mapped[int] = mapped_column(Integer)
    max_batch_files: Mapped[int] = mapped_column(Integer)
    max_video_seconds: Mapped[int] = mapped_column(Integer)
    max_upload_mb: Mapped[int] = mapped_column(Integer)
    max_output_res: Mapped[str] = mapped_column(String(10))
    max_upscale: Mapped[int] = mapped_column(Integer)
    priority: Mapped[int] = mapped_column(Integer)
    batch_in_flight: Mapped[int] = mapped_column(Integer)
    watermark: Mapped[bool] = mapped_column(Boolean)


class CreditLedger(Base):
    __tablename__ = "credit_ledger"
    id: Mapped[int] = mapped_column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    delta: Mapped[int] = mapped_column(Integer)
    kind: Mapped[str] = mapped_column(String(20))  # grant|reserve|release|spend|refund|purchase
    job_id: Mapped[str | None] = mapped_column(String(36))
    batch_id: Mapped[str | None] = mapped_column(String(36))
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)


# ---------------------------------------------------------------- files & projects


class File(Base):
    __tablename__ = "files"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(8))  # image|video|gif
    original_name: Mapped[str] = mapped_column(String(255))
    mime_type: Mapped[str] = mapped_column(String(80))
    size_bytes: Mapped[int] = mapped_column(BigInteger)
    storage_key: Mapped[str] = mapped_column(String(512))
    thumb_key: Mapped[str | None] = mapped_column(String(512))
    width: Mapped[int | None] = mapped_column(Integer)
    height: Mapped[int | None] = mapped_column(Integer)
    duration_ms: Mapped[int | None] = mapped_column(Integer)
    fps: Mapped[float | None] = mapped_column(Float)
    frame_count: Mapped[int | None] = mapped_column(Integer)
    has_audio: Mapped[bool | None] = mapped_column(Boolean)
    sha256: Mapped[str] = mapped_column(String(64))
    analysis: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    safety_status: Mapped[str] = mapped_column(String(10), default="clear")
    status: Mapped[str] = mapped_column(String(12), default="ready")
    created_at: Mapped[datetime] = mapped_column(default=utcnow)


class Project(Base):
    __tablename__ = "projects"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    mode: Mapped[str] = mapped_column(String(8))  # single|batch
    cover_file_id: Mapped[str | None] = mapped_column(ForeignKey("files.id", ondelete="SET NULL"))
    edit_stack: Mapped[list[Any]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=utcnow, onupdate=utcnow)


class Recipe(Base):
    __tablename__ = "recipes"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    body: Mapped[dict[str, Any]] = mapped_column(JSON)  # {"version", "steps", "branches", "output"}
    created_at: Mapped[datetime] = mapped_column(default=utcnow)


class PresetTemplate(Base):
    __tablename__ = "preset_templates"
    id: Mapped[str] = mapped_column(String(120), primary_key=True)
    category: Mapped[str] = mapped_column(String(20), index=True)  # lut|background|outfit|expression
    subcategory: Mapped[str | None] = mapped_column(String(40))
    name: Mapped[str] = mapped_column(String(120))
    payload: Mapped[dict[str, Any]] = mapped_column(JSON)
    tier: Mapped[str] = mapped_column(String(10), default="free")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


# ---------------------------------------------------------------- jobs


class Batch(Base):
    __tablename__ = "batches"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str | None] = mapped_column(String(120))
    recipe_snapshot: Mapped[dict[str, Any]] = mapped_column(JSON)
    total_files: Mapped[int] = mapped_column(Integer)
    done_files: Mapped[int] = mapped_column(Integer, default=0)
    failed_files: Mapped[int] = mapped_column(Integer, default=0)
    # queued|running|paused|completed|partial|cancelled|failed
    status: Mapped[str] = mapped_column(String(12), default="queued")
    priority: Mapped[int] = mapped_column(Integer)
    credits_reserved: Mapped[int] = mapped_column(Integer, default=0)
    credits_spent: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
    finished_at: Mapped[datetime | None] = mapped_column()


class Job(Base):
    __tablename__ = "jobs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    batch_id: Mapped[str | None] = mapped_column(ForeignKey("batches.id", ondelete="CASCADE"), index=True)
    file_id: Mapped[str] = mapped_column(ForeignKey("files.id", ondelete="CASCADE"))
    kind: Mapped[str] = mapped_column(String(8))  # preview|render
    recipe: Mapped[dict[str, Any]] = mapped_column(JSON)
    recipe_hash: Mapped[str] = mapped_column(String(64), index=True)
    preview_at_ms: Mapped[int] = mapped_column(Integer, default=0)
    # pending (batch job waiting for a concurrency slot)|queued|running|cancelling|succeeded|failed|cancelled
    status: Mapped[str] = mapped_column(String(10), default="queued", index=True)
    stage: Mapped[str | None] = mapped_column(String(80))
    progress: Mapped[float] = mapped_column(Float, default=0.0)
    priority: Mapped[int] = mapped_column(Integer, default=2)
    attempt: Mapped[int] = mapped_column(Integer, default=0)
    error_code: Mapped[str | None] = mapped_column(String(40))
    error_message: Mapped[str | None] = mapped_column(Text)
    resolved_models: Mapped[list[Any] | None] = mapped_column(JSON)
    credits_cost: Mapped[int] = mapped_column(Integer, default=0)
    duration_ms: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
    started_at: Mapped[datetime | None] = mapped_column()
    finished_at: Mapped[datetime | None] = mapped_column()


class Output(Base):
    __tablename__ = "outputs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    job_id: Mapped[str] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    storage_key: Mapped[str] = mapped_column(String(512))
    filename: Mapped[str] = mapped_column(String(255))
    format: Mapped[str] = mapped_column(String(8))
    mime_type: Mapped[str] = mapped_column(String(80))
    width: Mapped[int | None] = mapped_column(Integer)
    height: Mapped[int | None] = mapped_column(Integer)
    duration_ms: Mapped[int | None] = mapped_column(Integer)
    size_bytes: Mapped[int] = mapped_column(BigInteger)
    watermarked: Mapped[bool] = mapped_column(Boolean, default=False)
    provenance: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)


class SafetyEvent(Base):
    __tablename__ = "safety_events"
    id: Mapped[int] = mapped_column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True)
    user_id: Mapped[str | None] = mapped_column(String(36), index=True)
    file_id: Mapped[str | None] = mapped_column(String(36))
    job_id: Mapped[str | None] = mapped_column(String(36))
    check_type: Mapped[str] = mapped_column(String(20))
    verdict: Mapped[str] = mapped_column(String(10))  # pass|block|review
    score: Mapped[float | None] = mapped_column(Float)
    details: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)


# ---------------------------------------------------------------- engine/session plumbing

_engine = None
_SessionLocal: sessionmaker[Session] | None = None


def get_engine():
    global _engine, _SessionLocal
    if _engine is None:
        s = get_settings()
        kwargs: dict[str, Any] = {"pool_pre_ping": True}
        if s.is_sqlite:
            kwargs["connect_args"] = {"check_same_thread": False, "timeout": 30}
        _engine = create_engine(s.database_url, **kwargs)
        if s.is_sqlite:

            @event.listens_for(_engine, "connect")
            def _sqlite_pragmas(conn, _):  # noqa: ANN001
                cur = conn.cursor()
                cur.execute("PRAGMA journal_mode=WAL")
                cur.execute("PRAGMA foreign_keys=ON")
                cur.close()

        _SessionLocal = sessionmaker(bind=_engine, expire_on_commit=False)
    return _engine


def session_factory() -> sessionmaker[Session]:
    get_engine()
    assert _SessionLocal is not None
    return _SessionLocal


def get_db() -> Iterator[Session]:
    db = session_factory()()
    try:
        yield db
    finally:
        db.close()


def reset_engine() -> None:
    """Drop cached engine (tests switch databases between runs)."""
    global _engine, _SessionLocal
    if _engine is not None:
        _engine.dispose()
    _engine = None
    _SessionLocal = None


def init_db() -> None:
    from .seed import seed

    Base.metadata.create_all(get_engine())
    with session_factory()() as db:
        seed(db)
        db.commit()
