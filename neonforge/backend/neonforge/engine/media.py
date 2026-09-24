"""Media I/O: image decode/encode, GIF frames and FFmpeg-backed video read/write.

Frames are handled as ``numpy.uint8`` arrays in RGB (H, W, 3) or RGBA (H, W, 4).
"""

from __future__ import annotations

import html
import io
import json
import os
import re
import subprocess
import warnings
from collections.abc import Iterator
from dataclasses import dataclass, field
from pathlib import Path

# imageio-ffmpeg otherwise spawns FFmpeg with preexec_fn=os.setpgrp, which forces fork() and runs Python
# in the child. Once MediaPipe/ONNX threads exist, that child can deadlock on a lock held by another
# thread (imageio-ffmpeg issue #58). Without preexec_fn, CPython uses vfork/exec, which is safe.
os.environ.setdefault("IMAGEIO_FFMPEG_NO_PREVENT_SIGINT", "1")

import imageio_ffmpeg  # noqa: E402
import numpy as np
from PIL import Image, ImageCms, ImageOps

Image.MAX_IMAGE_PIXELS = 120_000_000  # decompression-bomb guard (~11k x 11k)

IMAGE_MIME = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
GIF_MIME = {"image/gif": "gif"}
VIDEO_MIME = {"video/mp4": "mp4", "video/quicktime": "mov", "video/x-msvideo": "avi", "video/avi": "avi"}
EXT_KIND = {
    "jpg": "image", "jpeg": "image", "png": "image", "webp": "image",
    "gif": "gif",
    "mp4": "video", "mov": "video", "avi": "video",
}


class MediaError(ValueError):
    """Input could not be decoded or is not a supported format."""


def ffmpeg_exe() -> str:
    return imageio_ffmpeg.get_ffmpeg_exe()


def sniff_kind(head: bytes, filename: str) -> tuple[str, str]:
    """Return (kind, mime) from magic bytes; the filename extension is only a tie-breaker."""
    if head.startswith(b"\xff\xd8\xff"):
        return "image", "image/jpeg"
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image", "image/png"
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "image", "image/webp"
    if head[:6] in (b"GIF87a", b"GIF89a"):
        return "gif", "image/gif"
    if head[:4] == b"RIFF" and head[8:12] == b"AVI ":
        return "video", "video/x-msvideo"
    if head[4:8] == b"ftyp":
        brand = head[8:12]
        if brand == b"qt  " or filename.lower().endswith(".mov"):
            return "video", "video/quicktime"
        return "video", "video/mp4"
    if head[4:8] in (b"moov", b"mdat", b"wide", b"free") and filename.lower().endswith(".mov"):
        return "video", "video/quicktime"
    raise MediaError("unsupported file type (allowed: JPG, PNG, WEBP, GIF, MP4, MOV, AVI)")


# ---------------------------------------------------------------- images


def _to_srgb(im: Image.Image) -> Image.Image:
    icc = im.info.get("icc_profile")
    if not icc:
        return im
    try:
        src = ImageCms.ImageCmsProfile(io.BytesIO(icc))
        dst = ImageCms.createProfile("sRGB")
        mode = "RGBA" if im.mode == "RGBA" else "RGB"
        return ImageCms.profileToProfile(im.convert(mode), src, dst, outputMode=mode)
    except Exception:  # noqa: BLE001 - broken profiles are common; fall back to raw values
        return im


def load_image(path: Path) -> np.ndarray:
    try:
        with Image.open(path) as im:
            im = ImageOps.exif_transpose(im)
            im = _to_srgb(im)
            has_alpha = im.mode in ("RGBA", "LA", "PA") or (im.mode == "P" and "transparency" in im.info)
            im = im.convert("RGBA" if has_alpha else "RGB")
            arr = np.asarray(im).copy()
    except (OSError, Image.DecompressionBombError) as e:
        raise MediaError(f"cannot decode image: {e}") from e
    if arr.ndim == 3 and arr.shape[2] == 4 and arr[..., 3].min() == 255:
        arr = arr[..., :3].copy()
    return arr


def encode_image(arr: np.ndarray, fmt: str, quality: str = "balanced", xmp: bytes | None = None) -> bytes:
    q = {"small": 72, "balanced": 88, "max": 95}[quality]
    im = Image.fromarray(arr)
    buf = io.BytesIO()
    if fmt == "jpg":
        if im.mode == "RGBA":
            im = flatten_alpha(arr, (255, 255, 255))
            im = Image.fromarray(im)
        kw: dict = {"quality": q, "optimize": True, "progressive": True}
        kw["subsampling"] = 0 if quality == "max" else 2
        if xmp:
            kw["xmp"] = xmp
        im.save(buf, "JPEG", **kw)
    elif fmt == "png":
        from PIL import PngImagePlugin

        info = PngImagePlugin.PngInfo()
        if xmp:
            info.add_itxt("XML:com.adobe.xmp", xmp.decode())
        im.save(buf, "PNG", optimize=quality != "max", pnginfo=info)
    elif fmt == "webp":
        kw = {"quality": q, "method": 4}
        if xmp:
            kw["xmp"] = xmp
        im.save(buf, "WEBP", **kw)
    else:
        raise ValueError(f"unsupported image format {fmt}")
    return buf.getvalue()


