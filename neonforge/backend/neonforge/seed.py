"""Idempotent seed data: plans (spec §11.1) and preset templates."""

from __future__ import annotations

from sqlalchemy.orm import Session

from .db import Plan, PresetTemplate

PLANS = [
    dict(
        id="free", name="Free", monthly_credits=50, max_batch_files=10, max_video_seconds=60,
        max_upload_mb=200, max_output_res="fhd", max_upscale=2, priority=2, batch_in_flight=2, watermark=True,
    ),
    dict(
        id="pro", name="Pro", monthly_credits=1500, max_batch_files=200, max_video_seconds=600,
        max_upload_mb=2048, max_output_res="4k", max_upscale=4, priority=6, batch_in_flight=10, watermark=False,
    ),
    dict(
        id="studio", name="Studio", monthly_credits=6000, max_batch_files=1000, max_video_seconds=1800,
        max_upload_mb=10240, max_output_res="8k", max_upscale=8, priority=8, batch_in_flight=50, watermark=False,
    ),
]

LUTS = [
    ("cinematic_teal_orange", "Cinematic Teal & Orange"),
    ("film", "Film Fade"),
    ("noir", "Noir"),
    ("vivid", "Vivid"),
    ("warm", "Golden Hour"),
    ("cool", "Arctic"),
    ("neon", "Neon Night"),
]

BACKGROUNDS = [
    ("studio_white", "Studio White", {"kind": "solid", "colors": ["#F4F5F7"]}),
    ("studio_grey", "Studio Grey", {"kind": "radial", "colors": ["#9AA0A8", "#3A3F47"]}),
    ("neon_city", "Neon Night", {"kind": "linear", "colors": ["#1A0033", "#FF2BD6", "#00F0FF"], "angle": 135}),
    ("sunset", "Sunset", {"kind": "linear", "colors": ["#FF8A3D", "#FF2B6D", "#4A1C6B"], "angle": 180}),
    ("ocean", "Ocean", {"kind": "linear", "colors": ["#00B4DB", "#0083B0", "#003554"], "angle": 170}),
    ("forest", "Forest", {"kind": "radial", "colors": ["#6FBF73", "#1E4D2B"]}),
    ("midnight", "Midnight", {"kind": "radial", "colors": ["#1B2440", "#05070D"]}),
    ("pastel", "Pastel", {"kind": "linear", "colors": ["#FBC2EB", "#A6C1EE"], "angle": 120}),
]


def seed(db: Session) -> None:
    for p in PLANS:
        existing = db.get(Plan, p["id"])
        if existing is None:
            db.add(Plan(**p))
        else:
            for k, v in p.items():
                setattr(existing, k, v)
    for i, (pid, name) in enumerate(LUTS):
        _upsert_preset(db, f"lut.{pid}", "lut", None, name, {"lut": pid}, i)
    for i, (pid, name, payload) in enumerate(BACKGROUNDS):
        _upsert_preset(db, f"background.{pid}", "background", payload["kind"], name, payload, i)


def _upsert_preset(db: Session, pid: str, cat: str, sub: str | None, name: str, payload: dict, order: int) -> None:
    row = db.get(PresetTemplate, pid)
    if row is None:
        db.add(PresetTemplate(id=pid, category=cat, subcategory=sub, name=name, payload=payload, sort_order=order))
    else:
        row.name, row.payload, row.sort_order, row.subcategory = name, payload, order, sub
