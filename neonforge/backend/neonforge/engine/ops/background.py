"""Background remove / replace / bokeh blur."""

from __future__ import annotations

import cv2
import numpy as np

from ..adapters import segment
from .base import Op, split_alpha, to_f32, to_u8


def hex_rgb(s: str) -> tuple[int, int, int]:
    s = s.lstrip("#")
    if len(s) == 3:
        s = "".join(c * 2 for c in s)
    if len(s) != 6:
        raise ValueError(f"bad colour '{s}'")
    return int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16)


def render_preset(payload: dict, w: int, h: int) -> np.ndarray:
    """Procedural backdrop (solid / linear / radial gradient)."""
    colors = np.array([hex_rgb(c) for c in payload["colors"]], np.float32) / 255.0
    kind = payload.get("kind", "solid")
    if kind == "solid" or len(colors) == 1:
        img = np.empty((h, w, 3), np.float32)
        img[:] = colors[0]
        return to_u8(img)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    if kind == "radial":
        cx, cy = w / 2, h * 0.42
        t = np.sqrt(((xx - cx) / w) ** 2 + ((yy - cy) / h) ** 2) / 0.75
    else:
        ang = np.deg2rad(payload.get("angle", 180))
        dx, dy = np.sin(ang), -np.cos(ang)
        t = ((xx / w - 0.5) * dx + (yy / h - 0.5) * dy) / (abs(dx) * 0.5 + abs(dy) * 0.5) * 0.5 + 0.5
    t = np.clip(t, 0, 1)
    seg = t * (len(colors) - 1)
    i = np.minimum(seg.astype(np.int32), len(colors) - 2)
    frac = (seg - i)[..., None]
    img = colors[i] * (1 - frac) + colors[i + 1] * frac
    # subtle dither prevents banding in 8-bit gradients
    img += (np.random.default_rng(7).random((h, w, 1), dtype=np.float32) - 0.5) / 255.0
    return to_u8(img)


def cover_fit(img: np.ndarray, w: int, h: int) -> np.ndarray:
    ih, iw = img.shape[:2]
    s = max(w / iw, h / ih)
    rw, rh = max(w, round(iw * s)), max(h, round(ih * s))
    r = cv2.resize(img[..., :3], (rw, rh), interpolation=cv2.INTER_AREA if s < 1 else cv2.INTER_CUBIC)
    x0, y0 = (rw - w) // 2, (rh - h) // 2
    return r[y0:y0 + h, x0:x0 + w]


def disc_kernel(r: int) -> np.ndarray:
    k = np.zeros((2 * r + 1, 2 * r + 1), np.float32)
    cv2.circle(k, (r, r), r, 1.0, -1, lineType=cv2.LINE_AA)
    return k / k.sum()


class Background(Op):
    name = "background"
    label = "Editing background"

    def setup(self, samples: list[np.ndarray]) -> None:
        self._prev_alpha: np.ndarray | None = None
        self._bg_cache: dict[tuple[int, int], np.ndarray] = {}
        faces = int(self.env.analysis.get("face_count", 0)) > 0
        self._faces = faces
        p = self.p
        if p["mode"] == "replace":
            if p["source"] == "preset":
                pid = p["preset_id"] or "background.studio_white"
                if pid not in self.env.presets:
                    raise ValueError(f"unknown background preset '{pid}'")
                self._bg_payload = self.env.presets[pid]
            elif p["source"] == "upload":
                if not p["image_file_id"] or self.env.load_file_image is None:
                    raise ValueError("background replace needs image_file_id")
                self._bg_upload = self.env.load_file_image(p["image_file_id"])
            else:
                self._bg_payload = {"kind": "solid", "colors": [p["color"]]}

    def _alpha(self, rgb: np.ndarray) -> np.ndarray:
        alpha, model_id = segment.foreground_alpha(rgb, self._faces, refine=self.p["edge_refine"])
        self.use(model_id)
        if self.env.temporal:
            # temporal EMA on the matte suppresses edge flicker between frames
            if self._prev_alpha is not None and self._prev_alpha.shape == alpha.shape:
                alpha = alpha * 0.65 + self._prev_alpha * 0.35
            self._prev_alpha = alpha
        return alpha

    def _backdrop(self, w: int, h: int) -> np.ndarray:
        if (w, h) not in self._bg_cache:
            if hasattr(self, "_bg_upload"):
                self._bg_cache[(w, h)] = cover_fit(self._bg_upload, w, h)
            else:
                self._bg_cache[(w, h)] = render_preset(self._bg_payload, w, h)
        return self._bg_cache[(w, h)]

    def apply(self, frame: np.ndarray, index: int) -> np.ndarray:
        rgb, existing = split_alpha(frame)
        alpha = self._alpha(rgb)
        if existing is not None:
            alpha = np.minimum(alpha, existing.astype(np.float32) / 255.0)
        p = self.p
        h, w = rgb.shape[:2]
        if p["mode"] == "remove":
            if p["fill"] == "transparent" and not self.env.temporal:
                return np.dstack([rgb, to_u8(alpha)])
            color = (255, 255, 255) if p["fill"] == "white" or p["fill"] == "transparent" else hex_rgb(p["color"])
            bg = np.empty_like(rgb)
            bg[:] = color
            return _composite(rgb, bg, alpha, light_wrap=0.0)
        if p["mode"] == "replace":
            return _composite(rgb, self._backdrop(w, h), alpha, light_wrap=0.25, harmonize=0.12)
        # blur
        self.use("mask_bokeh")
        return _bokeh(rgb, alpha, p["aperture"])


