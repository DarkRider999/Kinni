"""Job and batch orchestration: creation, credit reservation, scheduling, events and serialization.

Scheduling (spec §8.2): a batch creates all its jobs as ``pending``. ``fill_batch`` moves up to
``plan.batch_in_flight`` of them to ``queued`` and pushes them onto the priority queue. Whenever a job
finishes, the batch is topped up again. Pause removes queued jobs from the queue and parks them back
in ``pending``.
"""

from __future__ import annotations

import hashlib
import json
import threading
from pathlib import PurePath
from typing import Any

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from . import credits
from .db import Batch, File, Job, Output, Plan, User, utcnow
from .errors import ApiError, not_found, plan_limit
from .queue import get_bus, get_queue
from .recipes import RecipeBody, estimate_credits
from .storage import get_storage

ACTIVE = ("queued", "running", "cancelling")
FINAL = ("succeeded", "failed", "cancelled")
PREVIEW_PRIORITY_BOOST = 1

_fill_lock = threading.Lock()


def recipe_hash(recipe: RecipeBody, extra: str = "") -> str:
    body = json.dumps(recipe.model_dump(mode="json"), sort_keys=True) + extra
    return hashlib.sha256(body.encode()).hexdigest()


def check_plan(recipe: RecipeBody, plan: Plan) -> None:
    for step in [*recipe.steps, *(s for b in recipe.branches.values() for s in b)]:
        if step.op == "upscale" and step.params["scale"] > plan.max_upscale:
            raise plan_limit(f"{step.params['scale']}x upscaling needs a higher plan (yours allows "
                             f"{plan.max_upscale}x)", max_upscale=plan.max_upscale)


def get_owned_file(db: Session, user_id: str, file_id: str) -> File:
    f = db.get(File, file_id)
    if f is None or f.user_id != user_id or f.status == "deleted":
        raise not_found("file")
    if f.safety_status == "blocked":
        raise ApiError(422, "CONTENT_BLOCKED", "this file was blocked by content screening")
    return f


def _check_resources(db: Session, user: User, recipe: RecipeBody) -> None:
    for step in [*recipe.steps, *(s for b in recipe.branches.values() for s in b)]:
        if step.op == "background" and step.params.get("source") == "upload" and step.params.get("mode") == "replace":
            fid = step.params.get("image_file_id")
            if not fid:
                raise ApiError(422, "INVALID_RECIPE", "background replace from upload needs image_file_id")
            bg = get_owned_file(db, user.id, fid)
            if bg.kind != "image":
                raise ApiError(422, "INVALID_RECIPE", "background image must be a photo")


def create_render(db: Session, user: User, file: File, recipe: RecipeBody) -> Job:
    check_plan(recipe, user.plan)
    _check_resources(db, user, recipe)
    _check_steps(recipe, file.kind)
    cost = estimate_credits(recipe, file.kind, file.duration_ms)
    job = Job(user_id=user.id, file_id=file.id, kind="render", recipe=recipe.model_dump(mode="json"),
              recipe_hash=recipe_hash(recipe), priority=user.plan.priority, credits_cost=cost, status="queued")
    db.add(job)
    db.flush()
    credits.reserve(db, user.id, cost, job_id=job.id)
    db.commit()
    get_queue().push(job.id, job.priority)
    publish_job(job)
    return job


def create_preview(db: Session, user: User, file: File, recipe: RecipeBody, at_ms: int = 0) -> Job:
    """Low-res preview (free, cached): identical file+recipe+position returns the earlier job."""
    check_plan(recipe, user.plan)
    _check_resources(db, user, recipe)
    _check_steps(recipe, file.kind)
    at_ms = at_ms if file.kind == "video" else 0
    h = recipe_hash(recipe, f":preview:{at_ms}")
    cached = db.scalars(
        select(Job).where(Job.file_id == file.id, Job.kind == "preview", Job.recipe_hash == h,
                          Job.status.in_(("queued", "running", "succeeded"))).order_by(Job.created_at.desc())
    ).first()
    if cached is not None:
        return cached
    job = Job(user_id=user.id, file_id=file.id, kind="preview", recipe=recipe.model_dump(mode="json"),
              recipe_hash=h, preview_at_ms=at_ms, priority=user.plan.priority + PREVIEW_PRIORITY_BOOST,
              credits_cost=0, status="queued")
    db.add(job)
    db.commit()
    get_queue().push(job.id, job.priority)
    publish_job(job)
    return job


