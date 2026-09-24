"""Super-resolution.

- ``realesrgan_*``: Real-ESRGAN (BSD-3) RRDBNet in PyTorch, tiled so large images fit in memory.
  Used when torch and the weights are installed (the GPU worker image).
- ``lanczos_detail``: CPU fallback, Lanczos resampling in 2x passes, plus edge-aware detail recovery on
  luminance. It doesn't invent texture the way a GAN does, but it never hallucinates and is fast.
"""

from __future__ import annotations

import importlib.util

import cv2
import numpy as np

from . import has_model, model_path, per_thread

_WEIGHTS = {
    ("photo", 4): "RealESRGAN_x4plus.pth",
    ("photo", 2): "RealESRGAN_x2plus.pth",
    ("anime", 4): "RealESRGAN_x4plus_anime_6B.pth",
}
# model_id → (weights file, native scale)
_MODELS = {
    "realesrgan_x4plus": ("RealESRGAN_x4plus.pth", 4),
    "realesrgan_x2plus": ("RealESRGAN_x2plus.pth", 2),
    "realesrgan_x4plus_anime_6b": ("RealESRGAN_x4plus_anime_6B.pth", 4),
}


def torch_available() -> bool:
    return importlib.util.find_spec("torch") is not None


def pick_model(scale: int, content: str) -> list[tuple[str, int]]:
    """Return the chain of (model_id, factor) steps reaching ``scale`` (8x = 4x then 2x, spec §6.2)."""
    factors = {2: [2], 4: [4], 8: [4, 2]}[scale]
    chain = []
    for f in factors:
        weights = _WEIGHTS.get((content, f)) or _WEIGHTS.get(("photo", f))
        if torch_available() and weights and has_model(weights):
            chain.append((weights.removesuffix(".pth").lower(), f))
        elif torch_available() and f == 2 and has_model(_WEIGHTS[("photo", 4)]):
            chain.append(("realesrgan_x4plus@0.5", 2))  # run 4x then downsample: better than no model
        else:
            chain.append(("lanczos_detail", f))
    return chain


def upscale(rgb: np.ndarray, model_id: str, factor: int) -> np.ndarray:
    if model_id == "lanczos_detail":
        return lanczos_detail(rgb, factor)
    if model_id == "realesrgan_x4plus@0.5":
        out = _esrgan(rgb, "RealESRGAN_x4plus.pth", 4)
        h, w = rgb.shape[:2]
        return cv2.resize(out, (w * 2, h * 2), interpolation=cv2.INTER_AREA)
    weights, native = _MODELS[model_id]
    return _esrgan(rgb, weights, native)


def lanczos_detail(rgb: np.ndarray, factor: int) -> np.ndarray:
    out = rgb
    remaining = factor
    while remaining > 1:
        step = 2 if remaining % 2 == 0 else remaining
        h, w = out.shape[:2]
        out = cv2.resize(out, (w * step, h * step), interpolation=cv2.INTER_LANCZOS4)
        remaining //= step
    # detail recovery: unsharp mask on L only, gated by local edge strength so flat areas stay clean
    lab = cv2.cvtColor(out, cv2.COLOR_RGB2LAB).astype(np.float32)
    L = lab[..., 0]
    sigma = 0.8 + 0.35 * factor
    blur = cv2.GaussianBlur(L, (0, 0), sigma)
    detail = L - blur
    edges = cv2.GaussianBlur(np.abs(cv2.Laplacian(blur, cv2.CV_32F)), (0, 0), 2)
    gate = np.clip(edges / (edges.mean() * 3 + 1e-6), 0, 1)
    lab[..., 0] = np.clip(L + detail * (0.6 + 0.6 * gate), 0, 255)
    return cv2.cvtColor(lab.astype(np.uint8), cv2.COLOR_LAB2RGB)


# ---------------------------------------------------------------- Real-ESRGAN (torch)


