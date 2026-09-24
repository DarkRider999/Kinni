from __future__ import annotations

import os
import shutil
import tempfile
import time
from pathlib import Path

import pytest

# Configure BEFORE importing neonforge (settings are cached on first use).
_TMP = Path(tempfile.mkdtemp(prefix="nf-test-"))
_MODELS_SRC = os.environ.get("NF_TEST_MODELS_DIR")
os.environ.update({
    # NF_TEST_DATABASE_URL / NF_TEST_REDIS_URL run the suite against Postgres + Redis (CI "services" job)
    "NF_DATABASE_URL": os.environ.get("NF_TEST_DATABASE_URL") or f"sqlite:///{_TMP / 'test.db'}",
    "NF_STORAGE_DIR": str(_TMP / "storage"),
    "NF_MODELS_DIR": _MODELS_SRC or str(_TMP / "models"),
    "NF_REDIS_URL": os.environ.get("NF_TEST_REDIS_URL", ""),
    "NF_EMBEDDED_WORKER": "true",
    "NF_WORKER_CONCURRENCY": "2",
    "NF_PUBLIC_BASE_URL": "http://testserver",
    "NF_JWT_SECRET": "test-secret-that-is-long-enough-for-hs256",
})

from fastapi.testclient import TestClient  # noqa: E402

from neonforge.api.main import create_app  # noqa: E402
from neonforge.engine.adapters import has_model  # noqa: E402

HAS_PERSON_MODELS = has_model("selfie_multiclass.tflite") and has_model("face_landmarker.task")
HAS_SALIENT_MODEL = has_model("u2netp.onnx")
needs_models = pytest.mark.skipif(not (HAS_PERSON_MODELS and HAS_SALIENT_MODEL),
                                  reason="set NF_TEST_MODELS_DIR (see scripts/fetch_models.py)")

SAMPLES = Path(os.environ.get("NF_TEST_SAMPLES_DIR", "/nonexistent"))


@pytest.fixture(scope="session")
def client():
    with TestClient(create_app()) as c:
        yield c
    shutil.rmtree(_TMP, ignore_errors=True)


def login(client, email: str, plan: str = "free") -> dict:
    r = client.post("/v1/auth/dev-login", json={"email": email, "plan": plan})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture
def auth(client, request):
    return login(client, f"{request.node.name[:40]}@example.com", "pro")


def wait_job(client, headers, job_id: str, timeout: float = 120) -> dict:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        j = client.get(f"/v1/jobs/{job_id}", headers=headers).json()
        if j["status"] in ("succeeded", "failed", "cancelled"):
            return j
        time.sleep(0.1)
    raise AssertionError(f"job {job_id} did not finish: {j}")


def wait_batch(client, headers, batch_id: str, timeout: float = 180) -> dict:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        b = client.get(f"/v1/batches/{batch_id}", headers=headers).json()
        if b["status"] in ("completed", "partial", "failed", "cancelled"):
            return b
        time.sleep(0.1)
    raise AssertionError(f"batch {batch_id} did not finish: {b}")


def upload(client, headers, name: str, data: bytes) -> dict:
    r = client.post("/v1/files", headers=headers, files={"file": (name, data)})
    assert r.status_code == 201, r.text
    return r.json()
