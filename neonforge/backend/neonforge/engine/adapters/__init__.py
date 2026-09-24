"""Model adapters (spec §6.1): each wraps one model behind a small, uniform interface.

Adapters load lazily from ``NF_MODELS_DIR`` and are cached per thread, because MediaPipe task objects
and ONNX sessions are not safe to share across worker threads.
"""

from __future__ import annotations

import atexit
import threading
from collections.abc import Callable
from pathlib import Path
from typing import TypeVar

from ...config import get_settings

T = TypeVar("T")

_local = threading.local()


class ModelUnavailable(RuntimeError):
    """A required model's weights/runtime are not installed on this worker."""


def model_path(name: str) -> Path:
    return get_settings().models_dir / name


def has_model(name: str) -> bool:
    return model_path(name).is_file()


_closables: list[object] = []
_closables_lock = threading.Lock()


def per_thread(key: str, factory: Callable[[], T]) -> T:
    cache = getattr(_local, "cache", None)
    if cache is None:
        cache = _local.cache = {}
    if key not in cache:
        obj = factory()
        cache[key] = obj
        for part in obj if isinstance(obj, tuple) else (obj,):
            if hasattr(part, "close"):
                with _closables_lock:
                    _closables.append(part)
    return cache[key]


@atexit.register
def _close_all() -> None:
    """Close MediaPipe tasks before interpreter teardown (their __del__ fails once modules unload)."""
    with _closables_lock:
        items, _closables[:] = list(_closables), []
    for obj in items:
        try:
            obj.close()  # type: ignore[attr-defined]
        except Exception:  # noqa: BLE001, S110
            pass


# Registry manifest: id → (filename, url, license, commercial_ok). scripts/fetch_models.py downloads these.
MODEL_FILES: dict[str, dict] = {
    "mediapipe_face_detector": {
        "file": "blaze_face_short_range.tflite",
        "url": "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/"
               "blaze_face_short_range.tflite",
        "license": "Apache-2.0", "commercial_ok": True,
    },
    "mediapipe_face_landmarker": {
        "file": "face_landmarker.task",
        "url": "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/"
               "face_landmarker.task",
        "license": "Apache-2.0", "commercial_ok": True,
    },
    "mediapipe_selfie_multiclass": {
        "file": "selfie_multiclass.tflite",
        "url": "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/"
               "float32/latest/selfie_multiclass_256x256.tflite",
        "license": "Apache-2.0", "commercial_ok": True,
    },
    "u2netp": {
        "file": "u2netp.onnx",
        "url": "https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx",
        "license": "Apache-2.0", "commercial_ok": True,
    },
    "isnet_general": {
        "file": "isnet-general-use.onnx",
        "url": "https://github.com/danielgatis/rembg/releases/download/v0.0.0/isnet-general-use.onnx",
        "license": "Apache-2.0", "commercial_ok": True, "optional": True,
    },
    "realesrgan_x4plus": {
        "file": "RealESRGAN_x4plus.pth",
        "url": "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth",
        "license": "BSD-3-Clause", "commercial_ok": True, "optional": True, "needs": "torch",
    },
    "realesrgan_x2plus": {
        "file": "RealESRGAN_x2plus.pth",
        "url": "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.1/RealESRGAN_x2plus.pth",
        "license": "BSD-3-Clause", "commercial_ok": True, "optional": True, "needs": "torch",
    },
    "realesrgan_x4plus_anime": {
        "file": "RealESRGAN_x4plus_anime_6B.pth",
        "url": "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.2.4/RealESRGAN_x4plus_anime_6B.pth",
        "license": "BSD-3-Clause", "commercial_ok": True, "optional": True, "needs": "torch",
    },
}