def create_batch(db: Session, user: User, files: list[File], recipe: RecipeBody, name: str | None) -> Batch:
    plan = user.plan
    if not files:
        raise ApiError(422, "EMPTY_BATCH", "select at least one file")
    if len(files) > plan.max_batch_files:
        raise plan_limit(f"your plan allows {plan.max_batch_files} files per batch",
                         max_batch_files=plan.max_batch_files)
    check_plan(recipe, plan)
    _check_resources(db, user, recipe)
    costs = []
    for f in files:
        _check_steps(recipe, f.kind)
        costs.append(estimate_credits(recipe, f.kind, f.duration_ms))
    total = sum(costs)
    have = credits.balance(db, user.id)
    if have < total:
        raise ApiError(402, "INSUFFICIENT_CREDITS", f"this batch needs {total} credits, you have {have}",
                       {"required": total, "balance": have})
    batch = Batch(user_id=user.id, name=name or f"Batch of {len(files)}",
                  recipe_snapshot=recipe.model_dump(mode="json"), total_files=len(files), priority=plan.priority,
                  credits_reserved=total, status="queued")
    db.add(batch)
    db.flush()
    h = recipe_hash(recipe)
    for f, cost in zip(files, costs, strict=True):
        job = Job(user_id=user.id, batch_id=batch.id, file_id=f.id, kind="render", recipe=batch.recipe_snapshot,
                  recipe_hash=h, priority=plan.priority, credits_cost=cost, status="pending")
        db.add(job)
        db.flush()
        credits.reserve(db, user.id, cost, job_id=job.id, batch_id=batch.id)
    db.commit()
    fill_batch(db, batch.id)
    publish_batch(db, batch)
    return batch


def _check_steps(recipe: RecipeBody, kind: str) -> None:
    if not recipe.steps_for(kind):
        raise ApiError(422, "EMPTY_RECIPE", f"the recipe has no steps that apply to a {kind}")


# ---------------------------------------------------------------- scheduling


def fill_batch(db: Session, batch_id: str) -> int:
    """Queue pending jobs up to the plan's in-flight limit. Returns how many were queued."""
    with _fill_lock:
        batch = db.get(Batch, batch_id)
        if batch is None or batch.status not in ("queued", "running"):
            return 0
        db.refresh(batch)
        plan = db.get(User, batch.user_id).plan  # type: ignore[union-attr]
        active = db.scalar(select(func.count()).where(Job.batch_id == batch_id, Job.status.in_(ACTIVE))) or 0
        slots = plan.batch_in_flight - active
        if slots <= 0:
            return 0
        pending = db.scalars(
            select(Job).where(Job.batch_id == batch_id, Job.status == "pending").order_by(Job.created_at, Job.id)
            .limit(slots).with_for_update(skip_locked=True)
        ).all()
        for j in pending:
            j.status = "queued"
        if pending and batch.status == "queued":
            batch.status = "running"
        db.commit()
        for j in pending:
            get_queue().push(j.id, j.priority)
        return len(pending)


def pause_batch(db: Session, batch: Batch) -> None:
    if batch.status not in ("queued", "running"):
        raise ApiError(409, "INVALID_STATE", f"cannot pause a {batch.status} batch")
    batch.status = "paused"
    queued = db.scalars(select(Job).where(Job.batch_id == batch.id, Job.status == "queued")).all()
    for j in queued:
        get_queue().remove(j.id)
        j.status = "pending"
    db.commit()


def resume_batch(db: Session, batch: Batch) -> None:
    if batch.status != "paused":
        raise ApiError(409, "INVALID_STATE", "batch is not paused")
    batch.status = "running"
    db.commit()
    fill_batch(db, batch.id)
    finalize_batch(db, batch.id)


def cancel_job(db: Session, job: Job, publish: bool = True) -> None:
    """Cancel queued/pending jobs immediately; running jobs stop at their next progress checkpoint."""
    if job.status in FINAL:
        return
    # Conditional UPDATEs: a worker may claim the job concurrently, so never trust the loaded status.
    get_queue().remove(job.id)
    claimed = db.execute(update(Job).where(Job.id == job.id, Job.status.in_(("queued", "pending")))
                         .values(status="cancelled", finished_at=utcnow())).rowcount
    if claimed:
        credits.refund(db, job.user_id, job.credits_cost, job_id=job.id, batch_id=job.batch_id, note="cancelled")
    else:
        # running: the worker stops at its next checkpoint, refunds, then marks it cancelled
        db.execute(update(Job).where(Job.id == job.id, Job.status == "running").values(status="cancelling"))
    db.commit()
    db.refresh(job)
    if publish:
        publish_job(job)


def cancel_batch(db: Session, batch: Batch) -> None:
    if batch.status in ("completed", "partial", "cancelled", "failed"):
        raise ApiError(409, "INVALID_STATE", f"batch already {batch.status}")
    batch.status = "cancelled"
    db.commit()
    for j in db.scalars(select(Job).where(Job.batch_id == batch.id, Job.status.in_(("pending", "queued", "running")))):
        cancel_job(db, j, publish=False)
    batch.finished_at = utcnow()
    db.commit()
    publish_batch(db, batch)


