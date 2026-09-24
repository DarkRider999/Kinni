"""Object storage. Local filesystem implementation with HMAC-signed download URLs.

Keys are relative paths such as ``originals/{user}/{file}.jpg``. Production swaps in an S3/R2 backend
behind the same interface and serves signed URLs through the CDN (spec §3.1).
"""

from __future__ import annotations

import hashlib
import hmac
import os
import shutil
import time
from pathlib import Path
from typing import BinaryIO
from urllib.parse import quote

from .config import get_settings


class LocalStorage:
    def __init__(self, root: Path, secret: str, base_url: str) -> None:
        self.root = root.resolve()
        self.root.mkdir(parents=True, exist_ok=True)
        self._secret = secret.encode()
        self.base_url = base_url.rstrip("/")

    def path(self, key: str) -> Path:
        p = (self.root / key).resolve()
        if not p.is_relative_to(self.root):
            raise ValueError("invalid storage key")
        return p

    def put_stream(self, key: str, src: BinaryIO, max_bytes: int | None = None) -> tuple[int, str]:
        """Write a stream, returning (size, sha256). Raises ValueError past ``max_bytes``."""
        dest = self.path(key)
        dest.parent.mkdir(parents=True, exist_ok=True)
        tmp = dest.with_suffix(dest.suffix + ".part")
        h = hashlib.sha256()
        size = 0
        try:
            with open(tmp, "wb") as out:
                while chunk := src.read(1024 * 1024):
                    size += len(chunk)
                    if max_bytes is not None and size > max_bytes:
                        raise ValueError("file too large")
                    h.update(chunk)
                    out.write(chunk)
            os.replace(tmp, dest)
        finally:
            tmp.unlink(missing_ok=True)
        return size, h.hexdigest()

    def put_file(self, key: str, src: Path) -> int:
        dest = self.path(key)
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src, dest)
        return dest.stat().st_size

    def put_bytes(self, key: str, data: bytes) -> int:
        dest = self.path(key)
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        return len(data)

    def exists(self, key: str) -> bool:
        return self.path(key).exists()

    def delete_prefix(self, key: str) -> None:
        p = self.path(key)
        if p.is_dir():
            shutil.rmtree(p, ignore_errors=True)
        else:
            p.unlink(missing_ok=True)

    # ---- signed URLs

    def _sig(self, key: str, exp: int, disposition: str) -> str:
        msg = f"{key}\n{exp}\n{disposition}".encode()
        return hmac.new(self._secret, msg, hashlib.sha256).hexdigest()[:32]

    def signed_url(self, key: str, ttl_s: int | None = None, download_name: str | None = None) -> str:
        exp = int(time.time()) + (ttl_s or get_settings().signed_url_ttl_s)
        disposition = download_name or ""
        sig = self._sig(key, exp, disposition)
        url = f"{self.base_url}/v1/media/{quote(key)}?exp={exp}&sig={sig}"
        if download_name:
            url += f"&dl={quote(download_name)}"
        return url

    def verify(self, key: str, exp: int, sig: str, disposition: str = "") -> bool:
        if exp < time.time():
            return False
        return hmac.compare_digest(self._sig(key, exp, disposition), sig)


_storage: LocalStorage | None = None


def get_storage() -> LocalStorage:
    global _storage
    if _storage is None:
        s = get_settings()
        _storage = LocalStorage(s.storage_dir, s.jwt_secret, s.public_base_url)
    return _storage


def reset_storage() -> None:
    global _storage
    _storage = None
