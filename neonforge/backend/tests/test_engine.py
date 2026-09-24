from pathlib import Path

import cv2
import numpy as np
import pytest
from PIL import Image

from neonforge.engine import media, pipeline
from neonforge.engine.analysis import analyze, estimate_noise_sigma
from neonforge.engine.ops.base import Env
from neonforge.engine.ops.enhance import LUT_IDS, ColorGrade, Enhance, apply_lut3d, grade
from neonforge.engine.ops.transform import Stabilize
from neonforge.recipes import EnhanceParams, RecipeBody
from neonforge.seed import BACKGROUNDS

from . import factory
from .conftest import needs_models

PRESETS = {f"background.{pid}": payload for pid, _, payload in BACKGROUNDS}


def run(src: Path, kind: str, recipe: dict, out: Path, **kw) -> pipeline.RenderResult:
    env = Env(kind=kind, presets=PRESETS, analysis=kw.pop("analysis", {}))
    return pipeline.render(src, kind, RecipeBody.model_validate(recipe), out, env=env,
                           progress=lambda *_: None, **kw)


def test_sniff_rejects_unknown_and_detects_types():
    assert media.sniff_kind(factory.jpeg(factory.scene())[:64], "x.jpg") == ("image", "image/jpeg")
    assert media.sniff_kind(factory.gif()[:64], "x.gif") == ("gif", "image/gif")
    with pytest.raises(media.MediaError):
        media.sniff_kind(b"hello world, not media", "evil.jpg")


def test_enhance_reduces_noise_and_keeps_size(tmp_path):
    img = factory.scene(400, 300, noise=12)
    src = tmp_path / "in.png"
    src.write_bytes(factory.png(img))
    res = run(src, "image", {"steps": [{"op": "enhance", "params": {"denoise": 80, "sharpness": 0}}],
                             "output": {"image_format": "png"}}, tmp_path / "out")
    out = np.asarray(Image.open(res.path))
    assert out.shape == img.shape
    assert estimate_noise_sigma(out) < estimate_noise_sigma(img) * 0.7


@pytest.mark.parametrize("lut", LUT_IDS)
def test_lut3d_matches_direct_grade(lut):
    op = ColorGrade({"lut": lut, "intensity": 1.0}, Env(kind="image"))
    op.setup([])
    f = factory.scene(64, 48, noise=0).astype(np.float32) / 255
    direct = np.clip(grade(f, lut), 0, 1)
    assert np.abs(apply_lut3d(f, op.table) - direct).mean() < 0.01


def test_unknown_lut_fails_setup():
    with pytest.raises(ValueError):
        ColorGrade({"lut": "nope", "intensity": 1.0}, Env(kind="image")).setup([])


@pytest.mark.parametrize("scale", [2, 4, 8])
def test_upscale_output_size(tmp_path, scale):
    src = tmp_path / "in.jpg"
    src.write_bytes(factory.jpeg(factory.scene(64, 40)))
    res = run(src, "image", {"steps": [{"op": "upscale", "params": {"scale": scale}}]}, tmp_path / "o")
    assert (res.width, res.height) == (64 * scale, 40 * scale)


def test_export_resolution_clamps_to_plan_and_never_upscales(tmp_path):
    src = tmp_path / "in.jpg"
    src.write_bytes(factory.jpeg(factory.scene(3000, 2000, noise=0)))
    res = run(src, "image", {"steps": [{"op": "hdr"}], "output": {"resolution": "4k"}}, tmp_path / "a",
              plan_max_res="fhd")
    assert (res.width, res.height) == (1920, 1280)
    small = tmp_path / "s.jpg"
    small.write_bytes(factory.jpeg(factory.scene(300, 200)))
    res = run(small, "image", {"steps": [{"op": "hdr"}], "output": {"resolution": "4k"}}, tmp_path / "b")
    assert (res.width, res.height) == (300, 200)


def test_watermark_and_provenance(tmp_path):
    src = tmp_path / "in.jpg"
    img = factory.scene(600, 400, noise=0)
    src.write_bytes(factory.jpeg(img))
    res = run(src, "image", {"steps": [{"op": "color_grade"}]}, tmp_path / "o", watermark=True,
              provenance={"ops": ["color_grade"], "ai_edited": True})
    data = res.path.read_bytes()
    assert b"compositeWithTrainedAlgorithmicMedia" in data
    out = np.asarray(Image.open(res.path))
    graded = run(src, "image", {"steps": [{"op": "color_grade"}]}, tmp_path / "p")
    ref = np.asarray(Image.open(graded.path))
    diff = np.abs(out.astype(int) - ref.astype(int)).sum(axis=2) > 30
    ys, xs = np.nonzero(diff)
    assert len(xs) > 50 and xs.min() > 300 and ys.min() > 300  # badge is confined to the bottom-right


def test_gif_roundtrip_keeps_frames_and_timing(tmp_path):
    src = tmp_path / "in.gif"
    src.write_bytes(factory.gif(frames=6))
    res = run(src, "gif", {"steps": [{"op": "color_grade", "params": {"lut": "noir", "intensity": 1.0}}],
                           "output": {"video_format": "gif"}}, tmp_path / "o")
    with Image.open(res.path) as im:
        assert im.n_frames == 6
        assert im.info["duration"] == 80
        im.seek(3)
        frame = np.asarray(im.convert("RGB")).astype(int)
    assert np.abs(frame[..., 0] - frame[..., 1]).mean() < 3  # noir → greyscale


