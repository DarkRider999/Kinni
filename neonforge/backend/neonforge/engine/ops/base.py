from __future__ import annotations

from collections.abc import Callable, Iterator
from dataclasses import dataclass, field
from typing import Any

import numpy as np


@dataclass
class Env:
    """What an op may know about the job: media kind, timing and ways to fetch resources."""

    kind: str  # image | video | gif
    fps: float = 30.0
    frame_count: int = 1
    analysis: dict[str, Any] = field(default_factory=dict)
    # Re-iterates the *source* frames (video global passes such as stabilization analysis)
    iter_source: Callable[[], Iterator[np.ndarray]] | None = None
    load_file_image: Callable[[str], np.ndarray] | None = None
    presets: dict[str, dict[str, Any]] = field(default_factory=dict)
    lane: str = "balanced"  # fast | balanced | max

    @property
    def temporal(self) -> bool:
        return self.kind in ("video", "gif")


class Op:
    """One edit step. ``setup`` runs once with sample frames; ``apply`` runs per frame, in order."""

    name = "op"
    label = "Processing"

    def __init__(self, params: dict[str, Any], env: Env) -> None:
        self.p = params
        self.env = env
        self.models: list[str] = []

    def setup(self, samples: list[np.ndarray]) -> None:  # noqa: B027 - optional hook
        pass

    def apply(self, frame: np.ndarray, index: int) -> np.ndarray:
        raise NotImplementedError

    def use(self, model_id: str) -> None:
        if model_id not in self.models:
            self.models.append(model_id)


def split_alpha(frame: np.ndarray) -> tuple[np.ndarray, np.ndarray | None]:
    if frame.shape[2] == 4:
        return np.ascontiguousarray(frame[..., :3]), frame[..., 3]
    return frame, None


def merge_alpha(rgb: np.ndarray, alpha: np.ndarray | None) -> np.ndarray:
    if alpha is None:
        return rgb
    if alpha.shape[:2] != rgb.shape[:2]:
        import cv2

        alpha = cv2.resize(alpha, (rgb.shape[1], rgb.shape[0]), interpolation=cv2.INTER_LINEAR)
    return np.dstack([rgb, alpha])


def to_f32(rgb: np.ndarray) -> np.ndarray:
    return rgb.astype(np.float32) / 255.0


def to_u8(f: np.ndarray) -> np.ndarray:
    return np.clip(f * 255.0 + 0.5, 0, 255).astype(np.uint8)