def flatten_alpha(arr: np.ndarray, color: tuple[int, int, int]) -> np.ndarray:
    if arr.shape[2] != 4:
        return arr
    a = arr[..., 3:4].astype(np.float32) / 255.0
    bg = np.empty_like(arr[..., :3], dtype=np.float32)
    bg[:] = color
    out = arr[..., :3].astype(np.float32) * a + bg * (1 - a)
    return np.clip(out + 0.5, 0, 255).astype(np.uint8)


def thumbnail_jpeg(arr: np.ndarray, size: int = 384) -> bytes:
    im = Image.fromarray(flatten_alpha(arr, (18, 22, 30)) if arr.shape[2] == 4 else arr)
    im.thumbnail((size, size), Image.Resampling.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=80)
    return buf.getvalue()


# ---------------------------------------------------------------- GIF


@dataclass
class GifData:
    frames: list[np.ndarray]
    durations_ms: list[int]
    loop: int = 0


def load_gif(path: Path, max_frames: int = 600) -> GifData:
    frames: list[np.ndarray] = []
    durations: list[int] = []
    try:
        with Image.open(path) as im:
            loop = int(im.info.get("loop", 0))
            for i in range(getattr(im, "n_frames", 1)):
                if i >= max_frames:
                    break
                im.seek(i)
                frames.append(np.asarray(im.convert("RGB")).copy())
                durations.append(int(im.info.get("duration", 100)) or 100)
    except OSError as e:
        raise MediaError(f"cannot decode GIF: {e}") from e
    if not frames:
        raise MediaError("GIF has no frames")
    return GifData(frames, durations, loop)


