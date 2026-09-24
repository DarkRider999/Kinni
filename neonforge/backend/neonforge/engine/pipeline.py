"""Recipe execution for images, GIFs and videos, plus export (resize, watermark, encode).

Execution order: the user's step order is kept, except that ``stabilize`` always runs first (it
analyses source motion) and ``upscale`` always runs last. Every other op then works at source
resolution, which is faster, and matting models work at low resolution anyway.
"""

from __future__ import annotations

import time
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

from ..recipes import RecipeBody, Step
from . import media
from .ops.background import Background
from .ops.base import Env, Op
from .ops.enhance import ColorGrade, Enhance, Hdr
from .ops.face import FaceRestore, FaceRetouch
from .ops.transform import Stabilize, Upscale

OPS: dict[str, type[Op]] = {
    "enhance": Enhance,
    "hdr": Hdr,
    "color_grade": ColorGrade,
    "face_retouch": FaceRetouch,
    "face_restore": FaceRestore,
    "background": Background,
    "upscale": Upscale,
    "stabilize": Stabilize,
}

# long edge for images; (long, short) box for video
RES_LONG_EDGE = {"sd": 854, "hd": 1280, "fhd": 1920, "4k": 3840, "8k": 7680}
RES_VIDEO_BOX = {"sd": (854, 480), "hd": (1280, 720), "fhd": (1920, 1080), "4k": (3840, 2160), "8k": (7680, 4320)}
RES_ORDER = ["sd", "hd", "fhd", "4k", "8k"]

PREVIEW_IMAGE_SIDE = 1080
PREVIEW_VIDEO_SIDE = 640
PREVIEW_VIDEO_MS = 3000
MAX_GIF_FRAMES = 300

ProgressFn = Callable[[str, float], None]


class JobCancelled(Exception):
    pass


@dataclass
class RenderResult:
    path: Path
    format: str
    mime: str
    width: int
    height: int
    duration_ms: int | None
    models: list[dict] = field(default_factory=list)
    watermarked: bool = False
    elapsed_ms: int = 0


def order_steps(steps: list[Step]) -> list[Step]:
    first = [s for s in steps if s.op == "stabilize"]
    last = [s for s in steps if s.op == "upscale"]
    middle = [s for s in steps if s.op not in ("stabilize", "upscale")]
    return first + middle + last


def build_ops(steps: list[Step], env: Env) -> list[Op]:
    return [OPS[s.op](dict(s.params), env) for s in order_steps(steps)]


def clamp_resolution(requested: str, plan_max: str) -> str:
    if requested == "original":
        return plan_max
    return RES_ORDER[min(RES_ORDER.index(requested), RES_ORDER.index(plan_max))]


def target_size(w: int, h: int, res: str, kind: str, allow_original: bool = False) -> tuple[int, int]:
    """Downscale-only target size for a resolution preset (aspect ratio preserved)."""
    if allow_original or res not in RES_LONG_EDGE:
        s = 1.0
    elif kind == "image":
        s = min(1.0, RES_LONG_EDGE[res] / max(w, h))
    else:
        long_, short = RES_VIDEO_BOX[res]
        s = min(1.0, long_ / max(w, h), short / min(w, h))
    tw, th = max(2, round(w * s)), max(2, round(h * s))
    if kind != "image":  # H.264 yuv420p needs even dimensions
        tw, th = tw - tw % 2, th - th % 2
    return tw, th


def resize_to(frame: np.ndarray, size: tuple[int, int]) -> np.ndarray:
    if (frame.shape[1], frame.shape[0]) == size:
        return frame
    interp = cv2.INTER_AREA if size[0] < frame.shape[1] else cv2.INTER_CUBIC
    return cv2.resize(frame, size, interpolation=interp)


