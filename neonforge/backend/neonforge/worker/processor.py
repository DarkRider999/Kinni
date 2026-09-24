"""Executes one job: render via the engine, store outputs, settle credits, update the batch."""

from __future__ import annotations

import logging
import tempfile
import time
import traceback
from pathlib import Path

from sqlalchemy import select, update

from .. import credits
from ..db import File, Job, Output, PresetTemplate, User, session_factory, utcnow
from ..engine import media, pipeline
from ..engine.adapters import ModelUnavailable
from ..engine.ops.base import Env
from ..jobs import fill_batch, finalize_batch, output_filename, publish_job
from ..queue import get_queue
from ..recipes import RecipeBody
from ..storage import get_storage

log = logging.getLogger("neonforge.worker")

PROGRESS_INTERVAL_S = 0.4
PERMANENT_ERRORS = (media.MediaError, ModelUnavailable, ValueError)


def process_job(job_id: str, max_attempts: int = 3) -> None:
    Session = session_factory()
    with Session() as db:
        # atomic claim: only one worker (and never a cancelled/paused job) gets past this
        claimed = db.execute(update(Job).where(Job.id == job_id, Job.status == "queued").values(
            status="running", attempt=Job.attempt + 1, started_at=utcnow(), stage="Starting")).rowcount
        db.commit()
        if not claimed:
            return
        job = db.get(Job, job_id)
        assert job is not None
        publish_job(job)
        file = db.get(File, job.file_id)
        user = db.get(User, job.user_id)
        assert file is not None and user is not None
        plan = user.plan
        presets = {p.id: p.payload for p in db.scalars(select(PresetTemplate).where(
            PresetTemplate.category == "background"))}
        lane = user.settings.quality_lane if user.settings else "balanced"
        recipe = RecipeBody.model_validate(job.recipe)
        file_kind, file_path, original_name = file.kind, get_storage().path(file.storage_key), file.original_name
        analysis = dict(file.analysis or {})
        is_preview = job.kind == "preview"
        user_id, batch_id, preview_at = user.id, job.batch_id, job.preview_at_ms

    state = {"last": 0.0}

    def progress(stage: str, frac: float) -> None:
        now = time.monotonic()
        if now - state["last"] < PROGRESS_INTERVAL_S and frac < 1.0:
            return
        state["last"] = now
        with Session() as db:
            j = db.get(Job, job_id)
            if j is None or j.status == "cancelling":
                raise pipeline.JobCancelled()
            j.stage, j.progress = stage, max(0.0, min(0.99, frac))
            db.commit()
            publish_job(j)

    def load_file_image(fid: str):
        with Session() as db:
            f = db.get(File, fid)
            if f is None or f.user_id != user_id or f.kind != "image":
                raise ValueError("background image not found")
            return media.load_image(get_storage().path(f.storage_key))

    env = Env(kind=file_kind, analysis=analysis, presets=presets, load_file_image=load_file_image, lane=lane)
    provenance = {
        "generator": "NeonForge AI", "job_id": job_id,
        "ops": [s.op for s in recipe.steps_for(file_kind)], "ai_edited": True,
    }
    t0 = time.monotonic()
    try:
        with tempfile.TemporaryDirectory(prefix="nf-job-") as tmp:
            result = pipeline.render(
                file_path, file_kind, recipe, Path(tmp), env=env, progress=progress, preview=is_preview,
                preview_at_ms=preview_at, plan_max_res=plan.max_output_res,
                watermark=plan.watermark and not is_preview, provenance=None if is_preview else provenance,
            )
            recipe_name = "preview" if is_preview else "edit"
            fname = output_filename(original_name, recipe_name, result.format)
            key = f"{'previews' if is_preview else 'outputs'}/{user_id}/{job_id}/{fname}"
            size = get_storage().put_file(key, result.path)
        with Session() as db:
            done = db.execute(update(Job).where(Job.id == job_id, Job.status == "running").values(
                status="succeeded", progress=1.0, stage="Done", resolved_models=result.models,
                duration_ms=int((time.monotonic() - t0) * 1000), finished_at=utcnow())).rowcount
            if not done:  # cancelled while finishing
                db.rollback()
                raise pipeline.JobCancelled()
            db.add(Output(job_id=job_id, user_id=user_id, storage_key=key, filename=fname, format=result.format,
                          mime_type=result.mime, width=result.width, height=result.height,
                          duration_ms=result.duration_ms, size_bytes=size, watermarked=result.watermarked,
                          provenance=None if is_preview else provenance))
            db.commit()
            j = db.get(Job, job_id)
            assert j is not None
            db.refresh(j)
            publish_job(j)
    except pipeline.JobCancelled:
        _finish_failed(job_id, "cancelled", None, None, refund=True)
    except PERMANENT_ERRORS as e:
        log.info("job %s failed permanently: %s", job_id, e)
        code = "MODEL_UNAVAILABLE" if isinstance(e, ModelUnavailable) else "PROCESSING_ERROR"
        _finish_failed(job_id, "failed", code, str(e), refund=True)
    except Exception as e:  # noqa: BLE001 - unexpected errors are retried, then failed
        log.error("job %s crashed (attempt %s): %s", job_id, _attempt(job_id), traceback.format_exc())
        if _attempt(job_id) < max_attempts:
            with Session() as db:
                j = db.get(Job, job_id)
                if j is not None and j.status == "running":
                    j.status, j.stage, j.progress = "queued", "Retrying", 0.0
                    db.commit()
                    publish_job(j)
                    get_queue().push(job_id, j.priority)
                    return
        _finish_failed(job_id, "failed", "INTERNAL_ERROR", f"processing failed: {type(e).__name__}", refund=True)
    finally:
        if batch_id:
            with Session() as db:
                fill_batch(db, batch_id)
                finalize_batch(db, batch_id)


def _attempt(job_id: str) -> int:
    with session_factory()() as db:
        j = db.get(Job, job_id)
        return j.attempt if j else 0


def _finish_failed(job_id: str, status: str, code: str | None, message: str | None, refund: bool) -> None:
    with session_factory()() as db:
        j = db.get(Job, job_id)
        if j is None or j.status in ("cancelled", "failed", "succeeded"):
            return  # already settled (e.g. cancelled + refunded while queued)
        j.status, j.error_code, j.error_message = status, code, message
        j.finished_at = utcnow()
        if refund:
            credits.refund(db, j.user_id, j.credits_cost, job_id=j.id, batch_id=j.batch_id, note=status)
        db.commit()
        publish_job(j)