def test_gif_to_mp4(tmp_path):
    src = tmp_path / "in.gif"
    src.write_bytes(factory.gif(frames=8))
    res = run(src, "gif", {"steps": [{"op": "enhance"}], "output": {"video_format": "mp4"}}, tmp_path / "o")
    info = media.probe_video(res.path)
    assert res.format == "mp4" and info.width == 96 and info.frame_count >= 7


def test_video_render_keeps_audio_and_duration(tmp_path):
    src = factory.video(tmp_path / "in.mp4", seconds=1.5)
    res = run(src, "video", {"steps": [{"op": "color_grade"}], "output": {"video_format": "mov"}}, tmp_path / "o")
    info = media.probe_video(res.path)
    assert res.format == "mov" and info.has_audio
    assert abs(info.duration_ms - 1500) < 200
    assert (info.width, info.height) == (320, 240)


def test_avi_input_and_gif_output(tmp_path):
    src = factory.video(tmp_path / "in.avi", seconds=1.0, container="avi")
    res = run(src, "video", {"steps": [{"op": "enhance"}], "output": {"video_format": "gif", "gif_fps": 10}},
              tmp_path / "o")
    with Image.open(res.path) as im:
        assert 8 <= im.n_frames <= 12


def test_video_preview_is_short_and_small(tmp_path):
    src = factory.video(tmp_path / "in.mp4", seconds=5, w=1280, h=720, fps=10, audio=False)
    res = run(src, "video", {"steps": [{"op": "enhance"}]}, tmp_path / "o", preview=True, preview_at_ms=4000)
    info = media.probe_video(res.path)
    assert max(info.width, info.height) <= 640
    assert info.duration_ms <= 3200


def test_stabilization_reduces_jitter():
    frames = factory.shaky_frames()
    env = Env(kind="video", fps=30, frame_count=len(frames), iter_source=lambda: iter(frames))
    op = Stabilize({"strength": "tripod", "crop_pct": 0}, env)
    op.setup(frames[:4])
    out = [op.apply(f, i) for i, f in enumerate(frames)]

    def jitter(seq):
        g = [cv2.cvtColor(f, cv2.COLOR_RGB2GRAY).astype(np.float32) for f in seq]
        shifts = [cv2.phaseCorrelate(g[0][20:-20, 20:-20], x[20:-20, 20:-20])[0] for x in g[1:]]
        return float(np.mean([np.hypot(*s) for s in shifts]))

    assert jitter(out) < jitter(frames) * 0.35


def test_enhance_statistics_are_global_for_video():
    """Same input frame must map to the same output regardless of position → no flicker."""
    frames = [factory.scene(120, 90, seed=s, noise=4) for s in range(4)]
    op = Enhance(EnhanceParams().model_dump(), Env(kind="video"))
    op.setup(frames)
    a = op.apply(frames[0], 0)
    b = op.apply(frames[0], 3)
    assert np.array_equal(a, b)


def test_analysis_fields():
    a = analyze(factory.scene(640, 480))
    for k in ("noise_sigma", "blur_score", "scene", "face_count", "brightness"):
        assert k in a
    assert a["face_count"] == 0


def test_background_without_models_fails_clearly(tmp_path, monkeypatch):
    from neonforge.engine.adapters import ModelUnavailable, segment

    monkeypatch.setattr(segment, "has_model", lambda name: False)
    src = tmp_path / "in.jpg"
    src.write_bytes(factory.jpeg(factory.scene()))
    with pytest.raises(ModelUnavailable):
        run(src, "image", {"steps": [{"op": "background", "params": {"mode": "remove"}}]}, tmp_path / "o")


@needs_models
@pytest.mark.parametrize("mode", ["remove", "replace", "blur"])
def test_background_modes(tmp_path, mode):
    img = factory.scene(320, 240, noise=8)
    cv2.rectangle(img, (120, 60), (200, 240), (250, 250, 250), -1)  # a salient "product"
    src = tmp_path / "in.png"
    src.write_bytes(factory.png(img))
    params = {"mode": mode}
    if mode == "replace":
        params["preset_id"] = "background.neon_city"
    res = run(src, "image", {"steps": [{"op": "background", "params": params}], "output": {"image_format": "png"}},
              tmp_path / "o")
    out = np.asarray(Image.open(res.path))
    if mode == "remove":
        assert out.shape[2] == 4 and out[..., 3].min() == 0 and out[..., 3].max() == 255
    elif mode == "replace":
        assert out.shape == img.shape
        assert np.abs(out.astype(int) - img.astype(int)).mean() > 3
    else:
        def detail(a):
            return cv2.Laplacian(cv2.cvtColor(a[:, :100], cv2.COLOR_RGB2GRAY), cv2.CV_64F).var()

        assert out.shape == img.shape
        assert detail(out) < detail(img) * 0.5  # background (left strip) is defocused