def retry_job(db: Session, job: Job) -> None:
    if job.status not in ("failed", "cancelled"):
        raise ApiError(409, "INVALID_STATE", "only failed or cancelled jobs can be retried")
    if job.error_code == "CONTENT_BLOCKED":
        raise ApiError(409, "INVALID_STATE", "blocked content cannot be retried")
    credits.reserve(db, job.user_id, job.credits_cost, job_id=job.id, batch_id=job.batch_id)
    job.status, job.error_code, job.error_message = "pending" if job.batch_id else "queued", None, None
    job.progress, job.stage, job.attempt = 0.0, None, 0
    if job.batch_id:
        batch = db.get(Batch, job.batch_id)
        assert batch is not None
        if batch.status in ("completed", "partial", "failed", "cancelled"):
            batch.status, batch.finished_at = "running", None
    db.commit()
    if job.batch_id:
        fill_batch(db, job.batch_id)
        finalize_batch(db, job.batch_id)
    else:
        get_queue().push(job.id, job.priority)
    publish_job(job)


def finalize_batch(db: Session, batch_id: str) -> None:
    """Refresh counters from job rows and settle the batch status once nothing is left to run."""
    batch = db.get(Batch, batch_id)
    if batch is None:
        return
    db.refresh(batch)
    counts = dict(db.execute(
        select(Job.status, func.count()).where(Job.batch_id == batch_id).group_by(Job.status)).all())
    batch.done_files = counts.get("succeeded", 0)
    batch.failed_files = counts.get("failed", 0)
    spent = db.scalar(select(func.coalesce(func.sum(Job.credits_cost), 0)).where(
        Job.batch_id == batch_id, Job.status == "succeeded")) or 0
    batch.credits_spent = int(spent)
    remaining = sum(counts.get(s, 0) for s in ("pending", "queued", "running", "cancelling"))
    if remaining == 0 and batch.status in ("queued", "running"):
        batch.status = "completed" if batch.failed_files == 0 else ("failed" if batch.done_files == 0 else "partial")
        batch.finished_at = utcnow()
    db.commit()
    publish_batch(db, batch)


# ---------------------------------------------------------------- serialization & events


def output_dict(o: Output) -> dict[str, Any]:
    st = get_storage()
    return {
        "id": o.id, "format": o.format, "mime_type": o.mime_type, "width": o.width, "height": o.height,
        "duration_ms": o.duration_ms, "size_bytes": o.size_bytes, "filename": o.filename,
        "watermarked": o.watermarked, "url": st.signed_url(o.storage_key),
        "download_url": st.signed_url(o.storage_key, download_name=o.filename), "created_at": o.created_at,
    }


def job_dict(job: Job, outputs: list[Output] | None = None) -> dict[str, Any]:
    return {
        "id": job.id, "batch_id": job.batch_id, "file_id": job.file_id, "kind": job.kind, "status": job.status,
        "stage": job.stage, "progress": round(job.progress, 4), "attempt": job.attempt,
        "error": {"code": job.error_code, "message": job.error_message} if job.error_code else None,
        "credits_cost": job.credits_cost, "resolved_models": job.resolved_models, "duration_ms": job.duration_ms,
        "created_at": job.created_at, "started_at": job.started_at, "finished_at": job.finished_at,
        "outputs": [output_dict(o) for o in outputs] if outputs is not None else None,
        "recipe": job.recipe,
    }


def batch_dict(b: Batch) -> dict[str, Any]:
    return {
        "id": b.id, "name": b.name, "status": b.status, "total_files": b.total_files, "done_files": b.done_files,
        "failed_files": b.failed_files, "progress": round((b.done_files + b.failed_files) / max(b.total_files, 1), 4),
        "credits_reserved": b.credits_reserved, "credits_spent": b.credits_spent, "recipe": b.recipe_snapshot,
        "created_at": b.created_at, "finished_at": b.finished_at,
    }


def file_dict(f: File) -> dict[str, Any]:
    st = get_storage()
    return {
        "id": f.id, "kind": f.kind, "original_name": f.original_name, "mime_type": f.mime_type,
        "size_bytes": f.size_bytes, "width": f.width, "height": f.height, "duration_ms": f.duration_ms,
        "fps": f.fps, "frame_count": f.frame_count, "has_audio": f.has_audio, "analysis": f.analysis,
        "safety_status": f.safety_status, "status": f.status, "created_at": f.created_at,
        "url": st.signed_url(f.storage_key), "thumb_url": st.signed_url(f.thumb_key) if f.thumb_key else None,
    }


def output_filename(original: str, recipe_name: str, fmt: str) -> str:
    stem = PurePath(original).stem[:80] or "file"
    safe = "".join(c if c.isalnum() or c in "-_" else "_" for c in f"{stem}_{recipe_name}")
    return f"{safe}.{fmt}"


def publish_job(job: Job) -> None:
    get_bus().publish(job.user_id, {
        "type": "job.progress", "job_id": job.id, "batch_id": job.batch_id, "file_id": job.file_id,
        "kind": job.kind, "status": job.status, "stage": job.stage, "progress": round(job.progress, 4),
        "error": {"code": job.error_code, "message": job.error_message} if job.error_code else None,
        "ts": utcnow().isoformat(),
    })


def publish_batch(db: Session, batch: Batch) -> None:
    get_bus().publish(batch.user_id, {"type": "batch.progress", **{k: v for k, v in batch_dict(batch).items()
                                                                   if k != "recipe"}, "ts": utcnow().isoformat()})
