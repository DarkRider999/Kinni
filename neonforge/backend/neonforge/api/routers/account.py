from __future__ import annotations

from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select

from ... import credits
from ...config import get_settings
from ...db import Plan, User, UserSettings
from ...errors import ApiError
from ..deps import DB, CurrentUser, issue_token

router = APIRouter(tags=["account"])


class DevLogin(BaseModel):
    email: EmailStr
    display_name: str | None = Field(None, max_length=120)
    plan: Literal["free", "pro", "studio"] = "free"


@router.post("/auth/dev-login")
def dev_login(body: DevLogin, db: DB) -> dict:
    """Development sign-in by email. Production uses Firebase/Auth0 token exchange (spec §5.1)."""
    if not get_settings().allow_dev_login:
        raise ApiError(404, "NOT_FOUND", "not found")
    email = body.email.lower()
    user = db.scalars(select(User).where(User.email == email)).first()
    if user is None:
        user = User(auth_provider="dev", auth_subject=email, email=email,
                    display_name=body.display_name or email.split("@")[0], plan_id=body.plan)
        user.settings = UserSettings()
        db.add(user)
        db.flush()
        plan = db.get(Plan, body.plan)
        assert plan is not None
        credits.grant(db, user, plan.monthly_credits, f"{plan.name} monthly credits")
        db.commit()
    return {"access_token": issue_token(user.id), "token_type": "bearer", "user": _me(db, user)}


def _me(db, user: User) -> dict:
    p = user.plan
    return {
        "id": user.id, "email": user.email, "display_name": user.display_name,
        "plan": {"id": p.id, "name": p.name, "monthly_credits": p.monthly_credits, "max_batch_files": p.max_batch_files,
                 "max_video_seconds": p.max_video_seconds, "max_upload_mb": p.max_upload_mb,
                 "max_output_res": p.max_output_res, "max_upscale": p.max_upscale, "watermark": p.watermark},
        "credits": credits.balance(db, user.id),
    }


@router.get("/me")
def me(user: CurrentUser, db: DB) -> dict:
    return _me(db, user)


class SettingsBody(BaseModel):
    language: Literal["en", "hi", "es", "pt-BR", "id", "ar", "fr", "de", "ja", "ko"] | None = None
    theme: Literal["dark", "light", "system"] | None = None
    quality_lane: Literal["fast", "balanced", "max"] | None = None
    default_image_format: Literal["jpg", "png", "webp"] | None = None
    default_video_format: Literal["mp4", "mov", "gif"] | None = None
    default_resolution: Literal["sd", "hd", "fhd", "4k", "8k", "original"] | None = None
    naming_pattern: str | None = Field(None, max_length=120)
    strip_metadata: bool | None = None
    auto_delete_days: Literal[1, 7, 30, 90] | None = None
    notify_job_complete: bool | None = None


_SETTINGS_FIELDS = list(SettingsBody.model_fields)


def _settings_dict(s: UserSettings) -> dict:
    return {k: getattr(s, k) for k in _SETTINGS_FIELDS}


@router.get("/me/settings")
def get_settings_(user: CurrentUser, db: DB) -> dict:
    if user.settings is None:
        user.settings = UserSettings()
        db.commit()
    return _settings_dict(user.settings)


@router.put("/me/settings")
def put_settings(body: SettingsBody, user: CurrentUser, db: DB) -> dict:
    if user.settings is None:
        user.settings = UserSettings()
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(user.settings, k, v)
    db.commit()
    return _settings_dict(user.settings)
