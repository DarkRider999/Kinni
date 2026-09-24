import io
import json
import zipfile
from urllib.parse import urlparse

import numpy as np
from PIL import Image

from . import factory
from .conftest import login, needs_models, upload, wait_batch, wait_job


def _get(client, url: str):
    u = urlparse(url)
    return client.get(f"{u.path}?{u.query}")


def test_health(client):
    r = client.get("/v1/health")
    assert r.status_code == 200 and r.json()["status"] == "ok"


def test_auth_required_and_error_shape(client):
    r = client.get("/v1/me")
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "UNAUTHORIZED"
    r = client.get("/v1/me", headers={"Authorization": "Bearer garbage"})
    assert r.status_code == 401


def test_login_grants_plan_credits(client):
    h = login(client, "credits@example.com", "pro")
    me = client.get("/v1/me", headers=h).json()
    assert me["plan"]["id"] == "pro" and me["credits"] == 1500
    # logging in again doesn't grant twice
    h = login(client, "credits@example.com", "pro")
    assert client.get("/v1/me", headers=h).json()["credits"] == 1500


def test_settings_roundtrip(client, auth):
    r = client.put("/v1/me/settings", headers=auth, json={"language": "hi", "default_image_format": "webp"})
    assert r.status_code == 200
    s = client.get("/v1/me/settings", headers=auth).json()
    assert s["language"] == "hi" and s["default_image_format"] == "webp" and s["theme"] == "dark"
    assert client.put("/v1/me/settings", headers=auth, json={"language": "xx"}).status_code == 422


def test_upload_image_gif_video_and_reject_garbage(client, auth, tmp_path):
    img = upload(client, auth, "photo.jpg", factory.jpeg(factory.scene(400, 300)))
    assert img["kind"] == "image" and (img["width"], img["height"]) == (400, 300)
    assert img["analysis"]["face_count"] == 0 and img["safety_status"] in ("clear", "unscanned")
    assert _get(client, img["thumb_url"]).status_code == 200

    g = upload(client, auth, "anim.gif", factory.gif(frames=5))
    assert g["kind"] == "gif" and g["frame_count"] == 5

    vid_path = factory.video(tmp_path / "clip.mov", seconds=1.0)
    v = upload(client, auth, "clip.mov", vid_path.read_bytes())
    assert v["kind"] == "video" and v["has_audio"] and 900 <= v["duration_ms"] <= 1200

    r = client.post("/v1/files", headers=auth, files={"file": ("x.jpg", b"definitely not an image")})
    assert r.status_code == 415 and r.json()["error"]["code"] == "UNSUPPORTED_MEDIA"
    r = client.post("/v1/files", headers=auth, files={"file": ("x.png", b"\x89PNG\r\n\x1a\n" + b"0" * 100)})
    assert r.status_code == 422 and r.json()["error"]["code"] == "INVALID_MEDIA"

    listed = client.get("/v1/files", headers=auth).json()["items"]
    assert {f["id"] for f in listed} >= {img["id"], g["id"], v["id"]}


def test_files_are_private_to_owner(client, auth):
    f = upload(client, auth, "a.jpg", factory.jpeg(factory.scene()))
    other = login(client, "someone-else@example.com")
    assert client.get(f"/v1/files/{f['id']}", headers=other).status_code == 404
    r = client.post("/v1/jobs", headers=other, json={"file_id": f["id"], "recipe": {"steps": [{"op": "enhance"}]}})
    assert r.status_code == 404


def test_render_job_end_to_end_with_credits(client, auth):
    before = client.get("/v1/me", headers=auth).json()["credits"]
    f = upload(client, auth, "portrait.jpg", factory.jpeg(factory.scene(300, 200)))
    recipe = {"steps": [{"op": "enhance"}, {"op": "upscale", "params": {"scale": 2}}],
              "output": {"image_format": "webp"}}
    est = client.post("/v1/recipes/estimate", headers=auth, json={"recipe": recipe, "file_ids": [f["id"]]}).json()
    assert est["total_credits"] == 2 and est["affordable"]

    r = client.post("/v1/jobs", headers=auth, json={"file_id": f["id"], "recipe": recipe})
    assert r.status_code == 202, r.text
    j = wait_job(client, auth, r.json()["id"])
    assert j["status"] == "succeeded", j
    assert j["progress"] == 1.0
    assert [m["op"] for m in j["resolved_models"]] == ["enhance", "upscale"]
    out = j["outputs"][0]
    assert out["format"] == "webp" and (out["width"], out["height"]) == (600, 400)
    assert not out["watermarked"]  # pro plan
    data = _get(client, out["url"]).content
    assert Image.open(io.BytesIO(data)).size == (600, 400)
    dl = _get(client, out["download_url"])
    disposition = dl.headers["content-disposition"]
    assert "attachment" in disposition and "portrait_edit.webp" in disposition
    assert client.get("/v1/me", headers=auth).json()["credits"] == before - 2


