"""Face retouch (skin smoothing, blemish removal, eye enhancement) and face-detail restoration.

Everything works on an expanded crop around each selected face, so cost scales with face size rather
than image size. Skin masks come from the person-part segmenter when installed. Otherwise they come
from the landmark face oval minus eyes/brows/lips.
"""

from __future__ import annotations

import cv2
import numpy as np

from ..adapters import face as fa
from ..adapters import segment
from .base import Op, merge_alpha, split_alpha


class _FaceOp(Op):
    def setup(self, samples: list[np.ndarray]) -> None:
        self.use(fa.backend_name())
        self._prev: list[fa.Face] = []

    def faces(self, rgb: np.ndarray) -> list[fa.Face]:
        faces = fa.select_faces(fa.detect_faces(rgb, landmarks=True), self.p["faces"])
        if self.env.temporal and self._prev and faces:
            faces = [_smooth_face(f, self._prev) for f in faces]
        self._prev = faces
        return faces


def _smooth_face(f: fa.Face, prev: list[fa.Face]) -> fa.Face:
    """Temporal landmark smoothing: blend with the nearest previous-frame face to remove jitter."""
    cx, cy = f.box[0] + f.box[2] / 2, f.box[1] + f.box[3] / 2
    best = min(prev, key=lambda p: (p.box[0] + p.box[2] / 2 - cx) ** 2 + (p.box[1] + p.box[3] / 2 - cy) ** 2)
    if abs(best.box[2] - f.box[2]) > 0.3 * f.box[2]:
        return f
    lm = f.landmarks
    if lm is not None and best.landmarks is not None and best.landmarks.shape == lm.shape:
        lm = lm * 0.6 + best.landmarks * 0.4
    box = tuple(int(round(a * 0.6 + b * 0.4)) for a, b in zip(f.box, best.box, strict=True))
    return fa.Face(box, f.score, lm)  # type: ignore[arg-type]


def _crop_bounds(face: fa.Face, shape: tuple[int, ...], pad: float = 0.35) -> tuple[int, int, int, int]:
    x, y, w, h = face.box
    px, py = int(w * pad), int(h * pad)
    return max(0, x - px), max(0, y - py), min(shape[1], x + w + px), min(shape[0], y + h + py)


