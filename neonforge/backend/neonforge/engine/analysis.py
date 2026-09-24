"""Content analysis that feeds the model router (spec §6.3): noise, blur, faces, scene type."""

from __future__ import annotations

import cv2
import numpy as np

from .adapters import face as face_adapter


def estimate_noise_sigma(rgb: np.ndarray) -> float:
    """Immerkær's fast noise estimate on luminance (sigma in 0..255 units)."""
    gray = cv2.cvtColor(rgb[..., :3], cv2.COLOR_RGB2GRAY).astype(np.float32)
    k = np.array([[1, -2, 1], [-2, 4, -2], [1, -2, 1]], np.float32)
    conv = cv2.filter2D(gray, -1, k)
    h, w = gray.shape
    return float(np.sum(np.abs(conv[1:-1, 1:-1])) * np.sqrt(0.5 * np.pi) / (6 * (w - 2) * (h - 2)))


def blur_score(rgb: np.ndarray) -> float:
    """Variance of the Laplacian at a fixed working size; below ~100 reads as soft/blurry."""
    gray = cv2.cvtColor(_work(rgb), cv2.COLOR_RGB2GRAY)
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def scene_type(rgb: np.ndarray) -> str:
    """Cheap photo vs. illustration split: flat colour regions and few unique colours → 'anime'."""
    small = _work(rgb, 256)
    q = (small[..., :3] // 16).reshape(-1, 3).astype(np.int32)
    unique = len(np.unique(q[:, 0] * 256 + q[:, 1] * 16 + q[:, 2]))
    edges = cv2.Canny(cv2.cvtColor(small, cv2.COLOR_RGB2GRAY), 80, 160)
    edge_density = float((edges > 0).mean())
    noise = estimate_noise_sigma(small)
    if unique < 450 and noise < 2.5 and edge_density < 0.12:
        return "anime"
    return "photo"


def analyze(rgb: np.ndarray, detect_faces: bool = True) -> dict:
    h, w = rgb.shape[:2]
    work = _work(rgb, 1280)
    faces = face_adapter.detect_faces(work, landmarks=False) if detect_faces else []
    scale = max(h, w) / max(work.shape[:2])
    lum = cv2.cvtColor(work[..., :3], cv2.COLOR_RGB2GRAY)
    return {
        "width": w,
        "height": h,
        "megapixels": round(w * h / 1e6, 2),
        "noise_sigma": round(estimate_noise_sigma(work), 2),
        "blur_score": round(blur_score(work), 1),
        "brightness": round(float(lum.mean()) / 255, 3),
        "scene": scene_type(work),
        "face_count": len(faces),
        "largest_face_px": int(max((f.box[2] for f in faces), default=0) * scale),
        "faces": [
            {"index": i, "box": [int(v * scale) for v in f.box], "score": round(f.score, 3)}
            for i, f in enumerate(faces[:10])
        ],
        "has_alpha": rgb.ndim == 3 and rgb.shape[2] == 4,
    }


def _work(rgb: np.ndarray, max_side: int = 1024) -> np.ndarray:
    h, w = rgb.shape[:2]
    s = max_side / max(h, w)
    img = np.ascontiguousarray(rgb[..., :3])
    return cv2.resize(img, (round(w * s), round(h * s)), interpolation=cv2.INTER_AREA) if s < 1 else img
