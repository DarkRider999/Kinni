"""Auto-enhance, HDR and colour grading.

For video/GIF, all image statistics (levels, white balance, noise) are measured ONCE across sampled
frames in ``setup`` and then applied identically per frame. That's what keeps output flicker-free.
"""

from __future__ import annotations

import cv2
import numpy as np

from ..analysis import estimate_noise_sigma
from .base import Op, merge_alpha, split_alpha, to_f32, to_u8


class Enhance(Op):
    name = "enhance"
    label = "Enhancing"

    def setup(self, samples: list[np.ndarray]) -> None:
        rgbs = [split_alpha(s)[0] for s in samples]
        labs = [cv2.cvtColor(_small(r), cv2.COLOR_RGB2LAB).reshape(-1, 3).astype(np.float32) for r in rgbs]
        lab = np.concatenate(labs)
        self.lo, self.hi = np.percentile(lab[:, 0], [0.5, 99.5])
        self.a_cast = float(np.median(lab[:, 1]) - 128)
        self.b_cast = float(np.median(lab[:, 2]) - 128)
        self.noise = float(np.mean([estimate_noise_sigma(_small(r)) for r in rgbs]))
        self.mean_l = float(lab[:, 0].mean())
        self.use("classical_denoise" if self.p["denoise"] else "classical_tone")
        self.use("adaptive_tone_curve")

    def apply(self, frame: np.ndarray, index: int) -> np.ndarray:
        p = self.p
        rgb, alpha = split_alpha(frame)
        k = p["strength"] / 100.0

        # 1. denoise, scaled by measured noise so clean images aren't smeared
        if p["denoise"] and self.noise > 1.5:
            h = min(12.0, self.noise * 1.4) * p["denoise"] / 60.0
            if h > 0.8:
                if self.env.temporal or rgb.shape[0] * rgb.shape[1] > 16e6 or self.env.lane == "fast":
                    d = 7 if rgb.shape[0] * rgb.shape[1] < 4e6 else 9
                    rgb = cv2.bilateralFilter(rgb, d, h * 4, d)
                else:
                    rgb = cv2.fastNlMeansDenoisingColored(rgb, None, h, h * 1.1, 5, 17)

        lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB).astype(np.float32)
        L = lab[..., 0]

        if p["auto"]:
            # 2. white balance: pull the dominant cast toward neutral (strong casts are likely intentional)
            if p["white_balance"]:
                cast = np.hypot(self.a_cast, self.b_cast)
                if 1.5 < cast < 25:
                    lab[..., 1] -= self.a_cast * 0.7 * k
                    lab[..., 2] -= self.b_cast * 0.7 * k
            # 3. levels: stretch 0.5..99.5 percentile of luminance
            lo, hi = float(self.lo), float(self.hi)
            if hi - lo > 20:
                stretched = (L - lo) * (255.0 / (hi - lo))
                L = L + (np.clip(stretched, 0, 255) - L) * 0.8 * k
            # 4. midtone lift for dark images, gentle compression for bright ones
            gamma = np.clip(np.log(0.5) / np.log(max(self.mean_l, 1) / 255.0), 0.7, 1.4)
            gamma = 1 + (gamma - 1) * 0.5 * k
            L = 255.0 * np.power(np.clip(L / 255.0, 0, 1), 1.0 / gamma)

        # 5. manual exposure / contrast
        if p["exposure"]:
            L = np.clip(L * (2.0 ** p["exposure"]), 0, 255)
        if p["contrast"]:
            c = p["contrast"] / 100.0
            x = L / 255.0
            L = 255.0 * np.clip(x + c * (x - 0.5) * (1 - np.abs(2 * x - 1)) * 1.2, 0, 1)

        # 6. clarity: local contrast via CLAHE, blended
        clarity = p["clarity"] / 100.0 * (1.0 if p["auto"] else 0.8)
        if clarity > 0:
            clahe = cv2.createCLAHE(clipLimit=1.0 + 2.0 * clarity, tileGridSize=(8, 8))
            local = clahe.apply(np.clip(L, 0, 255).astype(np.uint8)).astype(np.float32)
            L = L + (local - L) * clarity * 0.6

        # 7. sharpness: unsharp mask on luminance only (no colour fringing)
        sharp = p["sharpness"] / 100.0
        if sharp > 0:
            sigma = 1.0 + rgb.shape[1] / 4000
            L = L + (L - cv2.GaussianBlur(L, (0, 0), sigma)) * sharp * 1.1

        lab[..., 0] = np.clip(L, 0, 255)
        out = cv2.cvtColor(np.clip(lab, 0, 255).astype(np.uint8), cv2.COLOR_LAB2RGB)

        # 8. saturation / vibrance (vibrance protects already-saturated colours and skin)
        sat = p["saturation"] / 100.0 + (0.12 * k if p["auto"] else 0.0)
        if abs(sat) > 1e-3:
            hsv = cv2.cvtColor(out, cv2.COLOR_RGB2HSV).astype(np.float32)
            s = hsv[..., 1] / 255.0
            boost = sat * (1 - s) if sat > 0 else sat
            hsv[..., 1] = np.clip((s + s * boost) * 255.0, 0, 255)
            out = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2RGB)
        return merge_alpha(out, alpha)


