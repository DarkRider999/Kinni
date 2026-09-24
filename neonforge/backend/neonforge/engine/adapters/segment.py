"""Segmentation: people/parts (MediaPipe selfie multiclass) and salient-object matting (U²-Net).

Router rule (spec §6.3): portraits use the person segmenter, which also yields hair/skin/clothes parts;
everything else (products, pets, objects) uses U²-Net. Both are refined with a guided filter so hair
and soft edges keep detail.
"""

from __future__ import annotations

from dataclasses import dataclass

import cv2
import numpy as np

from . import ModelUnavailable, has_model, model_path, per_thread

# selfie_multiclass_256x256 categories
BG, HAIR, BODY_SKIN, FACE_SKIN, CLOTHES, OTHERS = range(6)


@dataclass
class PersonParts:
    person: np.ndarray  # float32 HxW 0..1 soft alpha
    face_skin: np.ndarray
    body_skin: np.ndarray
    hair: np.ndarray
    clothes: np.ndarray


def _segmenter():
    import mediapipe as mp
    from mediapipe.tasks.python import BaseOptions, vision

    opts = vision.ImageSegmenterOptions(
        base_options=BaseOptions(model_asset_path=str(model_path("selfie_multiclass.tflite"))),
        running_mode=vision.RunningMode.IMAGE, output_confidence_masks=True, output_category_mask=False,
    )
    return mp, vision.ImageSegmenter.create_from_options(opts)


def person_parts(rgb: np.ndarray) -> PersonParts:
    if not has_model("selfie_multiclass.tflite"):
        raise ModelUnavailable("person segmentation model not installed (run scripts/fetch_models.py)")
    mp, seg = per_thread("selfie_multiclass", _segmenter)
    rgb = np.ascontiguousarray(rgb[..., :3])
    res = seg.segment(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb))
    conf = [m.numpy_view().astype(np.float32).copy() for m in res.confidence_masks]
    h, w = rgb.shape[:2]
    conf = [cv2.resize(c, (w, h), interpolation=cv2.INTER_LINEAR) if c.shape != (h, w) else c for c in conf]
    person = np.clip(1.0 - conf[BG], 0, 1)
    return PersonParts(person, conf[FACE_SKIN], conf[BODY_SKIN], conf[HAIR], conf[CLOTHES])


def _u2net(name: str):
    import onnxruntime as ort

    so = ort.SessionOptions()
    so.intra_op_num_threads = 2
    return ort.InferenceSession(str(model_path(name)), so, providers=_providers())


def _providers() -> list[str]:
    import onnxruntime as ort

    avail = ort.get_available_providers()
    return [p for p in ("CUDAExecutionProvider", "CPUExecutionProvider") if p in avail]


def salient_alpha(rgb: np.ndarray) -> tuple[np.ndarray, str]:
    """Soft foreground alpha for the most salient object. Returns (alpha, model_id)."""
    candidates = (("isnet-general-use.onnx", 1024, "isnet_general"), ("u2netp.onnx", 320, "u2netp"))
    for name, size, model_id in candidates:  # noqa: B007 - the matching entry is used after the loop
        if has_model(name):
            break
    else:
        raise ModelUnavailable("salient-object model not installed (run scripts/fetch_models.py)")
    sess = per_thread(f"onnx:{name}", lambda: _u2net(name))
    h, w = rgb.shape[:2]
    x = cv2.resize(rgb[..., :3], (size, size), interpolation=cv2.INTER_AREA).astype(np.float32)
    x /= max(float(x.max()), 1e-6)
    if model_id == "u2netp":
        x = (x - np.array([0.485, 0.456, 0.406], np.float32)) / np.array([0.229, 0.224, 0.225], np.float32)
    else:
        x = x - 0.5
    x = x.transpose(2, 0, 1)[None]
    out = sess.run(None, {sess.get_inputs()[0].name: x})[0][0, 0]
    lo, hi = float(out.min()), float(out.max())
    out = (out - lo) / max(hi - lo, 1e-6)
    return cv2.resize(out.astype(np.float32), (w, h), interpolation=cv2.INTER_LINEAR), model_id


