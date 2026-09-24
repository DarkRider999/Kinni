"""Upload safety screening (spec §0 / §10).

Checks run on every upload before any processing:
1. Known-abuse hash blocklist (SHA-256). In production this is PhotoDNA/PDQ plus the StopNCII hash list.
2. NSFW image classifier (ONNX, e.g. Falconsai nsfw_image_detection exported to ONNX), when installed.

This build only ships non-generative edits (enhance, upscale, retouch, background), so an upload
without a classifier is recorded as ``unscanned`` and allowed. Generative ops (face swap, outfit swap,
AI backgrounds) are disabled at the API until a classifier plus the consent flow are deployed.
"""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

import cv2
import numpy as np

from .config import get_settings
from .engine.adapters import has_model, model_path, per_thread

NSFW_MODEL = "nsfw_classifier.onnx"
NSFW_BLOCK_THRESHOLD = 0.85


@dataclass
class Verdict:
    status: str  # clear | unscanned | blocked
    check: str
    score: float | None = None
    reason: str | None = None


@lru_cache
def _blocklist(path: str, mtime: float) -> frozenset[str]:
    return frozenset(line.strip().lower() for line in Path(path).read_text().splitlines() if line.strip())


def hash_blocked(sha256: str) -> bool:
    p = get_settings().models_dir / "blocklist_sha256.txt"
    if not p.is_file():
        return False
    return sha256.lower() in _blocklist(str(p), p.stat().st_mtime)


def _nsfw_session():
    import onnxruntime as ort

    return ort.InferenceSession(str(model_path(NSFW_MODEL)), providers=["CPUExecutionProvider"])


def nsfw_score(rgb: np.ndarray) -> float | None:
    """Probability of explicit content, or None when no classifier is installed.

    Expects a ViT-style classifier: 224x224 input, ImageNet-style [-1, 1] normalisation, logits ordered
    [normal, nsfw].
    """
    if not has_model(NSFW_MODEL):
        return None
    sess = per_thread("nsfw", _nsfw_session)
    x = cv2.resize(np.ascontiguousarray(rgb[..., :3]), (224, 224), interpolation=cv2.INTER_AREA)
    x = (x.astype(np.float32) / 255.0 - 0.5) / 0.5
    logits = sess.run(None, {sess.get_inputs()[0].name: x.transpose(2, 0, 1)[None]})[0][0]
    e = np.exp(logits - logits.max())
    return float((e / e.sum())[-1])


def screen(sha256: str, frames: list[np.ndarray]) -> Verdict:
    if hash_blocked(sha256):
        return Verdict("blocked", "hash_match", 1.0, "matches a known-abuse hash")
    scores = [s for s in (nsfw_score(f) for f in frames) if s is not None]
    if not scores:
        return Verdict("unscanned", "nsfw")
    top = max(scores)
    if top >= NSFW_BLOCK_THRESHOLD:
        return Verdict("blocked", "nsfw", top, "explicit content is not allowed")
    return Verdict("clear", "nsfw", top)
