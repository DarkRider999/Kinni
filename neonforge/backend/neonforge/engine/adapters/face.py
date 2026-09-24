"""Face detection + 478-point landmarks (MediaPipe), with an OpenCV Haar fallback."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np

from . import has_model, model_path, per_thread

# MediaPipe Face Mesh landmark indices
LEFT_EYE = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246]
RIGHT_EYE = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398]
LIPS = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185]
FACE_OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152,
             148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109]
LEFT_BROW = [70, 63, 105, 66, 107, 55, 65, 52, 53, 46]
RIGHT_BROW = [300, 293, 334, 296, 336, 285, 295, 282, 283, 276]


@dataclass
class Face:
    box: tuple[int, int, int, int]  # x, y, w, h (pixels)
    score: float
    landmarks: np.ndarray | None = None  # (478, 2) pixel coords when the landmarker ran

    @property
    def area(self) -> int:
        return self.box[2] * self.box[3]

    def to_dict(self, idx: int) -> dict:
        x, y, w, h = self.box
        return {"index": idx, "box": [x, y, w, h], "score": round(self.score, 3),
                "has_landmarks": self.landmarks is not None}


def _landmarker():
    import mediapipe as mp
    from mediapipe.tasks.python import BaseOptions, vision

    opts = vision.FaceLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=str(model_path("face_landmarker.task"))),
        running_mode=vision.RunningMode.IMAGE, num_faces=10,
        min_face_detection_confidence=0.4, min_face_presence_confidence=0.4,
    )
    return mp, vision.FaceLandmarker.create_from_options(opts)


def _detector():
    import mediapipe as mp
    from mediapipe.tasks.python import BaseOptions, vision

    opts = vision.FaceDetectorOptions(
        base_options=BaseOptions(model_asset_path=str(model_path("blaze_face_short_range.tflite"))),
        running_mode=vision.RunningMode.IMAGE, min_detection_confidence=0.5,
    )
    return mp, vision.FaceDetector.create_from_options(opts)


def _haar_path() -> str | None:
    # OpenCV 4.x wheels bundle the cascades; 5.x moved them out, so this fallback is best-effort.
    data = getattr(cv2, "data", None)
    path = f"{data.haarcascades}haarcascade_frontalface_default.xml" if data else ""
    return path if path and Path(path).is_file() else None


def _haar():
    return cv2.CascadeClassifier(_haar_path())


def backend_name() -> str:
    if has_model("face_landmarker.task"):
        return "mediapipe_face_landmarker"
    if has_model("blaze_face_short_range.tflite"):
        return "mediapipe_face_detector"
    return "opencv_haar" if _haar_path() else "none"


def detect_faces(rgb: np.ndarray, landmarks: bool = True) -> list[Face]:
    """Detect faces, largest first. Landmarks are included when the landmarker model is installed."""
    rgb = np.ascontiguousarray(rgb[..., :3])
    h, w = rgb.shape[:2]
    faces: list[Face] = []
    if landmarks and has_model("face_landmarker.task"):
        mp, lm = per_thread("face_landmarker", _landmarker)
        res = lm.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb))
        for pts in res.face_landmarks:
            arr = np.array([[p.x * w, p.y * h] for p in pts], dtype=np.float32)
            x0, y0 = arr.min(axis=0)
            x1, y1 = arr.max(axis=0)
            box = _clip_box(int(x0), int(y0), int(x1 - x0), int(y1 - y0), w, h)
            faces.append(Face(box, 1.0, arr))
    elif has_model("blaze_face_short_range.tflite"):
        mp, det = per_thread("face_detector", _detector)
        res = det.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb))
        for d in res.detections:
            b = d.bounding_box
            faces.append(Face(_clip_box(b.origin_x, b.origin_y, b.width, b.height, w, h),
                              float(d.categories[0].score)))
    elif _haar_path():
        gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
        min_side = max(24, min(w, h) // 20)
        rects = per_thread("haar", _haar).detectMultiScale(gray, 1.1, 5, minSize=(min_side, min_side))
        faces = [Face(_clip_box(int(x), int(y), int(fw), int(fh), w, h), 0.8) for x, y, fw, fh in rects]
    faces = [f for f in faces if f.box[2] > 4 and f.box[3] > 4]
    faces.sort(key=lambda f: f.area, reverse=True)
    return faces


def select_faces(faces: list[Face], which) -> list[Face]:
    if which == "largest":
        return faces[:1]
    if isinstance(which, list):
        return [faces[i] for i in which if 0 <= i < len(faces)]
    return faces


def region_mask(shape: tuple[int, int], face: Face, indices: list[int], dilate: int = 0) -> np.ndarray:
    """Filled polygon mask (float32 0..1) over the given landmark indices."""
    mask = np.zeros(shape, np.uint8)
    if face.landmarks is None:
        return mask.astype(np.float32)
    pts = face.landmarks[indices].astype(np.int32)
    cv2.fillPoly(mask, [cv2.convexHull(pts)], 255)
    if dilate > 0:
        mask = cv2.dilate(mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (dilate, dilate)))
    return mask.astype(np.float32) / 255.0


def _clip_box(x: int, y: int, bw: int, bh: int, w: int, h: int) -> tuple[int, int, int, int]:
    x0, y0 = max(0, x), max(0, y)
    x1, y1 = min(w, x + bw), min(h, y + bh)
    return x0, y0, max(0, x1 - x0), max(0, y1 - y0)
