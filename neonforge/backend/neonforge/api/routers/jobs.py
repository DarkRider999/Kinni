from __future__ import annotations

import zipfile
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field
from sqlalchemy import select

from ...db import Batch, Job, Output, Recipe
from ...errors import ApiError, not_found
from ...jobs import (
    batch_dict,
    cancel_batch,
    cancel_job,
    create_batch,
    create_preview,
    create_render,
    fill_batch,
    finalize_batch,
    get_owned_file,
    job_dict,
    pause_batch,
    resume_batch,
    retry_job,
)
from ...recipes import RecipeBody
from ...storage import get_storage
from ..deps import DB, CurrentUser

router = APIRouter(tags=["jobs"])

JobStatus = Literal["pending", "queued", "running", "cancelling", "succeeded", "failed", "cancelled"]


def _resolve_recipe(db, user, recipe: RecipeBody | None, recipe_id: str | None) -> RecipeBody:
    if recipe is not None:
        return recipe
    if recipe_id:
        r = db.get(Recipe, recipe_id)
        if r is None or (r.user_id not in (None, user.id)):
            raise not_found("recipe")
        return RecipeBody.model_validate(r.body)
    raise ApiError(422, "INVALID_RECIPE", "provide recipe or recipe_id")


def _owned_job(db, user, job_id: str) -> Job:
    j = db.get(Job, job_id)
    if j is None or j.user_id != user.id:
        raise not_found("job")
    return j


def _outputs(db, job_id: str) -> list[Output]:
    return list(db.scalars(select(Output).where(Output.job_id == job_id)).all())


class PreviewIn(BaseModel):
    file_id: str
    recipe: RecipeBody
    at_ms: int = Field(0, ge=0)


@router.post("/previews", status_code=202)
def preview(body: PreviewIn, user: CurrentUser, db: DB) -> dict:
    f = get_owned_file(db, user.id, body.file_id)
    job = create_preview(db, user, f, body.recipe, body.at_ms)
    return job_dict(job, _outputs(db, job.id))


class JobIn(BaseModel):
    file_id: str
    recipe: RecipeBody | None = None
    recipe_id: str | None = None


@router.post("/jobs", status_code=202)
def create_job(body: JobIn, user: CurrentUser, db: DB) -> dict:
    f = get_owned_file(db, user.id, body.file_id)
    job = create_render(db, user, f, _resolve_recipe(db, user, body.recipe, body.recipe_id))
    return job_dict(job, [])


@router.get("/jobs")
def list_jobs(user: CurrentUser, db: DB, kind: Literal["render", "preview"] = "render", limit: int = 50) -> dict:
    rows = db.scalars(select(Job).where(Job.user_id == user.id, Job.kind == kind, Job.batch_id.is_(None))
                      .order_by(Job.created_at.desc()).limit(min(limit, 200))).all()
    return {"items": [job_dict(j, _outputs(db, j.id)) for j in rows]}


@router.get("/jobs/{job_id}")
def get_job(job_id: str, user: CurrentUser, db: DB) -> dict:
    j = _owned_job(db, user, job_id)
    return job_dict(j, _outputs(db, j.id))


@router.post("/jobs/{job_id}/cancel")
def cancel(job_id: str, user: CurrentUser, db: DB) -> dict:
    j = _owned_job(db, user, job_id)
    cancel_job(db, j)
    if j.batch_id:
        fill_batch(db, j.batch_id)
        finalize_batch(db, j.batch_id)
    return job_dict(j, _outputs(db, j.id))


@router.post("/jobs/{job_id}/retry", status_code=202)
def retry(job_id: str, user: CurrentUser, db: DB) -> dict:
    j = _owned_job(db, user, job_id)
    retry_job(db, j)
    return job_dict(j, _outputs(db, j.id))


# ---------------------------------------------------------------- batches


class BatchIn(BaseModel):
    file_ids: list[str] = Field(..., min_length=1, max_length=1000)
    recipe: RecipeBody | None = None
    recipe_id: str | None = None
    name: str | None = Field(None, max_length=120)