def test_signed_urls_reject_tampering(client, auth):
    f = upload(client, auth, "a.jpg", factory.jpeg(factory.scene()))
    u = urlparse(f["url"])
    assert client.get(f"{u.path}?{u.query.replace('sig=', 'sig=0')}").status_code == 403
    other_key = u.path.replace(f["id"], "00000000-0000-0000-0000-000000000000")
    assert client.get(f"{other_key}?{u.query}").status_code == 403


def test_free_plan_watermark_and_limits(client):
    h = login(client, "free-user@example.com", "free")
    f = upload(client, h, "a.jpg", factory.jpeg(factory.scene(300, 200)))
    r = client.post("/v1/jobs", headers=h, json={"file_id": f["id"], "recipe": {
        "steps": [{"op": "upscale", "params": {"scale": 4}}]}})
    assert r.status_code == 403 and r.json()["error"]["code"] == "PLAN_LIMIT"
    r = client.post("/v1/jobs", headers=h, json={"file_id": f["id"], "recipe": {"steps": [{"op": "hdr"}]}})
    j = wait_job(client, h, r.json()["id"])
    assert j["status"] == "succeeded" and j["outputs"][0]["watermarked"]


def test_insufficient_credits(client):
    h = login(client, "broke@example.com", "free")  # 50 credits
    f = upload(client, h, "a.jpg", factory.jpeg(factory.scene(100, 80)))
    files = [f["id"]]
    for i in range(9):
        files.append(upload(client, h, f"b{i}.jpg", factory.jpeg(factory.scene(100, 80, seed=i)))["id"])
    recipe = {"steps": [{"op": "enhance"}, {"op": "hdr"}, {"op": "face_retouch"}, {"op": "face_restore"},
                        {"op": "upscale", "params": {"scale": 2}}]}  # 5 credits each x 10 = 50 OK
    assert client.post("/v1/recipes/estimate", headers=h,
                       json={"recipe": recipe, "file_ids": files}).json()["total_credits"] == 50
    recipe["steps"].append({"op": "background", "params": {"mode": "blur"}})  # 6 x 10 = 60
    r = client.post("/v1/batches", headers=h, json={"file_ids": files, "recipe": recipe})
    assert r.status_code == 402 and r.json()["error"]["details"]["required"] == 60


def test_planned_ops_rejected_by_api(client, auth):
    f = upload(client, auth, "a.jpg", factory.jpeg(factory.scene()))
    r = client.post("/v1/jobs", headers=auth, json={"file_id": f["id"], "recipe": {"steps": [{"op": "face_swap"}]}})
    assert r.status_code == 422 and "later milestone" in r.json()["error"]["message"]
    ops = client.get("/v1/ops").json()
    assert "face_swap" in ops["planned"] and "enhance" in ops["supported"]


def test_preview_is_free_cached_and_small(client, auth):
    before = client.get("/v1/me", headers=auth).json()["credits"]
    f = upload(client, auth, "big.jpg", factory.jpeg(factory.scene(2400, 1600)))
    body = {"file_id": f["id"], "recipe": {"steps": [{"op": "color_grade", "params": {"lut": "vivid"}}]}}
    j1 = client.post("/v1/previews", headers=auth, json=body).json()
    done = wait_job(client, auth, j1["id"])
    assert done["status"] == "succeeded"
    assert max(done["outputs"][0]["width"], done["outputs"][0]["height"]) == 1080
    j2 = client.post("/v1/previews", headers=auth, json=body).json()
    assert j2["id"] == j1["id"]  # cache hit
    assert client.get("/v1/me", headers=auth).json()["credits"] == before


def test_video_job_keeps_audio(client, auth, tmp_path):
    v = upload(client, auth, "clip.mp4", factory.video(tmp_path / "c.mp4", seconds=1.2).read_bytes())
    r = client.post("/v1/jobs", headers=auth, json={"file_id": v["id"], "recipe": {
        "steps": [{"op": "enhance"}], "branches": {"video": [{"op": "stabilize"}]},
        "output": {"video_format": "mp4", "resolution": "sd"}}})
    j = wait_job(client, auth, r.json()["id"])
    assert j["status"] == "succeeded", j
    assert [m["op"] for m in j["resolved_models"]] == ["stabilize", "enhance"]
    out = j["outputs"][0]
    assert out["mime_type"] == "video/mp4" and out["width"] == 320


