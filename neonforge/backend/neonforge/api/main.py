from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .. import __version__
from ..config import get_settings
from ..db import init_db
from ..errors import ApiError
from .routers import account, files, jobs, realtime, recipes

log = logging.getLogger("neonforge.api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    pool = None
    s = get_settings()
    if s.embedded_worker:
        from ..worker.main import WorkerPool

        pool = WorkerPool(s.worker_concurrency)
        pool.start()
        log.info("embedded worker started (%d threads)", s.worker_concurrency)
    yield
    if pool is not None:
        pool.stop()


def create_app() -> FastAPI:
    s = get_settings()
    app = FastAPI(title="NeonForge AI API", version=__version__, lifespan=lifespan,
                  docs_url="/docs", openapi_url="/openapi.json")
    app.add_middleware(CORSMiddleware, allow_origins=s.cors_origins, allow_credentials=True, allow_methods=["*"],
                       allow_headers=["*"])

    @app.exception_handler(ApiError)
    async def _api_error(_: Request, e: ApiError) -> JSONResponse:
        return JSONResponse({"error": {"code": e.code, "message": e.message, "details": e.details}},
                            status_code=e.status)

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, e: RequestValidationError) -> JSONResponse:
        errs = [{"loc": list(err.get("loc", [])), "msg": err.get("msg")} for err in e.errors()]
        msg = errs[0]["msg"] if errs else "invalid request"
        return JSONResponse({"error": {"code": "VALIDATION_ERROR", "message": msg, "details": {"errors": errs}}},
                            status_code=422)

    for r in (account.router, files.router, recipes.router, jobs.router, realtime.router):
        app.include_router(r, prefix="/v1")
    return app


app = create_app()


def run() -> None:
    import uvicorn

    logging.basicConfig(level=logging.INFO)
    uvicorn.run("neonforge.api.main:app", host="0.0.0.0", port=8000)