def _skin_mask(crop: np.ndarray, face: fa.Face, x0: int, y0: int) -> np.ndarray:
    h, w = crop.shape[:2]
    local = _shift(face, x0, y0)
    mask: np.ndarray | None = None
    if segment.has_model("selfie_multiclass.tflite"):
        parts = segment.person_parts(crop)
        mask = np.clip(parts.face_skin * 1.2, 0, 1)
        if local.landmarks is not None:
            mask *= fa.region_mask((h, w), local, fa.FACE_OVAL, dilate=max(3, w // 20))
    elif local.landmarks is not None:
        mask = fa.region_mask((h, w), local, fa.FACE_OVAL)
    else:
        mask = np.zeros((h, w), np.float32)
        fx, fy, fw, fh = local.box
        cv2.ellipse(mask, (fx + fw // 2, fy + fh // 2), (int(fw * 0.42), int(fh * 0.5)), 0, 0, 360, 1.0, -1)
    if local.landmarks is not None:
        d = max(3, w // 40)
        for idx in (fa.LEFT_EYE, fa.RIGHT_EYE, fa.LIPS, fa.LEFT_BROW, fa.RIGHT_BROW):
            mask *= 1.0 - fa.region_mask((h, w), local, idx, dilate=d)
    feather = max(3, (w // 30) | 1)
    return cv2.GaussianBlur(mask, (feather, feather), 0)


def _shift(face: fa.Face, x0: int, y0: int) -> fa.Face:
    x, y, w, h = face.box
    lm = face.landmarks - np.array([x0, y0], np.float32) if face.landmarks is not None else None
    return fa.Face((x - x0, y - y0, w, h), face.score, lm)


class FaceRetouch(_FaceOp):
    name = "face_retouch"
    label = "Retouching faces"

    def setup(self, samples: list[np.ndarray]) -> None:
        super().setup(samples)
        self.use("frequency_separation")
        if self.p["blemish"]:
            self.use("telea_inpaint")
        if segment.has_model("selfie_multiclass.tflite"):
            self.use("mediapipe_selfie_multiclass")

    def apply(self, frame: np.ndarray, index: int) -> np.ndarray:
        rgb, alpha = split_alpha(frame)
        out = rgb.copy()
        for face in self.faces(rgb):
            x0, y0, x1, y1 = _crop_bounds(face, rgb.shape)
            crop = out[y0:y1, x0:x1]
            if crop.size == 0:
                continue
            mask = _skin_mask(crop, face, x0, y0)
            fw = face.box[2]
            if self.p["blemish"] and not self.env.temporal:
                crop = _remove_blemishes(crop, mask, fw)
            if self.p["smooth"]:
                crop = _smooth_skin(crop, mask, self.p["smooth"] / 100.0, fw)
            if self.p["eyes"] and face.landmarks is not None:
                crop = _enhance_eyes(crop, _shift(face, x0, y0), self.p["eyes"] / 100.0)
            out[y0:y1, x0:x1] = crop
        return merge_alpha(out, alpha)


def _smooth_skin(crop: np.ndarray, mask: np.ndarray, amount: float, face_w: int) -> np.ndarray:
    """Frequency separation: smooth the low-frequency tone, then add back a share of fine texture."""
    f = crop.astype(np.float32)
    d = int(np.clip(face_w / 25, 5, 25))
    smooth = cv2.bilateralFilter(crop, d, 20 + 40 * amount, d).astype(np.float32)
    fine = f - cv2.GaussianBlur(f, (0, 0), max(0.8, face_w / 400))
    result = smooth + fine * (0.75 - 0.35 * amount)
    m = (mask * min(1.0, amount * 1.3))[..., None]
    return np.clip(f + (result - f) * m, 0, 255).astype(np.uint8)


def _remove_blemishes(crop: np.ndarray, mask: np.ndarray, face_w: int) -> np.ndarray:
    lab = cv2.cvtColor(crop, cv2.COLOR_RGB2LAB)
    L = lab[..., 0]
    k = int(np.clip(face_w / 18, 5, 41)) | 1
    background = cv2.medianBlur(L, k).astype(np.int16)
    # blemishes: small spots darker (or redder) than their surroundings, inside skin only
    dark = (background - L.astype(np.int16)) > 10
    red = (lab[..., 1].astype(np.int16) - cv2.medianBlur(lab[..., 1], k).astype(np.int16)) > 7
    cand = ((dark | red) & (mask > 0.6)).astype(np.uint8)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(cand, 8)
    max_area = (face_w / 22) ** 2
    spots = np.zeros_like(cand)
    for i in range(1, n):
        area = stats[i, cv2.CC_STAT_AREA]
        if 2 <= area <= max_area:
            spots[labels == i] = 255
    if not spots.any():
        return crop
    spots = cv2.dilate(spots, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    return cv2.inpaint(crop, spots, max(3, face_w // 80), cv2.INPAINT_TELEA)


def _enhance_eyes(crop: np.ndarray, face: fa.Face, amount: float) -> np.ndarray:
    h, w = crop.shape[:2]
    d = max(3, face.box[2] // 30)
    eyes = np.clip(fa.region_mask((h, w), face, fa.LEFT_EYE, d) + fa.region_mask((h, w), face, fa.RIGHT_EYE, d), 0, 1)
    if not eyes.any():
        return crop
    eyes = cv2.GaussianBlur(eyes, (0, 0), max(1.0, d / 2))
    lab = cv2.cvtColor(crop, cv2.COLOR_RGB2LAB).astype(np.float32)
    L = lab[..., 0]
    sharp = L + (L - cv2.GaussianBlur(L, (0, 0), 1.2)) * 1.2
    bright = sharp * (1 + 0.12 * amount) + 4 * amount
    lab[..., 0] = L + (np.clip(bright, 0, 255) - L) * eyes * amount
    return cv2.cvtColor(np.clip(lab, 0, 255).astype(np.uint8), cv2.COLOR_LAB2RGB)


class FaceRestore(_FaceOp):
    """Face-detail restoration.

    This build uses a classical path: denoise, detail recovery and local contrast on the face crop.
    GFPGAN (Apache-2.0) is the production model on GPU workers (spec §6.2) and plugs in here as an
    adapter once the torch worker image ships.
    """

    name = "face_restore"
    label = "Restoring faces"

    def setup(self, samples: list[np.ndarray]) -> None:
        super().setup(samples)
        self.use("classical_face_detail")

    def apply(self, frame: np.ndarray, index: int) -> np.ndarray:
        rgb, alpha = split_alpha(frame)
        out = rgb.copy()
        strength = 1.0 - 0.6 * self.p["fidelity"]
        for face in self.faces(rgb):
            x0, y0, x1, y1 = _crop_bounds(face, rgb.shape, pad=0.2)
            crop = out[y0:y1, x0:x1]
            if crop.size == 0 or min(crop.shape[:2]) < 16:
                continue
            fw = face.box[2]
            den = cv2.fastNlMeansDenoisingColored(crop, None, 4 + 4 * strength, 4 + 4 * strength, 5, 13) \
                if not self.env.temporal else cv2.bilateralFilter(crop, 5, 25, 5)
            lab = cv2.cvtColor(den, cv2.COLOR_RGB2LAB)
            clahe = cv2.createCLAHE(clipLimit=1.5 + strength, tileGridSize=(4, 4))
            L = lab[..., 0].astype(np.float32)
            Lc = clahe.apply(lab[..., 0]).astype(np.float32)
            L = L + (Lc - L) * 0.5 * strength
            L = L + (L - cv2.GaussianBlur(L, (0, 0), max(1.0, fw / 150))) * (0.8 + strength)
            lab[..., 0] = np.clip(L, 0, 255).astype(np.uint8)
            restored = cv2.cvtColor(lab, cv2.COLOR_LAB2RGB)
            # feathered elliptical blend so the crop edge never shows
            m = np.zeros(crop.shape[:2], np.float32)
            lx, ly = face.box[0] - x0, face.box[1] - y0
            cv2.ellipse(m, (lx + face.box[2] // 2, ly + face.box[3] // 2),
                        (int(face.box[2] * 0.55), int(face.box[3] * 0.62)), 0, 0, 360, 1.0, -1)
            m = cv2.GaussianBlur(m, (0, 0), max(2.0, fw / 14))[..., None]
            out[y0:y1, x0:x1] = np.clip(crop * (1 - m) + restored * m, 0, 255).astype(np.uint8)
        return merge_alpha(out, alpha)