def test_background_without_models_fails_and_refunds(client, auth, monkeypatch):
    from neonforge.engine.adapters import segment

    monkeypatch.setattr(segment, "has_model", lambda name: False)
    before = client.get("/v1/me", headers=auth).json()["credits"]
    f = upload(client, auth, "a.jpg", factory.jpeg(factory.scene()))
    r = client.post("/v1/jobs", headers=auth, json={"file_id": f["id"], "recipe": {
        "steps": [{"op": "background", "params": {"mode": "remove"}}]}})
    j = wait_job(client, auth, r.json()["id"])
    assert j["status"] == "failed" and j["error"]["code"] == "MODEL_UNAVAILABLE"
    assert client.get("/v1/me", headers=auth).json()["credits"] == before


def test_batch_lifecycle_zip_and_concurrency(client):
    h = login(client, "batcher@example.com", "free")  # batch_in_flight = 2
    ids = [upload(client, h, f"p{i}.png", factory.png(factory.scene(160, 120, seed=i)))["id"] for i in range(5)]
    r = client.post("/v1/batches", headers=h, json={"file_ids": ids, "name": "Product shots", "recipe": {
        "steps": [{"op": "enhance"}], "output": {"image_format": "png"}}})
    assert r.status_code == 202, r.text
    b = r.json()
    jobs = client.get(f"/v1/batches/{b['id']}/jobs", headers=h).json()["items"]
    assert sum(j["status"] in ("queued", "running", "succeeded") for j in jobs) <= 2 + sum(
        j["status"] == "succeeded" for j in jobs)
    done = wait_batch(client, h, b["id"])
    assert done["status"] == "completed" and done["done_files"] == 5 and done["credits_spent"] == 5

    z = client.post(f"/v1/batches/{b['id']}/download", headers=h).json()
    assert z["files"] == 5
    with zipfile.ZipFile(io.BytesIO(_get(client, z["url"]).content)) as zf:
        names = zf.namelist()
    assert len(names) == 5 and all(n.endswith(".png") for n in names)


def test_batch_pause_resume_cancel(client):
    h = login(client, "pauser@example.com", "free")
    ids = [upload(client, h, f"p{i}.jpg", factory.jpeg(factory.scene(200, 150, seed=i)))["id"] for i in range(6)]
    recipe = {"steps": [{"op": "enhance", "params": {"denoise": 90}}, {"op": "hdr"}]}
    b = client.post("/v1/batches", headers=h, json={"file_ids": ids, "recipe": recipe}).json()
    p = client.post(f"/v1/batches/{b['id']}/pause", headers=h)
    assert p.status_code == 200 and p.json()["status"] == "paused"
    jobs = client.get(f"/v1/batches/{b['id']}/jobs", headers=h).json()["items"]
    assert not any(j["status"] == "queued" for j in jobs)
    assert client.post(f"/v1/batches/{b['id']}/pause", headers=h).status_code == 409
    client.post(f"/v1/batches/{b['id']}/resume", headers=h)
    assert wait_batch(client, h, b["id"])["status"] == "completed"

    credits_before = client.get("/v1/me", headers=h).json()["credits"]
    b2 = client.post("/v1/batches", headers=h, json={"file_ids": ids, "recipe": recipe}).json()
    c = client.post(f"/v1/batches/{b2['id']}/cancel", headers=h).json()
    assert c["status"] == "cancelled"
    wait_batch(client, h, b2["id"])
    import time

    deadline = time.monotonic() + 30
    while time.monotonic() < deadline:
        jobs = client.get(f"/v1/batches/{b2['id']}/jobs", headers=h).json()["items"]
        if all(j["status"] in ("succeeded", "cancelled", "failed") for j in jobs):
            break
        time.sleep(0.1)
    spent = sum(j["credits_cost"] for j in jobs if j["status"] == "succeeded")
    assert client.get("/v1/me", headers=h).json()["credits"] == credits_before - spent


