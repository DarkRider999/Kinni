"""Maps API payloads onto the model dataclasses and back."""
from __future__ import annotations

from dataclasses import asdict

from app.models import disruption_score_model, eta_model, traffic_forecast_model
from app.models.geo import LatLng

from . import driver_state_service
from app import schemas


def _weather(w: schemas.Weather) -> eta_model.WeatherInput:
    return eta_model.WeatherInput(condition=w.condition, visibility_km=w.visibility_km, rain_mm=w.rain_mm)


def predict_traffic(req: schemas.TrafficRequest) -> schemas.TrafficResponse:
    out = traffic_forecast_model.predict(
        traffic_forecast_model.TrafficInput(
            origin=LatLng(req.origin.lat, req.origin.lng),
            destination=LatLng(req.destination.lat, req.destination.lng),
            departure_time=req.departure_time,
            crowd_speed_ratio=req.crowd_speed_ratio,
        )
    )
    return schemas.TrafficResponse(
        congestion_factor=out.congestion_factor,
        level=out.level,
        peak_label=out.peak_label,
        forecast=[schemas.ForecastPoint(**asdict(p)) for p in out.forecast],
    )


def predict_eta(req: schemas.EtaRequest) -> schemas.EtaResponse:
    out = eta_model.predict(
        eta_model.EtaInput(
            free_flow_minutes=req.free_flow_minutes,
            distance_km=req.distance_km,
            congestion_factor=req.congestion_factor,
            traffic_aware_minutes=req.traffic_aware_minutes,
            weather=_weather(req.weather),
            disruption_score=req.disruption_score,
            school_zone_count=req.school_zone_count,
        )
    )
    return schemas.EtaResponse(**asdict(out))


def score_disruption(req: schemas.DisruptionRequest) -> schemas.DisruptionResponse:
    out = disruption_score_model.score(
        disruption_score_model.DisruptionInput(
            weather=_weather(req.weather),
            events=[disruption_score_model.EventInput(**e.model_dump()) for e in req.events],
            school_zone_active=req.school_zone_active,
            incident_count=req.incident_count,
        )
    )
    return schemas.DisruptionResponse(**asdict(out))


def score_driver_state(req: schemas.DriverStateRequest) -> schemas.DriverStateResponse:
    out = driver_state_service.assess(driver_state_service.DriverStateInput(**req.model_dump()))
    return schemas.DriverStateResponse(**asdict(out))
