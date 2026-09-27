"""
SQLAlchemy Database Models
"""

from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, ForeignKey, Text, JSON, Enum as SQLEnum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
import uuid

Base = declarative_base()


class UserRole(str, enum.Enum):
    USER = "user"
    CREATOR = "creator"
    ADMIN = "admin"
    SUPER_ADMIN = "super_admin"


class ModerationSeverity(int, enum.Enum):
    LOW = 1
    MEDIUM = 2
    HIGH = 3
    CRITICAL = 10


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String, unique=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role = Column(SQLEnum(UserRole), default=UserRole.USER)
    age_verified = Column(Boolean, default=False)
    age_verified_at = Column(DateTime, nullable=True)
    two_fa_enabled = Column(Boolean, default=False)
    two_fa_secret = Column(String, nullable=True)
    ip_address = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    is_banned = Column(Boolean, default=False)
    ban_reason = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)

    # Relationships
    prompts = relationship("Prompt", back_populates="user")
    generated_images = relationship("GeneratedImage", back_populates="user")
    vault_items = relationship("VaultItem", back_populates="user")
    reports = relationship("Report", back_populates="user")
    creator_profile = relationship("CreatorProfile", back_populates="user", uselist=False)
    subscriptions = relationship("Subscription", back_populates="user")


class Prompt(Base):
    __tablename__ = "prompts"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), index=True)
    text = Column(Text)
    safety_score = Column(Float, nullable=True)
    is_safe = Column(Boolean, default=True)
    flagged_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    user = relationship("User", back_populates="prompts")


class GeneratedImage(Base):
    __tablename__ = "generated_images"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), index=True)
    prompt_id = Column(String, ForeignKey("prompts.id"), nullable=True)
    s3_url = Column(String)
    s3_key = Column(String)
    width = Column(Integer)
    height = Column(Integer)
    model = Column(String)
    realism_score = Column(Float, nullable=True)
    pose_preset = Column(String, nullable=True)
    lighting_preset = Column(String, nullable=True)
    style_fusion = Column(JSON, nullable=True)
    output_safety_score = Column(Float, nullable=True)
    is_safe = Column(Boolean, default=True)
    flagged_by_moderation = Column(Boolean, default=False)
    moderation_severity = Column(Integer, nullable=True)
    is_private = Column(Boolean, default=False)
    vault_item_id = Column(String, ForeignKey("vault_items.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    user = relationship("User", back_populates="generated_images")
    moderation_queue_entry = relationship("ModerationQueueEntry", back_populates="image", uselist=False)


class StyleFusionConfig(Base):
    __tablename__ = "style_fusion_configs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, index=True)
    base_style = Column(String)
    secondary_style = Column(String)
    blend_amount = Column(Float)
    parameters = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)


class VaultItem(Base):
    __tablename__ = "vault_items"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), index=True)
    image_id = Column(String, ForeignKey("generated_images.id"), nullable=True)
    content_type = Column(String)
    encrypted_content = Column(Text)
    vault_key_id = Column(String, ForeignKey("vault_keys.id"))
    is_pinned = Column(Boolean, default=False)
    pin_required = Column(Boolean, default=False)
    panic_hide_enabled = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="vault_items")
    vault_key = relationship("VaultKey", back_populates="vault_items")


class VaultKey(Base):
    __tablename__ = "vault_keys"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"))
    encrypted_key = Column(Text)
    pin_hash = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    vault_items = relationship("VaultItem", back_populates="vault_key")


class Report(Base):
    __tablename__ = "reports"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), index=True)
    image_id = Column(String, ForeignKey("generated_images.id"), nullable=True)
    reason = Column(String)
    description = Column(Text)
    status = Column(String, default="pending")
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    user = relationship("User", back_populates="reports")


class ModerationQueueEntry(Base):
    __tablename__ = "moderation_queue"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    image_id = Column(String, ForeignKey("generated_images.id"), unique=True, index=True)
    severity = Column(Integer)
    ai_recommendation = Column(String)
    status = Column(String, default="pending")
    reviewed_by = Column(String, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    action = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    image = relationship("GeneratedImage", back_populates="moderation_queue_entry")


class CreatorProfile(Base):
    __tablename__ = "creator_profiles"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), unique=True)
    display_name = Column(String)
    bio = Column(Text, nullable=True)
    identity_verified = Column(Boolean, default=False)
    identity_verification_doc = Column(String, nullable=True)
    consent_document_signed = Column(Boolean, default=False)
    consent_signed_at = Column(DateTime, nullable=True)
    rights_agreement = Column(String, nullable=True)
    profile_url = Column(String, unique=True, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="creator_profile")
    uploads = relationship("CreatorUpload", back_populates="creator_profile")


class CreatorUpload(Base):
    __tablename__ = "creator_uploads"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    creator_profile_id = Column(String, ForeignKey("creator_profiles.id"))
    title = Column(String)
    description = Column(Text)
    s3_url = Column(String)
    s3_key = Column(String)
    ai_enhancements = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    creator_profile = relationship("CreatorProfile", back_populates="uploads")


class BillingPlan(Base):
    __tablename__ = "billing_plans"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, unique=True)
    description = Column(Text)
    monthly_price = Column(Float)
    yearly_price = Column(Float, nullable=True)
    credit_allowance = Column(Integer)
    features = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)


class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), index=True)
    plan_id = Column(String, ForeignKey("billing_plans.id"))
    status = Column(String, default="active")
    credits_remaining = Column(Integer)
    credits_used = Column(Integer, default=0)
    started_at = Column(DateTime, default=datetime.utcnow)
    renews_at = Column(DateTime, nullable=True)
    cancelled_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="subscriptions")


class CreditUsage(Base):
    __tablename__ = "credit_usage"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), index=True)
    subscription_id = Column(String, ForeignKey("subscriptions.id"))
    image_id = Column(String, ForeignKey("generated_images.id"), nullable=True)
    credits_used = Column(Integer)
    operation = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, nullable=True, index=True)
    action = Column(String, index=True)
    resource_type = Column(String)
    resource_id = Column(String, nullable=True)
    changes = Column(JSON, nullable=True)
    ip_address = Column(String)
    user_agent = Column(String, nullable=True)
    status = Column(String)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

    class Config:
        indexes = [
            ("user_id", "action"),
            ("resource_type", "resource_id"),
            ("timestamp",)
        ]