def draw_watermark(frame: np.ndarray, text: str = "AI-edited · NeonForge") -> np.ndarray:
    """Small translucent badge, bottom-right (free tier, spec §11.1)."""
    im = Image.fromarray(frame)
    mode = im.mode
    base = im.convert("RGBA")
    w, h = base.size
    size = max(10, int(min(w, h) * 0.028))
    try:
        font = ImageFont.load_default(size=size)
    except TypeError:
        font = ImageFont.load_default()
    overlay = Image.new("RGBA", base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    tb = d.textbbox((0, 0), text, font=font)
    tw, th = tb[2] - tb[0], tb[3] - tb[1]
    pad = max(4, size // 2)
    margin = max(6, size)
    x1, y1 = w - margin, h - margin
    x0, y0 = x1 - tw - 2 * pad, y1 - th - 2 * pad
    d.rounded_rectangle((x0, y0, x1, y1), radius=(th + 2 * pad) // 2, fill=(7, 8, 13, 150),
                        outline=(0, 240, 255, 170), width=max(1, size // 12))
    d.text((x0 + pad - tb[0], y0 + pad - tb[1]), text, font=font, fill=(232, 236, 243, 230))
    out = Image.alpha_composite(base, overlay)
    return np.asarray(out if mode == "RGBA" else out.convert("RGB")).copy()


def _models(ops: list[Op]) -> list[dict]:
    return [{"op": op.name, "models": op.models} for op in ops]


def _frames_progress(progress: ProgressFn, label: str, done: int, total: int, lo: float, hi: float) -> None:
    progress(label, lo + (hi - lo) * done / max(total, 1))


# ---------------------------------------------------------------- entry point


def render(
    src: Path,
    kind: str,
    recipe: RecipeBody,
    out_dir: Path,
    *,
    env: Env,
    progress: ProgressFn,
    preview: bool = False,
    preview_at_ms: int = 0,
    plan_max_res: str = "8k",
    watermark: bool = False,
    provenance: dict | None = None,
) -> RenderResult:
    t0 = time.monotonic()
    out_dir.mkdir(parents=True, exist_ok=True)
    steps = recipe.steps_for(kind)
    out = recipe.output
    res = "original" if preview else clamp_resolution(out.resolution, plan_max_res)
    if kind == "image":
        result = _render_image(src, steps, env, progress, out_dir, preview, res, out.image_format, out.quality,
                               watermark, provenance)
    elif kind == "gif":
        result = _render_gif(src, steps, env, progress, out_dir, preview, res, out.video_format, out.quality,
                             watermark, out.gif_fps)
    else:
        result = _render_video(src, steps, env, progress, out_dir, preview, preview_at_ms, res, out.video_format,
                               out.quality, watermark, out.gif_fps)
    result.elapsed_ms = int((time.monotonic() - t0) * 1000)
    return result


def _render_image(src, steps, env, progress, out_dir, preview, res, fmt, quality, watermark, provenance):
    progress("Decoding", 0.02)
    img = media.load_image(src)
    if preview:
        h, w = img.shape[:2]
        s = PREVIEW_IMAGE_SIDE / max(h, w)
        if s < 1:
            img = cv2.resize(img, (round(w * s), round(h * s)), interpolation=cv2.INTER_AREA)
    ops = build_ops(steps, env)
    for op in ops:
        op.setup([img])
    n = len(ops)
    for i, op in enumerate(ops):
        progress(op.label, 0.05 + 0.85 * i / max(n, 1))
        img = op.apply(img, 0)
    progress("Exporting", 0.92)
    h, w = img.shape[:2]
    img = resize_to(img, target_size(w, h, res, "image"))
    if watermark:
        img = draw_watermark(img)
    if preview:
        fmt = "png" if img.shape[2] == 4 else "jpg"
    elif fmt == "jpg" and img.shape[2] == 4:
        img = media.flatten_alpha(img, (255, 255, 255))
    xmp = media.xmp_packet(provenance) if provenance else None
    data = media.encode_image(img, fmt, "small" if preview else quality, xmp=xmp)
    path = out_dir / f"output.{fmt}"
    path.write_bytes(data)
    mime = {"jpg": "image/jpeg", "png": "image/png", "webp": "image/webp"}[fmt]
    return RenderResult(path, fmt, mime, img.shape[1], img.shape[0], None, _models(ops), watermark)


def _render_gif(src, steps, env, progress, out_dir, preview, res, fmt, quality, watermark, gif_fps):
    progress("Decoding", 0.02)
    gif = media.load_gif(src, max_frames=60 if preview else MAX_GIF_FRAMES)
    frames = gif.frames
    if preview:
        frames = [_fit(f, PREVIEW_VIDEO_SIDE) for f in frames]
    env.frame_count = len(frames)
    env.fps = 1000.0 / max(1.0, float(np.mean(gif.durations_ms)))
    env.iter_source = lambda: iter(frames)
    ops = build_ops(steps, env)
    samples = frames[:: max(1, len(frames) // 8)][:8]
    for op in ops:
        op.setup(samples)
    out_frames = []
    for i, f in enumerate(frames):
        for op in ops:
            f = op.apply(f, i)
        out_frames.append(f)
        _frames_progress(progress, "Processing frames", i + 1, len(frames), 0.05, 0.9)
    progress("Encoding", 0.92)
    h, w = out_frames[0].shape[:2]
    size = target_size(w, h, res, "gif")
    out_frames = [resize_to(f, size) for f in out_frames]
    if watermark:
        out_frames = [draw_watermark(f) for f in out_frames]
    if preview or fmt == "gif":
        path = out_dir / "output.gif"
        path.write_bytes(media.encode_gif(out_frames, gif.durations_ms, gif.loop, max_side=max(size)))
        return RenderResult(path, "gif", "image/gif", size[0], size[1], int(sum(gif.durations_ms)),
                            _models(ops), watermark)
    path = out_dir / f"output.{fmt}"
    writer = media.VideoWriter(path, size[0], size[1], env.fps, fmt, quality)
    try:
        for f in out_frames:
            writer.write(f)
    finally:
        writer.close()
    return RenderResult(path, fmt, _video_mime(fmt), size[0], size[1], int(sum(gif.durations_ms)),
                        _models(ops), watermark)


def _render_video(src, steps, env, progress, out_dir, preview, at_ms, res, fmt, quality, watermark, gif_fps):
    progress("Analysing video", 0.01)
    info = media.probe_video(src)
    start = min(at_ms, max(0, info.duration_ms - PREVIEW_VIDEO_MS)) if preview else 0
    dur = PREVIEW_VIDEO_MS if preview else None
    max_side = PREVIEW_VIDEO_SIDE if preview else None
    total = max(1, round((dur or info.duration_ms) / 1000 * info.fps))
    env.fps = info.fps
    env.frame_count = total
    env.iter_source = lambda: media.read_video_frames(src, start, dur, max_side)
    ops = build_ops(steps, env)

    samples = _sample_frames(src, info, start, dur, max_side)
    for op in ops:
        progress(f"Preparing {op.label.lower()}", 0.03)
        op.setup(samples)

    out_fmt = "mp4" if preview else fmt
    path = out_dir / f"output.{out_fmt}"
    writer: media.VideoWriter | None = None
    gif_frames: list[np.ndarray] = []
    size: tuple[int, int] | None = None
    written = 0
    try:
        for i, frame in enumerate(media.read_video_frames(src, start, dur, max_side)):
            for op in ops:
                frame = op.apply(frame, i)
            if size is None:
                size = target_size(frame.shape[1], frame.shape[0], res, "video")
            frame = resize_to(frame, size)
            if watermark:
                frame = draw_watermark(frame)
            if out_fmt == "gif":
                gif_frames.append(frame)
                if len(gif_frames) >= MAX_GIF_FRAMES * max(1, round(info.fps / gif_fps)):
                    break
            else:
                if writer is None:
                    writer = media.VideoWriter(
                        path, size[0], size[1], info.fps, out_fmt, "small" if preview else quality,
                        audio_from=src if info.has_audio else None, audio_start_ms=start, audio_duration_ms=dur,
                    )
                writer.write(frame)
            written += 1
            _frames_progress(progress, _stage(ops), written, total, 0.05, 0.95)
    finally:
        if writer is not None:
            writer.close()
    if written == 0 or size is None:
        raise media.MediaError("video produced no frames")
    if out_fmt == "gif":
        progress("Encoding GIF", 0.96)
        frames, delay = media.video_to_gif_frames(gif_frames, info.fps, gif_fps)
        gif_side = min(480, max(size))
        path.write_bytes(media.encode_gif(frames, [delay] * len(frames), 0, max_side=gif_side))
        s = min(1.0, gif_side / max(size))
        size = (max(1, round(size[0] * s)), max(1, round(size[1] * s)))
    duration = int(written / info.fps * 1000)
    return RenderResult(path, out_fmt, _video_mime(out_fmt), size[0], size[1], duration, _models(ops), watermark)


def _stage(ops: list[Op]) -> str:
    return ops[0].label if len(ops) == 1 else "Processing frames"


def _sample_frames(src: Path, info: media.VideoInfo, start: int, dur: int | None, max_side: int | None,
                   n: int = 8) -> list[np.ndarray]:
    span = dur or info.duration_ms or 1000
    out = []
    for k in range(n):
        at = start + int(span * (k + 0.5) / n)
        for f in media.read_video_frames(src, at, 100, max_side):
            out.append(f.copy())
            break
    if not out:
        raise media.MediaError("video has no decodable frames")
    return out


def _fit(f: np.ndarray, side: int) -> np.ndarray:
    h, w = f.shape[:2]
    s = side / max(h, w)
    return cv2.resize(f, (round(w * s), round(h * s)), interpolation=cv2.INTER_AREA) if s < 1 else f


def _video_mime(fmt: str) -> str:
    return {"mp4": "video/mp4", "mov": "video/quicktime", "gif": "image/gif"}[fmt]