def guided_filter(guide: np.ndarray, src: np.ndarray, radius: int, eps: float) -> np.ndarray:
    """Fast grey-guide guided filter (He et al.). Edge-aware refinement of a soft mask."""
    I = cv2.cvtColor(guide[..., :3], cv2.COLOR_RGB2GRAY).astype(np.float32) / 255.0  # noqa: E741
    p = src.astype(np.float32)
    k = (2 * radius + 1, 2 * radius + 1)
    mean_I = cv2.boxFilter(I, -1, k)
    mean_p = cv2.boxFilter(p, -1, k)
    cov_Ip = cv2.boxFilter(I * p, -1, k) - mean_I * mean_p
    var_I = cv2.boxFilter(I * I, -1, k) - mean_I * mean_I
    a = cov_Ip / (var_I + eps)
    b = mean_p - a * mean_I
    return np.clip(cv2.boxFilter(a, -1, k) * I + cv2.boxFilter(b, -1, k), 0, 1)


def clean_alpha(alpha: np.ndarray, min_island: float = 0.12) -> np.ndarray:
    """Matte cleanup: drop small detached islands, fill enclosed holes, tighten the soft band."""
    hard = (alpha > 0.5).astype(np.uint8)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(hard, 8)
    if n > 1:
        areas = stats[1:, cv2.CC_STAT_AREA]
        keep_ids = 1 + np.flatnonzero(areas >= areas.max() * min_island)
        keep = np.isin(labels, keep_ids).astype(np.uint8)
        # holes = background pixels not reachable from the image border
        inv = (1 - keep).astype(np.uint8)
        h, w = inv.shape
        flood = inv.copy()
        ff_mask = np.zeros((h + 2, w + 2), np.uint8)
        border_rows = [(x, 0) for x in range(0, w, 4)] + [(x, h - 1) for x in range(0, w, 4)]
        border_cols = [(0, y) for y in range(0, h, 4)] + [(w - 1, y) for y in range(0, h, 4)]
        for x, y in border_rows + border_cols:
            if flood[y, x] == 1:
                cv2.floodFill(flood, ff_mask, (x, y), 2)
        holes = flood == 1
        region = cv2.dilate(keep, np.ones((9, 9), np.uint8), iterations=2).astype(bool)
        alpha = np.where(region, alpha, 0.0)
        alpha = np.where(holes, np.maximum(alpha, 1.0), alpha)
    # smoothstep 0.25..0.75: segmenter confidences are soft; mattes need a narrow transition band
    t = np.clip((alpha - 0.25) / 0.5, 0, 1)
    return (t * t * (3 - 2 * t)).astype(np.float32)


def refine_alpha(rgb: np.ndarray, alpha: np.ndarray, strength: float = 1.0) -> np.ndarray:
    h, w = alpha.shape
    r = max(2, int(round(min(h, w) / 180 * strength)))
    refined = guided_filter(rgb, alpha, r, 1e-3)
    # keep confident interior/exterior crisp; let the filter decide the uncertain band
    return np.where(alpha > 0.97, 1.0, np.where(alpha < 0.03, 0.0, refined)).astype(np.float32)


def foreground_alpha(rgb: np.ndarray, faces_present: bool, refine: bool = True) -> tuple[np.ndarray, str]:
    """Pick the best matting model for the content (router rule above)."""
    alpha: np.ndarray | None = None
    model_id = ""
    if faces_present and has_model("selfie_multiclass.tflite"):
        alpha, model_id = person_parts(rgb).person, "mediapipe_selfie_multiclass"
        # fuse with salient-object matte: recovers held objects/hats the person model marks "others"
        try:
            sal, sal_id = salient_alpha(rgb)
            alpha = np.maximum(alpha, sal * (cv2.dilate((alpha > 0.5).astype(np.uint8), np.ones((15, 15))) > 0))
            model_id += f"+{sal_id}"
        except ModelUnavailable:
            pass
    if alpha is None:
        alpha, model_id = salient_alpha(rgb)
    alpha = clean_alpha(alpha)
    if refine:
        alpha = refine_alpha(rgb, alpha)
        model_id += "+guided_filter"
    return alpha, model_id
