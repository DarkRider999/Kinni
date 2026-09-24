"""Upload ingest: sniff type, store, probe, analyse, thumbnail and safety-screen (spec §3.3 ingest-svc)."""

from __future__ import annotations

from pathlib import Path, PurePath
from typing import BinaryIO

from sqlalchemy.orm import Session

from .db import File, SafetyEvent, User, new_id
from .engine import media
from .engine.analysis import analyze
from .errors import ApiError, plan_limit
from .safety import screen
from .storage import get_storage


def ingest_upload(db: Session, user: User, stream: BinaryIO, filename: str) -> File:
    plan = user.plan
    head = stream.read(64)
    try:
        kind, mime = media.sniff_kind(head, filename)
    except media.MediaError as e:
        raise ApiError(415, "UNSUPPORTED_MEDIA", str(e)) from e

    file_id = new_id()
    ext = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "video/mp4": "mp4",
           "video/quicktime": "mov", "video/x-msvideo": "avi"}[mime]
    key = f"originals/{user.id}/{file_id}.{ext}"
    st = get_storage()

    class _Prefixed:
        def __init__(self) -> None:
            self.head: bytes | None = head

        def read(self, n: int = -1) -> bytes:
            if self.head is not None:
                h, self.head = self.head, None
                return h
            return stream.read(n)

    try:
        size, sha = st.put_stream(key, _Prefixed(), max_bytes=plan.max_upload_mb * 1024 * 1024)  # type: ignore[arg-type]
    except ValueError as e:
        raise plan_limit(f"file exceeds your plan's {plan.max_upload_mb} MB upload limit",
                         max_upload_mb=plan.max_upload_mb) from e
    path = st.path(key)
    try:
        row = _probe(path, kind, file_id, user, filename, mime, size, sha, key)
    except media.MediaError as e:
        st.delete_prefix(key)
        raise ApiError(422, "INVALID_MEDIA", str(e)) from e
    except ApiError:
        st.delete_prefix(key)
        raise
    db.add(row)
    db.add(SafetyEvent(user_id=user.id, file_id=row.id, check_type=row.analysis.pop("_safety_check"),
                       verdict={"blocked": "block"}.get(row.safety_status, "pass"),
                       score=row.analysis.pop("_safety_score"), details=None))
    db.commit()
    if row.safety_status == "blocked":
        raise ApiError(422, "CONTENT_BLOCKED", "this file was blocked by content screening", {"file_id": row.id})
    return row


def _probe(path: Path, kind: str, file_id: str, user: User, filename: str, mime: str, size: int, sha: str,
           key: str) -> File:
    st = get_storage()
    name = PurePath(filename).name[:255] or f"upload.{key.rsplit('.', 1)[-1]}"
    row = File(id=file_id, user_id=user.id, kind=kind, original_name=name, mime_type=mime, size_bytes=size,
               storage_key=key, sha256=sha, status="ready")
    if kind == "image":
        img = media.load_image(path)
        row.height, row.width = img.shape[:2]
        frames = [img]
        thumb_src = img
    elif kind == "gif":
        gif = media.load_gif(path)
        row.height, row.width = gif.frames[0].shape[:2]
        row.frame_count = len(gif.frames)
        row.duration_ms = int(sum(gif.durations_ms))
        row.fps = round(1000.0 / max(1.0, sum(gif.durations_ms) / len(gif.durations_ms)), 3)
        frames = gif.frames[:: max(1, len(gif.frames) // 3)][:3]
        thumb_src = gif.frames[0]
    else:
        info = media.probe_video(path)
        if info.duration_ms > user.plan.max_video_seconds * 1000:
            raise plan_limit(f"videos on your plan can be up to {user.plan.max_video_seconds} seconds",
                             max_video_seconds=user.plan.max_video_seconds)
        row.width, row.height, row.fps = info.width, info.height, round(info.fps, 3)
        row.duration_ms, row.frame_count, row.has_audio = info.duration_ms, info.frame_count, info.has_audio
        thumb_src = media.extract_thumb_frame(path, min(1000, info.duration_ms // 3))
        frames = [thumb_src]
        for at in (info.duration_ms // 2, info.duration_ms * 5 // 6):
            try:
                frames.append(media.extract_thumb_frame(path, at))
            except media.MediaError:
                pass
    row.analysis = analyze(thumb_src)
    verdict = screen(sha, frames)
    row.safety_status = verdict.status
    row.analysis["_safety_check"] = verdict.check
    row.analysis["_safety_score"] = verdict.score
    thumb_key = f"thumbs/{user.id}/{file_id}.jpg"
    st.put_bytes(thumb_key, media.thumbnail_jpeg(thumb_src))
    row.thumb_key = thumb_key
    return row