def test_batch_limits_and_validation(client):
    h = login(client, "limits@example.com", "free")  # max 10 files
    f = upload(client, h, "a.jpg", factory.jpeg(factory.scene(64, 64)))
    r = client.post("/v1/batches", headers=h, json={"file_ids": [f["id"]] * 2, "recipe": {"steps": [{"op": "hdr"}]}})
    assert r.status_code == 422
    ids = [upload(client, h, f"x{i}.jpg", factory.jpeg(factory.scene(32, 32, seed=i)))["id"] for i in range(11)]
    r = client.post("/v1/batches", headers=h, json={"file_ids": ids, "recipe": {"steps": [{"op": "hdr"}]}})
    assert r.status_code == 403 and r.json()["error"]["details"]["max_batch_files"] == 10


def test_saved_recipes_and_presets(client, auth):
    body = {"name": "Product white BG", "body": {"steps": [{"op": "enhance"}], "output": {"image_format": "png"}}}
    r = client.post("/v1/recipes", headers=auth, json=body)
    assert r.status_code == 201
    rid = r.json()["id"]
    f = upload(client, auth, "a.jpg", factory.jpeg(factory.scene()))
    j = client.post("/v1/jobs", headers=auth, json={"file_id": f["id"], "recipe_id": rid}).json()
    assert wait_job(client, auth, j["id"])["outputs"][0]["format"] == "png"
    other = login(client, "recipe-thief@example.com")
    assert client.put(f"/v1/recipes/{rid}", headers=other, json=body).status_code == 404
    assert client.delete(f"/v1/recipes/{rid}", headers=auth).status_code == 204
    presets = client.get("/v1/presets", params={"category": "background"}).json()["items"]
    assert any(p["id"] == "background.neon_city" for p in presets)
    luts = client.get("/v1/presets", params={"category": "lut"}).json()["items"]
    assert len(luts) == 7


def test_websocket_streams_job_events(client, auth):
    token = auth["Authorization"].split()[1]
    f = upload(client, auth, "a.jpg", factory.jpeg(factory.scene(200, 150)))
    with client.websocket_connect(f"/v1/ws?token={token}") as ws:
        assert ws.receive_json()["type"] == "hello"
        j = client.post("/v1/jobs", headers=auth, json={"file_id": f["id"], "recipe": {
            "steps": [{"op": "enhance"}]}}).json()
        statuses = []
        for _ in range(50):
            ev = json.loads(ws.receive_text())
            if ev.get("job_id") == j["id"]:
                statuses.append(ev["status"])
                if ev["status"] == "succeeded":
                    break
    assert statuses[-1] == "succeeded" and "running" in statuses


def test_websocket_rejects_bad_token(client):
    import pytest
    from starlette.websockets import WebSocketDisconnect

    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect("/v1/ws?token=bad") as ws:
            ws.receive_json()


def test_job_cancel_and_retry(client, auth):
    f = upload(client, auth, "a.jpg", factory.jpeg(factory.scene(300, 200)))
    j = client.post("/v1/jobs", headers=auth, json={"file_id": f["id"], "recipe": {"steps": [{"op": "hdr"}]}}).json()
    client.post(f"/v1/jobs/{j['id']}/cancel", headers=auth)
    final = wait_job(client, auth, j["id"])
    if final["status"] == "cancelled":
        r = client.post(f"/v1/jobs/{j['id']}/retry", headers=auth)
        assert r.status_code == 202
        assert wait_job(client, auth, j["id"])["status"] == "succeeded"
    else:
        assert final["status"] == "succeeded"  # finished before the cancel landed


@needs_models
def test_faces_endpoint_and_retouch_on_real_portrait(client, auth):
    import os
    from pathlib import Path

    sample = Path(os.environ.get("NF_TEST_SAMPLES_DIR", "")) / "lena.jpg"
    if not sample.is_file():
        import pytest

        pytest.skip("NF_TEST_SAMPLES_DIR with lena.jpg not provided")
    f = upload(client, auth, "portrait.jpg", sample.read_bytes())
    faces = client.get(f"/v1/files/{f['id']}/faces", headers=auth).json()
    assert len(faces["faces"]) == 1 and faces["faces"][0]["has_landmarks"]
    j = client.post("/v1/jobs", headers=auth, json={"file_id": f["id"], "recipe": {"steps": [
        {"op": "face_retouch", "params": {"smooth": 70}}, {"op": "background", "params": {"mode": "blur"}}]}}).json()
    done = wait_job(client, auth, j["id"])
    assert done["status"] == "succeeded", done
    out = np.asarray(Image.open(io.BytesIO(_get(client, done["outputs"][0]["url"]).content)))
    assert out.shape[:2] == (512, 512)
