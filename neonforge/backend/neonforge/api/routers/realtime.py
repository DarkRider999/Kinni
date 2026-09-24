"""Signed media downloads, live job events (WebSocket + SSE fallback) and health probes."""

from __future__ import annotations

import asyncio
import json
import mimetypes
from typing import Annotated

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, StreamingResponse

from ...db import session_factory
from ...errors import ApiError
from ...queue import get_bus, get_queue
from ...storage import get_storage
from ..deps import CurrentUser, user_from_token

router = APIRouter()


@router.get("/media/{key:path}", tags=["media"])
def media(key: str, exp: int, sig: str, dl: Annotated[str | None, Query()] = None):
    """Serve a stored object behind an expiring HMAC signature (a CDN signed URL in production)."""
    st = get_storage()
    if not st.verify(key, exp, sig, dl or ""):
        raise ApiError(403, "FORBIDDEN", "link expired or invalid")
    path = st.path(key)
    if not path.is_file():
        raise ApiError(404, "NOT_FOUND", "file not found")
    mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    headers = {"Cache-Control": "private, max-age=3600"}
    if dl:
        return FileResponse(path, media_type=mime, filename=dl, headers=headers)
    return FileResponse(path, media_type=mime, headers=headers)


def _subscribe(user_id: str) -> tuple[asyncio.Queue, callable]:
    loop = asyncio.get_running_loop()
    q: asyncio.Queue = asyncio.Queue(maxsize=1000)

    def on_event(ev: dict) -> None:
        def put() -> None:
            if q.full():
                q.get_nowait()  # drop the oldest: progress events are superseded by newer ones
            q.put_nowait(ev)

        loop.call_soon_threadsafe(put)

    return q, get_bus().subscribe(user_id, on_event)


@router.websocket("/ws")
async def ws(websocket: WebSocket, token: str) -> None:
    with session_factory()() as db:
        try:
            user = user_from_token(db, token)
        except ApiError:
            await websocket.close(code=4401)
            return
        user_id = user.id
    await websocket.accept()
    q, unsubscribe = _subscribe(user_id)
    try:
        await websocket.send_json({"type": "hello"})
        while True:
            try:
                ev = await asyncio.wait_for(q.get(), timeout=25)
                await websocket.send_text(json.dumps(ev, default=str))
            except TimeoutError:
                await websocket.send_json({"type": "ping"})
    except (WebSocketDisconnect, RuntimeError):
        pass
    finally:
        unsubscribe()


@router.get("/events/stream", tags=["events"])
async def sse(user: CurrentUser) -> StreamingResponse:
    user_id = user.id
    q, unsubscribe = _subscribe(user_id)

    async def gen():
        try:
            yield "event: hello\ndata: {}\n\n"
            while True:
                try:
                    ev = await asyncio.wait_for(q.get(), timeout=20)
                    yield f"data: {json.dumps(ev, default=str)}\n\n"
                except TimeoutError:
                    yield ": ping\n\n"
        finally:
            unsubscribe()

    return StreamingResponse(gen(), media_type="text/event-stream", headers={"Cache-Control": "no-cache"})


@router.get("/health", tags=["ops"])
def health() -> dict:
    from ...engine.adapters import MODEL_FILES, has_model
    from ...engine.adapters.upscale import torch_available

    return {
        "status": "ok",
        "queue_depth": get_queue().size(),
        "models": {k: has_model(v["file"]) for k, v in MODEL_FILES.items()},
        "torch": torch_available(),
    }