def encode_gif(frames: list[np.ndarray], durations_ms: list[int], loop: int = 0, max_side: int = 800) -> bytes:
    """Encode with ONE global palette built from sampled frames → no palette flicker between frames.

    Long clips skip error-diffusion dithering: dither noise changes every frame, which defeats
    Pillow's inter-frame optimisation and makes files 3-5x larger.
    """
    ims = [Image.fromarray(flatten_alpha(f, (255, 255, 255)) if f.shape[2] == 4 else f) for f in frames]
    w, h = ims[0].size
    scale = min(1.0, max_side / max(w, h))
    if scale < 1.0:
        size = (max(1, round(w * scale)), max(1, round(h * scale)))
        ims = [im.resize(size, Image.Resampling.LANCZOS) for im in ims]
        w, h = size
    step = max(1, len(ims) // 16)
    samples = ims[::step][:16]
    sheet = Image.new("RGB", (w, h * len(samples)))
    for i, im in enumerate(samples):
        sheet.paste(im, (0, i * h))
    palette = sheet.quantize(colors=256, method=Image.Quantize.MEDIANCUT)
    dither = Image.Dither.FLOYDSTEINBERG if len(ims) <= 24 else Image.Dither.NONE
    q = [im.quantize(palette=palette, dither=dither) for im in ims]
    buf = io.BytesIO()
    q[0].save(buf, "GIF", save_all=True, append_images=q[1:], duration=durations_ms, loop=loop, optimize=True)
    return buf.getvalue()


# ---------------------------------------------------------------- video


@dataclass
class VideoInfo:
    width: int
    height: int
    fps: float
    duration_ms: int
    frame_count: int
    has_audio: bool
    rotation: int = 0
    codec: str | None = None
    extra: dict = field(default_factory=dict)


def probe_video(path: Path) -> VideoInfo:
    """Parse ``ffmpeg -i`` output (the bundled static FFmpeg ships without ffprobe)."""
    proc = subprocess.run([ffmpeg_exe(), "-hide_banner", "-i", str(path)], capture_output=True, text=True,
                          timeout=60)
    err = proc.stderr
    m = re.search(r"Stream #\S+.*?: Video: (\w+).*?, (\d{2,5})x(\d{2,5})", err)
    if not m:
        raise MediaError("no video stream found")
    codec, w, h = m.group(1), int(m.group(2)), int(m.group(3))
    fps_m = re.search(r"([\d.]+) fps", err) or re.search(r"([\d.]+) tbr", err)
    fps = float(fps_m.group(1)) if fps_m else 30.0
    d = re.search(r"Duration: (\d+):(\d+):([\d.]+)", err)
    duration_ms = int((int(d.group(1)) * 3600 + int(d.group(2)) * 60 + float(d.group(3))) * 1000) if d else 0
    rot_m = re.search(r"rotate\s*:\s*(-?\d+)", err) or re.search(r"rotation of (-?[\d.]+) degrees", err)
    rotation = int(float(rot_m.group(1))) % 360 if rot_m else 0
    if rotation in (90, 270):
        w, h = h, w
    has_audio = bool(re.search(r"Stream #\S+.*?: Audio:", err))
    return VideoInfo(w, h, fps, duration_ms, max(1, round(duration_ms / 1000 * fps)), has_audio, rotation, codec)


def read_video_frames(path: Path, start_ms: int = 0, duration_ms: int | None = None,
                      max_side: int | None = None) -> Iterator[np.ndarray]:
    """Yield RGB frames (FFmpeg applies container rotation automatically)."""
    input_params = ["-ss", f"{start_ms / 1000:.3f}"] if start_ms else None
    output_params: list[str] = []
    if duration_ms:
        output_params += ["-t", f"{duration_ms / 1000:.3f}"]
    if max_side:
        output_params += ["-vf", f"scale='min({max_side},iw)':'min({max_side},ih)':force_original_aspect_ratio=decrease"
                                 ":force_divisible_by=2"]
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")  # imageio-ffmpeg warns when the scale filter changes frame size
        gen = imageio_ffmpeg.read_frames(str(path), input_params=input_params, output_params=output_params or None)
        meta = next(gen)
    w, h = meta["size"]
    try:
        for raw in gen:
            yield np.frombuffer(raw, dtype=np.uint8).reshape(h, w, 3)
    finally:
        gen.close()


class VideoWriter:
    """H.264 writer; muxes the source audio track when given."""

    def __init__(self, path: Path, width: int, height: int, fps: float, fmt: str = "mp4",
                 quality: str = "balanced", audio_from: Path | None = None,
                 audio_start_ms: int = 0, audio_duration_ms: int | None = None) -> None:
        self.path = path
        crf = {"small": 28, "balanced": 22, "max": 17}[quality]
        output_params = ["-crf", str(crf), "-preset", "medium"]
        if fmt == "mp4":
            output_params += ["-movflags", "+faststart"]
        audio_path = None
        if audio_from is not None:
            audio_path = str(audio_from)
            if audio_start_ms or audio_duration_ms:
                # write_frames maps audio from the start of audio_path; trim via a temp AAC file instead
                audio_path = str(_extract_audio(audio_from, path.with_suffix(".aac"), audio_start_ms,
                                                audio_duration_ms))
        self._gen = imageio_ffmpeg.write_frames(
            str(path), (width, height), fps=fps, codec="libx264", quality=None, macro_block_size=2,
            output_params=output_params, audio_path=audio_path, audio_codec="aac" if audio_path else None,
            ffmpeg_log_level="error",
        )
        self._gen.send(None)
        self.size = (width, height)

    def write(self, frame: np.ndarray) -> None:
        if frame.shape[2] == 4:
            frame = flatten_alpha(frame, (0, 0, 0))
        if (frame.shape[1], frame.shape[0]) != self.size:
            raise ValueError("frame size changed mid-stream")
        self._gen.send(np.ascontiguousarray(frame))

    def close(self) -> None:
        self._gen.close()


def _extract_audio(src: Path, dest: Path, start_ms: int, duration_ms: int | None) -> Path:
    cmd = [ffmpeg_exe(), "-y", "-loglevel", "error", "-ss", f"{start_ms / 1000:.3f}", "-i", str(src)]
    if duration_ms:
        cmd += ["-t", f"{duration_ms / 1000:.3f}"]
    cmd += ["-vn", "-c:a", "aac", "-b:a", "192k", str(dest)]
    subprocess.run(cmd, check=True, capture_output=True, timeout=600)
    return dest


def video_to_gif_frames(frames: list[np.ndarray], src_fps: float, gif_fps: int) -> tuple[list[np.ndarray], int]:
    step = max(1, round(src_fps / gif_fps))
    out = frames[::step]
    return out, max(20, round(1000 * step / src_fps))


def extract_thumb_frame(path: Path, at_ms: int = 0) -> np.ndarray:
    for frame in read_video_frames(path, start_ms=at_ms, duration_ms=200):
        return frame.copy()
    for frame in read_video_frames(path):
        return frame.copy()
    raise MediaError("video has no decodable frames")


def xmp_packet(provenance: dict) -> bytes:
    """Minimal XMP marking the file as AI-edited (IPTC digital source type).

    Full C2PA signing (c2pa-python + signing certificate) replaces this before launch (spec §10).
    """
    desc = html.escape(json.dumps(provenance, separators=(",", ":")), quote=True)
    return (
        '<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>'
        '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">'
        '<rdf:Description rdf:about="" xmlns:Iptc4xmpExt="http://iptc.org/std/Iptc4xmpExt/2008-02-29/"'
        ' xmlns:xmp="http://ns.adobe.com/xap/1.0/" xmlns:nf="https://neonforge.ai/ns/1.0/"'
        ' Iptc4xmpExt:DigitalSourceType='
        '"http://cv.iptc.org/newscodes/digitalsourcetype/compositeWithTrainedAlgorithmicMedia"'
        ' xmp:CreatorTool="NeonForge AI"'
        f' nf:edits="{desc}"/>'
        '</rdf:RDF></x:xmpmeta><?xpacket end="w"?>'
    ).encode()
