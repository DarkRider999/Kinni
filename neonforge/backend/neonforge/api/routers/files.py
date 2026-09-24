from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, UploadFile
from sqlalchemy import select

from ...db import File
from ...engine import media
from ...engine.adapters import face as face_adapter
from ...ingest import ingest_upload
from ...jobs import file_dict, get_owned_file
from ...storage import get_storage
from ..deps import DB, CurrentUser

router = APIRouter(tags=["files"])


@router.post("/files", status_code=201)
def upload(file: UploadFile, user: CurrentUser, db: DB) -> dict:
    """Upload one image/GIF/video (multipart). Clients upload several files in parallel for batches.

    Production puts a tus resumable-upload service in front of this (spec §3.3). The ingest step stays
    the same.
    """
    row = ingest_upload(db, user, file.file, file.filename or "upload")
    return file_dict(row)


@router.get("/files")
def list_files(user: CurrentUser, db: DB, kind: Literal["image", "video", "gif"] | None = None,
               limit: int = 60, offset: int = 0) -> dict:
    q = select(File).where(File.user_id == user.id, File.status != "deleted")
    if kind:
        q = q.where(File.kind == kind)
    rows = db.scalars(q.order_by(File.created_at.desc()).limit(min(limit, 200)).offset(offset)).all()
    return {"items": [file_dict(f) for f in rows]}


@router.get("/files/{file_id}")
def get_file(file_id: str, user: CurrentUser, db: DB) -> dict:
    return file_dict(get_owned_file(db, user.id, file_id))


@router.get("/files/{file_id}/faces")
def get_faces(file_id: str, user: CurrentUser, db: DB) -> dict:
    """Faces with boxes in source-pixel coordinates (first frame for video/GIF)."""
    f = get_owned_file(db, user.id, file_id)
    path = get_storage().path(f.storage_key)
    if f.kind == "image":
        img = media.load_image(path)
    elif f.kind == "gif":
        img = media.load_gif(path, max_frames=1).frames[0]
    else:
        img = media.extract_thumb_frame(path, min(1000, (f.duration_ms or 0) // 3))
    faces = face_adapter.detect_faces(img, landmarks=True)
    return {"width": img.shape[1], "height": img.shape[0], "backend": face_adapter.backend_name(),
            "faces": [fc.to_dict(i) for i, fc in enumerate(faces)]}


@router.delete("/files/{file_id}", status_code=204)
def delete_file(file_id: str, user: CurrentUser, db: DB) -> None:
    f = get_owned_file(db, user.id, file_id)
    st = get_storage()
    st.delete_prefix(f.storage_key)
    if f.thumb_key:
        st.delete_prefix(f.thumb_key)
    f.status = "deleted"
    db.commit()