class Hdr(Op):
    name = "hdr"
    label = "HDR tone mapping"

    def setup(self, samples: list[np.ndarray]) -> None:
        self.merge = cv2.createMergeMertens(contrast_weight=1.0, saturation_weight=1.0, exposure_weight=0.8)
        self.use("mertens_exposure_fusion")

    def apply(self, frame: np.ndarray, index: int) -> np.ndarray:
        rgb, alpha = split_alpha(frame)
        f = to_f32(rgb)
        lin = np.power(f, 2.2)
        brackets = [to_u8(np.power(np.clip(lin * (2.0**ev), 0, 1), 1 / 2.2)) for ev in (-1.6, 0.0, 1.4)]
        fused = np.clip(self.merge.process(brackets), 0, 1)
        # restore global contrast that fusion flattens, then blend by intensity
        lab = cv2.cvtColor(to_u8(fused), cv2.COLOR_RGB2LAB)
        clahe = cv2.createCLAHE(clipLimit=1.6, tileGridSize=(8, 8))
        lab[..., 0] = clahe.apply(lab[..., 0])
        hdr = to_f32(cv2.cvtColor(lab, cv2.COLOR_LAB2RGB))
        k = self.p["intensity"] / 100.0
        return merge_alpha(to_u8(f + (hdr - f) * k), alpha)


# ---------------------------------------------------------------- colour grading ("LUTs")


def _mix(f: np.ndarray, shadows: tuple, highlights: tuple, balance: float = 0.5) -> np.ndarray:
    lum = f @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    w_s = np.clip(1 - lum / balance, 0, 1)[..., None]
    w_h = np.clip((lum - balance) / (1 - balance), 0, 1)[..., None]
    return f + w_s * np.array(shadows, np.float32) + w_h * np.array(highlights, np.float32)


def _sat(f: np.ndarray, s: float) -> np.ndarray:
    lum = (f @ np.array([0.2126, 0.7152, 0.0722], np.float32))[..., None]
    return lum + (f - lum) * s


def _curve(f: np.ndarray, contrast: float, lift: float = 0.0, roll: float = 0.0) -> np.ndarray:
    x = np.clip(f, 0, 1)
    x = x + contrast * (x - 0.5) * (1 - np.abs(2 * x - 1))
    x = lift + x * (1 - lift - roll)
    return x