def _owned_batch(db, user, batch_id: str) -> Batch:
    b = db.get(Batch, batch_id)
    if b is None or b.user_id != user.id:
        raise not_found("batch")
    return b


@router.post("/batches", status_code=202)
def create(body: BatchIn, user: CurrentUser, db: DB) -> dict:
    if len(set(body.file_ids)) != len(body.file_ids):
        raise ApiError(422, "DUPLICATE_FILES", "each file can appear once per batch")
    files = [get_owned_file(db, user.id, fid) for fid in body.file_ids]
    b = create_batch(db, user, files, _resolve_recipe(db, user, body.recipe, body.recipe_id), body.name)
    return batch_dict(b)


@router.get("/batches")
def list_batches(user: CurrentUser, db: DB, limit: int = 50) -> dict:
    rows = db.scalars(select(Batch).where(Batch.user_id == user.id).order_by(Batch.created_at.desc())
                      .limit(min(limit, 200))).all()
    return {"items": [batch_dict(b) for b in rows]}


@router.get("/batches/{batch_id}")
def get_batch(batch_id: str, user: CurrentUser, db: DB) -> dict:
    return batch_dict(_owned_batch(db, user, batch_id))


@router.get("/batches/{batch_id}/jobs")
def batch_jobs(batch_id: str, user: CurrentUser, db: DB,
               status: JobStatus | None = None) -> dict:
    _owned_batch(db, user, batch_id)
    q = select(Job).where(Job.batch_id == batch_id)
    if status:
        q = q.where(Job.status == status)
    rows = db.scalars(q.order_by(Job.created_at, Job.id)).all()
    return {"items": [job_dict(j, _outputs(db, j.id)) for j in rows]}


@router.post("/batches/{batch_id}/download")
def batch_download(batch_id: str, user: CurrentUser, db: DB) -> dict:
    """Bundle all finished outputs into a ZIP and return a signed download URL."""
    b = _owned_batch(db, user, batch_id)
    outs = db.scalars(select(Output).join(Job, Output.job_id == Job.id)
                      .where(Job.batch_id == b.id, Job.status == "succeeded")).all()
    if not outs:
        raise ApiError(409, "NOTHING_TO_DOWNLOAD", "no finished files yet")
    st = get_storage()
    key = f"exports/{user.id}/{b.id}/batch_{b.id[:8]}_{len(outs)}.zip"
    if not st.exists(key):
        dest = st.path(key)
        dest.parent.mkdir(parents=True, exist_ok=True)
        tmp = dest.with_suffix(".part")
        used: set[str] = set()
        with zipfile.ZipFile(tmp, "w", zipfile.ZIP_STORED) as z:
            for o in outs:
                name = o.filename
                n = 1
                while name in used:
                    stem, _, ext = o.filename.rpartition(".")
                    name = f"{stem}_{n}.{ext}"
                    n += 1
                used.add(name)
                z.write(st.path(o.storage_key), name)
        tmp.replace(dest)
    fname = f"{(b.name or 'batch').replace(' ', '_')[:60]}.zip"
    return {"url": st.signed_url(key, download_name=fname), "files": len(outs)}


@router.post("/batches/{batch_id}/{action}")
def batch_action(batch_id: str, action: Literal["pause", "resume", "cancel", "retry-failed"], user: CurrentUser,
                 db: DB) -> dict:
    b = _owned_batch(db, user, batch_id)
    if action == "pause":
        pause_batch(db, b)
    elif action == "resume":
        resume_batch(db, b)
    elif action == "cancel":
        cancel_batch(db, b)
    else:
        failed = db.scalars(select(Job).where(Job.batch_id == b.id, Job.status == "failed")).all()
        if not failed:
            raise ApiError(409, "INVALID_STATE", "no failed files to retry")
        for j in failed:
            retry_job(db, j)
    db.refresh(b)
    return batch_dict(b)
