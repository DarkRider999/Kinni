"""Synthetic test media, generated on the fly so the suite needs no fixtures on disk."""

from __future__ import annotations

import io
import subprocess
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

from neonforge.engine.media import ffmpeg_exe


def scene(w: int = 320, h: int = 240, seed: int = 0, noise: float = 6.0) -> np.ndarray:
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    img = np.dstack([xx / w * 200 + 30, yy / h * 160 + 40, (1 - xx / w) * 150 + 60])
    cv2.circle(img, (w // 2, h // 2), min(w, h) // 5, (230, 200, 40), -1)
    cv2.rectangle(img, (w // 8, h // 6), (w // 3, h // 2), (40, 60, 200), -1)
    for i in range(0, w, 16):
        cv2.line(img, (i, h - 30), (i + 8, h - 10), (20, 20, 20), 1)
    img += rng.normal(0, noise, img.shape)
    return np.clip(img, 0, 255).astype(np.uint8)


def jpeg(arr: np.ndarray, **kw) -> bytes:
    buf = io.BytesIO()
    Image.fromarray(arr).save(buf, "JPEG", quality=90, **kw)
    return buf.getvalue()


def png(arr: np.ndarray) -> bytes:
    buf = io.BytesIO()
    Image.fromarray(arr).save(buf, "PNG")
    return buf.getvalue()


def gif(frames: int = 6, w: int = 96, h: int = 72) -> bytes:
    ims = []
    for i in range(frames):
        a = scene(w, h, seed=i, noise=2)
        a = np.roll(a, i * 4, axis=1)
        ims.append(Image.fromarray(a).quantize(64))
    buf = io.BytesIO()
    ims[0].save(buf, "GIF", save_all=True, append_images=ims[1:], duration=80, loop=0)
    return buf.getvalue()


def video(path: Path, seconds: float = 1.5, w: int = 320, h: int = 240, fps: int = 15, audio: bool = True,
          container: str = "mp4") -> Path:
    cmd = [ffmpeg_exe(), "-y", "-loglevel", "error", "-f", "lavfi", "-i", f"testsrc2=size={w}x{h}:rate={fps}"]
    if audio:
        cmd += ["-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100"]
    cmd += ["-t", str(seconds)]
    if container == "avi":
        cmd += ["-c:v", "mpeg4", "-q:v", "5"]
    else:
        cmd += ["-c:v", "libx264", "-pix_fmt", "yuv420p"]
    if audio:
        cmd += ["-c:a", "aac" if container != "avi" else "mp3"]
    cmd.append(str(path))
    subprocess.run(cmd, check=True, capture_output=True, timeout=60)
    return path


def shaky_frames(n: int = 40, w: int = 240, h: int = 180, amp: float = 6.0, seed: int = 1) -> list[np.ndarray]:
    """A static textured scene with random per-frame camera translation (known ground truth)."""
    rng = np.random.default_rng(seed)
    base = scene(w + 60, h + 60, seed=3, noise=0)
    tex = rng.integers(0, 255, (h + 60, w + 60), dtype=np.uint8)
    base = np.clip(base.astype(np.int16) + (tex[..., None].astype(np.int16) - 128) // 3, 0, 255).astype(np.uint8)
    frames = []
    for _ in range(n):
        dx, dy = rng.uniform(-amp, amp, 2)
        m = np.float32([[1, 0, 30 + dx], [0, 1, 30 + dy]])
        frames.append(cv2.warpAffine(base, m, (w + 60, h + 60))[30:30 + h, 30:30 + w].copy())
    return frames