def grade(f: np.ndarray, lut: str) -> np.ndarray:
    if lut == "cinematic_teal_orange":
        g = _mix(f, (-0.04, 0.03, 0.07), (0.07, 0.02, -0.05), 0.45)
        return _curve(_sat(g, 1.08), 0.25, 0.02, 0.02)
    if lut == "film":
        g = _curve(_sat(f, 0.82), 0.12, 0.07, 0.05)
        return _mix(g, (0.01, 0.02, 0.03), (0.03, 0.015, -0.02))
    if lut == "noir":
        lum = f @ np.array([0.3, 0.59, 0.11], np.float32)
        return _curve(np.repeat(lum[..., None], 3, axis=2), 0.45, 0.01, 0.0)
    if lut == "vivid":
        return _curve(_sat(f, 1.35), 0.2)
    if lut == "warm":
        return _curve(f * np.array([1.07, 1.01, 0.9], np.float32), 0.08)
    if lut == "cool":
        return _curve(f * np.array([0.92, 1.0, 1.08], np.float32), 0.08)
    if lut == "neon":
        g = _mix(f, (0.08, -0.03, 0.1), (-0.04, 0.06, 0.08), 0.5)
        return _curve(_sat(g, 1.25), 0.3, 0.0, 0.03)
    raise ValueError(f"unknown LUT '{lut}'")


LUT_IDS = ["cinematic_teal_orange", "film", "noir", "vivid", "warm", "cool", "neon"]


class ColorGrade(Op):
    name = "color_grade"
    label = "Colour grading"

    def setup(self, samples: list[np.ndarray]) -> None:
        if self.p["lut"] not in LUT_IDS:
            raise ValueError(f"unknown LUT '{self.p['lut']}'")
        # Bake the grade into a 33³ 3D LUT once. Per-frame cost is then a lookup, identical on every frame.
        n = 33
        axis = np.linspace(0, 1, n, dtype=np.float32)
        r, g, b = np.meshgrid(axis, axis, axis, indexing="ij")
        grid = np.stack([r, g, b], axis=-1).reshape(-1, 1, 3)
        self.table = np.clip(grade(grid, self.p["lut"]), 0, 1).reshape(n, n, n, 3)
        self.use(f"lut3d:{self.p['lut']}")

    def apply(self, frame: np.ndarray, index: int) -> np.ndarray:
        rgb, alpha = split_alpha(frame)
        f = to_f32(rgb)
        graded = apply_lut3d(f, self.table)
        k = self.p["intensity"]
        return merge_alpha(to_u8(f + (graded - f) * k), alpha)


def apply_lut3d(f: np.ndarray, table: np.ndarray) -> np.ndarray:
    """Trilinear 3D-LUT lookup."""
    n = table.shape[0] - 1
    x = np.clip(f, 0, 1) * n
    i0 = np.floor(x).astype(np.int32)
    i0 = np.minimum(i0, n - 1)
    t = x - i0
    r0, g0, b0 = i0[..., 0], i0[..., 1], i0[..., 2]
    tr, tg, tb = t[..., 0:1], t[..., 1:2], t[..., 2:3]
    c = table
    c000 = c[r0, g0, b0]
    c100 = c[r0 + 1, g0, b0]
    c010 = c[r0, g0 + 1, b0]
    c110 = c[r0 + 1, g0 + 1, b0]
    c001 = c[r0, g0, b0 + 1]
    c101 = c[r0 + 1, g0, b0 + 1]
    c011 = c[r0, g0 + 1, b0 + 1]
    c111 = c[r0 + 1, g0 + 1, b0 + 1]
    c00 = c000 + (c100 - c000) * tr
    c10 = c010 + (c110 - c010) * tr
    c01 = c001 + (c101 - c001) * tr
    c11 = c011 + (c111 - c011) * tr
    c0 = c00 + (c10 - c00) * tg
    c1 = c01 + (c11 - c01) * tg
    return c0 + (c1 - c0) * tb


def _small(rgb: np.ndarray, side: int = 512) -> np.ndarray:
    h, w = rgb.shape[:2]
    s = side / max(h, w)
    return cv2.resize(rgb, (max(1, round(w * s)), max(1, round(h * s))), interpolation=cv2.INTER_AREA) if s < 1 \
        else rgb
