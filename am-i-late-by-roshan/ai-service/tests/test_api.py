from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_predict_traffic():
    r = client.post(
        "/predict/traffic",
        json={"origin": {"lat": 25.3257, "lng": 55.3935}, "destination": {"lat": 25.1972, "lng": 55.2796}, "departure_time": "2026-09-28T04:00:00Z"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["level"] == "SEVERE"
    assert body["peak_label"] == "morning peak"
    assert len(body["forecast"]) == 9


def test_predict_eta():
    r = client.post(
        "/predict/eta",
        json={"free_flow_minutes": 20, "distance_km": 18, "congestion_factor": 1.5, "weather": {"condition": "RAIN", "rain_mm": 2}},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["p10_minutes"] <= body["eta_minutes"] <= body["p90_minutes"]
    assert body["breakdown"]["weather_minutes"] > 0


def test_predict_eta_validation():
    r = client.post("/predict/eta", json={"free_flow_minutes": -5, "distance_km": 18})
    assert r.status_code == 422


def test_score_disruption():
    r = client.post(
        "/score/disruption",
        json={"weather": {"condition": "FOG", "visibility_km": 0.3}, "events": [{"expected_attendance": 20000, "distance_km": 1, "minutes_to_start": 20, "minutes_to_end": 200}], "school_zone_active": True},
    )
    assert r.status_code == 200
    assert r.json()["level"] in {"HIGH", "SEVERE"}


def test_score_driver_state():
    r = client.post("/score/driver-state", json={"continuous_drive_minutes": 240, "local_hour": 3, "steering_variance": 0.5, "harsh_event_count": 3})
    assert r.status_code == 200
    assert r.json()["should_alert"] is True
