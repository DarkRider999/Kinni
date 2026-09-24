"""Worker process: pops job ids from the priority queue and runs them on N threads.

Production runs this as its own deployment (``neonforge-worker``, scaled by KEDA on queue depth, spec
§8.3) with ``NF_REDIS_URL`` set. In dev, the API starts the same loop in-process.
"""

from __future__ import annotations

import logging
import signal
import threading

from ..config import get_settings
from ..db import init_db
from ..queue import get_queue
from .processor import process_job

log = logging.getLogger("neonforge.worker")


class WorkerPool:
    def __init__(self, concurrency: int) -> None:
        self.concurrency = concurrency
        self._stop = threading.Event()
        self._threads: list[threading.Thread] = []

    def start(self) -> None:
        for i in range(self.concurrency):
            t = threading.Thread(target=self._loop, name=f"nf-worker-{i}", daemon=True)
            t.start()
            self._threads.append(t)

    def stop(self, timeout: float = 5.0) -> None:
        self._stop.set()
        for t in self._threads:
            t.join(timeout)

    def _loop(self) -> None:
        q = get_queue()
        max_attempts = get_settings().job_max_attempts
        while not self._stop.is_set():
            job_id = q.pop(timeout_s=1.0)
            if job_id is None:
                continue
            try:
                process_job(job_id, max_attempts)
            except Exception:  # noqa: BLE001 - never let one job kill the worker thread
                log.exception("unhandled error processing job %s", job_id)


def run() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    s = get_settings()
    if not s.redis_url:
        raise SystemExit("standalone worker needs NF_REDIS_URL (in dev, the API runs an embedded worker)")
    init_db()
    pool = WorkerPool(s.worker_concurrency)
    pool.start()
    done = threading.Event()
    signal.signal(signal.SIGTERM, lambda *_: done.set())
    signal.signal(signal.SIGINT, lambda *_: done.set())
    log.info("worker started with %d threads", s.worker_concurrency)
    done.wait()
    pool.stop()


if __name__ == "__main__":
    run()
