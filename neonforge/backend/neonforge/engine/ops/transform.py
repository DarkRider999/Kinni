"""Geometry ops: super-resolution upscale and video stabilization."""

from __future__ import annotations

import cv2
import numpy as np

from ..adapters import upscale as up
from .base import Op, merge_alpha, split_alpha


class Upscale(Op):
    name = "upscale"
    label = "Upscaling"

    def setup(self, samples: list[np.ndarray]) -> None:
        content = self.p["model"]
        if content in ("auto", "face"):
            content = "anime" if self.env.analysis.get("scene") == "anime" else "photo"
        self.chain = up.pick_model(self.p["scale"], content)
        for model_id, _ in self.chain:
            self.use(model_id)

    def apply(self, frame: np.ndarray, index: int) -> np.ndarray:
        rgb, alpha = split_alpha(frame)
        for model_id, factor in self.chain:
            rgb = up.upscale(rgb, model_id, factor)
        if alpha is not None:
            alpha = cv2.resize(alpha, (rgb.shape[1], rgb.shape[0]), interpolation=cv2.INTER_CUBIC)
        return merge_alpha(rgb, alpha)


class Stabilize(Op):
    """Feature-tracking stabilization.

    Global pass: track corners frame-to-frame (LK optical flow), fit a similarity transform, integrate
    to a camera trajectory, then smooth it. Tripod mode locks to the first frame. Per frame: warp by
    (smoothed - raw) and zoom slightly (crop_pct) to hide moving borders.
    """

    name = "stabilize"
    label = "Stabilizing"

    def setup(self, samples: list[np.ndarray]) -> None:
        self.use("lk_flow_similarity_l1smooth")
        self.corrections: list[np.ndarray] = []
        if self.env.iter_source is None:
            return
        transforms = []
        prev_gray = None
        scale = 1.0
        for frame in self.env.iter_source():
            h, w = frame.shape[:2]
            scale = min(1.0, 640 / max(h, w))
            small = cv2.resize(frame[..., :3], (round(w * scale), round(h * scale)), interpolation=cv2.INTER_AREA)
            gray = cv2.cvtColor(small, cv2.COLOR_RGB2GRAY)
            if prev_gray is None:
                transforms.append((0.0, 0.0, 0.0))
            else:
                transforms.append(_estimate(prev_gray, gray))
            prev_gray = gray
        if not transforms:
            return
        t = np.array(transforms, np.float64)
        t[:, :2] /= scale  # back to full-resolution pixels
        traj = np.cumsum(t, axis=0)
        mode = self.p["strength"]
        if mode == "tripod":
            smooth = np.zeros_like(traj)
        else:
            radius = int(self.env.fps * (0.5 if mode == "standard" else 1.5))
            smooth = _moving_average(traj, max(1, radius))
        diff = smooth - traj
        self.corrections = [d for d in diff]

    def apply(self, frame: np.ndarray, index: int) -> np.ndarray:
        h, w = frame.shape[:2]
        dx, dy, da = self.corrections[index] if index < len(self.corrections) else (0.0, 0.0, 0.0)
        zoom = 1.0 + self.p["crop_pct"] / 100.0
        c, s = np.cos(da) * zoom, np.sin(da) * zoom
        cx, cy = w / 2, h / 2
        m = np.array([[c, -s, (1 - c) * cx + s * cy + dx * zoom], [s, c, -s * cx + (1 - c) * cy + dy * zoom]],
                     np.float32)
        return cv2.warpAffine(frame, m, (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)


def _estimate(prev: np.ndarray, cur: np.ndarray) -> tuple[float, float, float]:
    pts = cv2.goodFeaturesToTrack(prev, maxCorners=300, qualityLevel=0.01, minDistance=20, blockSize=3)
    if pts is None or len(pts) < 8:
        return 0.0, 0.0, 0.0
    nxt, status, _ = cv2.calcOpticalFlowPyrLK(prev, cur, pts, None)
    ok = status.ravel() == 1
    if ok.sum() < 8:
        return 0.0, 0.0, 0.0
    m, _ = cv2.estimateAffinePartial2D(pts[ok], nxt[ok], method=cv2.RANSAC, ransacReprojThreshold=3.0)
    if m is None:
        return 0.0, 0.0, 0.0
    return float(m[0, 2]), float(m[1, 2]), float(np.arctan2(m[1, 0], m[0, 0]))


def _moving_average(traj: np.ndarray, radius: int) -> np.ndarray:
    k = np.ones(2 * radius + 1) / (2 * radius + 1)
    padded = np.pad(traj, ((radius, radius), (0, 0)), mode="edge")
    return np.stack([np.convolve(padded[:, i], k, mode="valid") for i in range(traj.shape[1])], axis=1)