def _build_rrdbnet(scale: int, num_block: int):
    import torch
    from torch import nn
    from torch.nn import functional as F  # noqa: N812

    class RDB(nn.Module):
        def __init__(self, nf: int = 64, gc: int = 32) -> None:
            super().__init__()
            self.conv1 = nn.Conv2d(nf, gc, 3, 1, 1)
            self.conv2 = nn.Conv2d(nf + gc, gc, 3, 1, 1)
            self.conv3 = nn.Conv2d(nf + 2 * gc, gc, 3, 1, 1)
            self.conv4 = nn.Conv2d(nf + 3 * gc, gc, 3, 1, 1)
            self.conv5 = nn.Conv2d(nf + 4 * gc, nf, 3, 1, 1)
            self.lrelu = nn.LeakyReLU(0.2, inplace=True)

        def forward(self, x):
            x1 = self.lrelu(self.conv1(x))
            x2 = self.lrelu(self.conv2(torch.cat((x, x1), 1)))
            x3 = self.lrelu(self.conv3(torch.cat((x, x1, x2), 1)))
            x4 = self.lrelu(self.conv4(torch.cat((x, x1, x2, x3), 1)))
            x5 = self.conv5(torch.cat((x, x1, x2, x3, x4), 1))
            return x5 * 0.2 + x

    class RRDB(nn.Module):
        def __init__(self, nf: int) -> None:
            super().__init__()
            self.rdb1, self.rdb2, self.rdb3 = RDB(nf), RDB(nf), RDB(nf)

        def forward(self, x):
            return self.rdb3(self.rdb2(self.rdb1(x))) * 0.2 + x

    class RRDBNet(nn.Module):
        def __init__(self) -> None:
            super().__init__()
            self.scale = scale
            in_ch = 3 * (4 if scale == 2 else 1)
            self.conv_first = nn.Conv2d(in_ch, 64, 3, 1, 1)
            self.body = nn.Sequential(*[RRDB(64) for _ in range(num_block)])
            self.conv_body = nn.Conv2d(64, 64, 3, 1, 1)
            self.conv_up1 = nn.Conv2d(64, 64, 3, 1, 1)
            self.conv_up2 = nn.Conv2d(64, 64, 3, 1, 1)
            self.conv_hr = nn.Conv2d(64, 64, 3, 1, 1)
            self.conv_last = nn.Conv2d(64, 3, 3, 1, 1)
            self.lrelu = nn.LeakyReLU(0.2, inplace=True)

        def forward(self, x):
            feat = F.pixel_unshuffle(x, 2) if self.scale == 2 else x
            feat = self.conv_first(feat)
            feat = feat + self.conv_body(self.body(feat))
            feat = self.lrelu(self.conv_up1(F.interpolate(feat, scale_factor=2, mode="nearest")))
            feat = self.lrelu(self.conv_up2(F.interpolate(feat, scale_factor=2, mode="nearest")))
            return self.conv_last(self.lrelu(self.conv_hr(feat)))

    return RRDBNet()


def _load_esrgan(weights: str, scale: int):
    import torch

    num_block = 6 if "anime_6B" in weights else 23
    net = _build_rrdbnet(scale, num_block)
    state = torch.load(model_path(weights), map_location="cpu", weights_only=True)
    state = state.get("params_ema") or state.get("params") or state
    net.load_state_dict(state, strict=True)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    net.eval().to(device)
    if device == "cuda":
        net.half()
    return net, device


def _esrgan(rgb: np.ndarray, weights: str, scale: int, tile: int = 256, pad: int = 12) -> np.ndarray:
    import torch

    net, device = per_thread(f"esrgan:{weights}", lambda: _load_esrgan(weights, scale))
    dtype = torch.float16 if device == "cuda" else torch.float32
    img = torch.from_numpy(rgb[..., :3].astype(np.float32) / 255.0).permute(2, 0, 1)[None].to(device, dtype)
    _, _, h, w = img.shape
    out = torch.zeros((1, 3, h * scale, w * scale), dtype=dtype, device=device)
    with torch.inference_mode():
        for y in range(0, h, tile):
            for x in range(0, w, tile):
                y0, x0 = max(y - pad, 0), max(x - pad, 0)
                y1, x1 = min(y + tile + pad, h), min(x + tile + pad, w)
                patch = img[:, :, y0:y1, x0:x1]
                ph, pw = patch.shape[2:]
                # pixel_unshuffle (x2 model) needs even sizes
                eh, ew = ph % 2, pw % 2
                if scale == 2 and (eh or ew):
                    patch = torch.nn.functional.pad(patch, (0, ew, 0, eh), mode="reflect")
                res = net(patch)[:, :, : ph * scale, : pw * scale]
                ty1, tx1 = min(y + tile, h), min(x + tile, w)
                out[:, :, y * scale: ty1 * scale, x * scale: tx1 * scale] = res[
                    :, :, (y - y0) * scale: (y - y0 + ty1 - y) * scale, (x - x0) * scale: (x - x0 + tx1 - x) * scale
                ]
    res_np = out[0].float().clamp(0, 1).permute(1, 2, 0).cpu().numpy()
    return (res_np * 255.0 + 0.5).astype(np.uint8)
