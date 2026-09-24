"""Recipe schema: an ordered chain of edit steps plus output settings (spec §5.4).

The same recipe drives single-file renders, previews and batches.
"""

from __future__ import annotations

import math
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

# Ops in the spec that need GPU generative models (spec §14.2, milestones M4/M5).
# They are part of the API vocabulary so clients can show them, but this build rejects them.
PLANNED_OPS = {"face_swap", "outfit_swap", "expression", "bg_generate"}


class _Step(BaseModel):
    model_config = ConfigDict(extra="forbid")


class EnhanceParams(_Step):
    auto: bool = True
    strength: int = Field(70, ge=0, le=100)
    denoise: int = Field(30, ge=0, le=100)
    sharpness: int = Field(40, ge=0, le=100)
    clarity: int = Field(30, ge=0, le=100)
    exposure: float = Field(0.0, ge=-2.0, le=2.0)
    contrast: int = Field(0, ge=-100, le=100)
    saturation: int = Field(0, ge=-100, le=100)
    white_balance: bool = True


class HdrParams(_Step):
    intensity: int = Field(60, ge=0, le=100)


class UpscaleParams(_Step):
    scale: Literal[2, 4, 8] = 2
    model: Literal["auto", "photo", "anime", "face"] = "auto"


class ColorGradeParams(_Step):
    lut: str = "cinematic_teal_orange"
    intensity: float = Field(0.7, ge=0.0, le=1.0)


class FaceRetouchParams(_Step):
    smooth: int = Field(35, ge=0, le=100)
    blemish: bool = True
    eyes: int = Field(20, ge=0, le=100)
    faces: Literal["all", "largest"] | list[int] = "all"


class FaceRestoreParams(_Step):
    fidelity: float = Field(0.7, ge=0.0, le=1.0)
    faces: Literal["all", "largest"] | list[int] = "all"


class BackgroundParams(_Step):
    mode: Literal["remove", "replace", "blur"]
    # remove
    fill: Literal["transparent", "white", "color"] = "transparent"
    color: str = "#FFFFFF"
    # replace
    source: Literal["preset", "upload", "color"] = "preset"
    preset_id: str | None = None
    image_file_id: str | None = None
    # blur
    aperture: float = Field(2.8, ge=1.0, le=16.0)
    edge_refine: bool = True


class StabilizeParams(_Step):
    strength: Literal["standard", "strong", "tripod"] = "standard"
    crop_pct: int = Field(8, ge=0, le=20)


_PARAMS: dict[str, type[_Step]] = {
    "enhance": EnhanceParams,
    "hdr": HdrParams,
    "upscale": UpscaleParams,
    "color_grade": ColorGradeParams,
    "face_retouch": FaceRetouchParams,
    "face_restore": FaceRestoreParams,
    "background": BackgroundParams,
    "stabilize": StabilizeParams,
}
SUPPORTED_OPS = set(_PARAMS)


class Step(BaseModel):
    op: str
    params: dict[str, Any] = Field(default_factory=dict)
    enabled: bool = True

    @model_validator(mode="after")
    def _validate(self) -> Step:
        if self.op in PLANNED_OPS:
            raise ValueError(f"op '{self.op}' is planned for a later milestone and not available in this build")
        cls = _PARAMS.get(self.op)
        if cls is None:
            raise ValueError(f"unknown op '{self.op}'")
        self.params = cls.model_validate(self.params).model_dump()
        return self


ResolutionPreset = Literal["sd", "hd", "fhd", "4k", "8k", "original"]


class OutputSpec(BaseModel):
    model_config = ConfigDict(extra="forbid")
    image_format: Literal["jpg", "png", "webp"] = "jpg"
    video_format: Literal["mp4", "mov", "gif"] = "mp4"
    resolution: ResolutionPreset = "original"
    quality: Literal["small", "balanced", "max"] = "balanced"
    strip_metadata: bool = True
    gif_fps: Annotated[int, Field(ge=5, le=30)] = 15


class RecipeBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    version: int = 1
    steps: list[Step] = Field(default_factory=list, max_length=20)
    # Extra steps appended only for a media kind, e.g. {"video": [{"op": "stabilize"}]}
    branches: dict[Literal["image", "video", "gif"], list[Step]] = Field(default_factory=dict)
    output: OutputSpec = Field(default_factory=OutputSpec)

    def steps_for(self, kind: str) -> list[Step]:
        steps = [s for s in self.steps if s.enabled]
        steps += [s for s in self.branches.get(kind, []) if s.enabled]  # type: ignore[call-overload]
        if kind == "image":
            steps = [s for s in steps if s.op != "stabilize"]
        return steps


# ---------------------------------------------------------------- credits (spec §8.4)

_IMAGE_COST = {
    "enhance": 1,
    "hdr": 1,
    "color_grade": 0,
    "face_retouch": 1,
    "face_restore": 1,
    "background": 1,
    "stabilize": 0,
}
_VIDEO_COST_PER_10S = {
    "enhance": 5,
    "hdr": 5,
    "color_grade": 1,
    "face_retouch": 6,
    "face_restore": 6,
    "background": 6,
    "stabilize": 3,
}
_UPSCALE_IMAGE = {2: 1, 4: 2, 8: 5}
_UPSCALE_VIDEO = {2: 8, 4: 15, 8: 40}


def estimate_credits(recipe: RecipeBody, kind: str, duration_ms: int | None) -> int:
    steps = recipe.steps_for(kind)
    if kind == "image":
        total = 0
        for s in steps:
            total += _UPSCALE_IMAGE[s.params["scale"]] if s.op == "upscale" else _IMAGE_COST[s.op]
        return max(total, 1)
    units = max(1, math.ceil((duration_ms or 10_000) / 10_000))
    total = 0
    for s in steps:
        per = _UPSCALE_VIDEO[s.params["scale"]] if s.op == "upscale" else _VIDEO_COST_PER_10S[s.op]
        total += per * units
    return max(total, 1)
