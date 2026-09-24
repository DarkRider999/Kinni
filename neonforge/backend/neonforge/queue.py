"""Priority job queue and progress event bus (spec §8.1).

Two backends behind one interface:
- Redis (production): a sorted set per queue (higher plan priority first, then FIFO) and Pub/Sub
  for progress events, so API replicas and GPU/CPU workers can scale independently.
- In-memory (dev/tests, ``NF_REDIS_URL`` empty): a thread-safe heap and in-process fan-out.
"""

from __future__ import annotations

import heapq
import itertools
import json
import threading
import time
from collections.abc import Callable
from typing import Any, Protocol

from .config import get_settings

QUEUE_NAME = "nf:jobs"


def _score(priority: int) -> float:
    # Lower score pops first: higher priority dominates, then enqueue time (FIFO).
    return -priority * 1e11 + time.time()


class JobQueue(Protocol):
    def push(self, job_id: str, priority: int) -> None: ...
    def pop(self, timeout_s: float) -> str | None: ...
    def remove(self, job_id: str) -> None: ...
    def size(self) -> int: ...


class EventBus(Protocol):
    def publish(self, user_id: str, event: dict[str, Any]) -> None: ...
    def subscribe(self, user_id: str, callback: Callable[[dict[str, Any]], None]) -> Callable[[], None]: ...


# ---------------------------------------------------------------- in-memory


class MemoryQueue:
    def __init__(self) -> None:
        self._heap: list[tuple[float, int, str]] = []
        self._removed: set[str] = set()
        self._cv = threading.Condition()
        self._seq = itertools.count()

    def push(self, job_id: str, priority: int) -> None:
        with self._cv:
            self._removed.discard(job_id)
            heapq.heappush(self._heap, (_score(priority), next(self._seq), job_id))
            self._cv.notify()

    def pop(self, timeout_s: float) -> str | None:
        deadline = time.monotonic() + timeout_s
        with self._cv:
            while True:
                while self._heap:
                    _, _, job_id = heapq.heappop(self._heap)
                    if job_id in self._removed:
                        self._removed.discard(job_id)
                        continue
                    return job_id
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    return None
                self._cv.wait(remaining)

    def remove(self, job_id: str) -> None:
        with self._cv:
            if any(j == job_id for _, _, j in self._heap):
                self._removed.add(job_id)

    def size(self) -> int:
        with self._cv:
            return len(self._heap) - len(self._removed)


class MemoryBus:
    def __init__(self) -> None:
        self._subs: dict[str, list[Callable[[dict[str, Any]], None]]] = {}
        self._lock = threading.Lock()

    def publish(self, user_id: str, event: dict[str, Any]) -> None:
        with self._lock:
            subs = list(self._subs.get(user_id, []))
        for cb in subs:
            try:
                cb(event)
            except Exception:  # noqa: BLE001 - a broken subscriber must not break the worker
                pass

    def subscribe(self, user_id: str, callback: Callable[[dict[str, Any]], None]) -> Callable[[], None]:
        with self._lock:
            self._subs.setdefault(user_id, []).append(callback)

        def unsubscribe() -> None:
            with self._lock:
                lst = self._subs.get(user_id, [])
                if callback in lst:
                    lst.remove(callback)

        return unsubscribe


# ---------------------------------------------------------------- redis


class RedisQueue:
    def __init__(self, url: str) -> None:
        import redis

        self._r = redis.Redis.from_url(url)

    def push(self, job_id: str, priority: int) -> None:
        self._r.zadd(QUEUE_NAME, {job_id: _score(priority)})

    def pop(self, timeout_s: float) -> str | None:
        res = self._r.bzpopmin(QUEUE_NAME, timeout=max(1, int(timeout_s)))
        if not res:
            return None
        _, member, _ = res
        return member.decode()

    def remove(self, job_id: str) -> None:
        self._r.zrem(QUEUE_NAME, job_id)

    def size(self) -> int:
        return int(self._r.zcard(QUEUE_NAME))


class RedisBus:
    def __init__(self, url: str) -> None:
        import redis

        self._url = url
        self._r = redis.Redis.from_url(url)

    def publish(self, user_id: str, event: dict[str, Any]) -> None:
        self._r.publish(f"nf:events:{user_id}", json.dumps(event, default=str))

    def subscribe(self, user_id: str, callback: Callable[[dict[str, Any]], None]) -> Callable[[], None]:
        import redis

        ps = redis.Redis.from_url(self._url).pubsub(ignore_subscribe_messages=True)

        def handler(msg: dict[str, Any]) -> None:
            callback(json.loads(msg["data"]))

        ps.subscribe(**{f"nf:events:{user_id}": handler})
        thread = ps.run_in_thread(sleep_time=0.1, daemon=True)

        def unsubscribe() -> None:
            thread.stop()
            ps.close()

        return unsubscribe


# ---------------------------------------------------------------- singletons

_queue: JobQueue | None = None
_bus: EventBus | None = None


def get_queue() -> JobQueue:
    global _queue
    if _queue is None:
        url = get_settings().redis_url
        _queue = RedisQueue(url) if url else MemoryQueue()
    return _queue


def get_bus() -> EventBus:
    global _bus
    if _bus is None:
        url = get_settings().redis_url
        _bus = RedisBus(url) if url else MemoryBus()
    return _bus


def reset_queue() -> None:
    global _queue, _bus
    _queue = None
    _bus = None