def _composite(fg: np.ndarray, bg: np.ndarray, alpha: np.ndarray, light_wrap: float = 0.2,
               harmonize: float = 0.0) -> np.ndarray:
    f, b = to_f32(fg), to_f32(bg)
    a = alpha[..., None]
    if harmonize > 0:
        # nudge subject colour statistics toward the new scene so it doesn't look pasted on
        fm = (f * a).sum((0, 1)) / max(float(a.sum()), 1.0)
        bm = b.mean((0, 1))
        f = np.clip(f + (bm - fm) * harmonize, 0, 1)
    out = f * a + b * (1 - a)
    if light_wrap > 0:
        r = max(3, int(min(fg.shape[:2]) / 120))
        edge = np.clip(cv2.GaussianBlur(1 - alpha, (0, 0), r) * alpha, 0, 1)[..., None]
        out = out + cv2.GaussianBlur(b, (0, 0), r) * edge * light_wrap
    return to_u8(out)


def _bokeh(rgb: np.ndarray, alpha: np.ndarray, aperture: float) -> np.ndarray:
    h, w = rgb.shape[:2]
    radius = max(2.0, min(h, w) / (aperture * 9.0))
    # work at reduced scale for large radii: defocus blur has no fine detail anyway
    s = min(1.0, 10.0 / radius)
    sw, sh = max(8, round(w * s)), max(8, round(h * s))
    r = max(1, int(round(radius * s)))
    lin = np.power(to_f32(cv2.resize(rgb, (sw, sh), interpolation=cv2.INTER_AREA)), 2.2)
    a_small = cv2.resize(alpha, (sw, sh), interpolation=cv2.INTER_AREA)
    # dilate the subject hole, then normalized convolution so the subject doesn't bleed into the blur
    hole = cv2.dilate(a_small, np.ones((3, 3), np.uint8), iterations=max(1, r // 3))
    wbg = (1 - hole)[..., None]
    k = disc_kernel(r)
    num = cv2.filter2D(lin * wbg, -1, k, borderType=cv2.BORDER_REFLECT)
    den = cv2.filter2D(wbg, -1, k, borderType=cv2.BORDER_REFLECT)[..., None]
    fallback = cv2.GaussianBlur(lin, (0, 0), r)
    blurred = np.where(den > 1e-3, num / np.maximum(den, 1e-3), fallback)
    # highlight bloom: bright points expand into bokeh discs
    blurred = blurred * (1 + 0.35 * np.clip(blurred.max(axis=2, keepdims=True) - 0.7, 0, 1))
    blurred = np.power(np.clip(blurred, 0, 1), 1 / 2.2)
    blurred_full = cv2.resize(blurred.astype(np.float32), (w, h), interpolation=cv2.INTER_CUBIC)
    a = alpha[..., None]
    return to_u8(to_f32(rgb) * a + np.clip(blurred_full, 0, 1) * (1 - a))
