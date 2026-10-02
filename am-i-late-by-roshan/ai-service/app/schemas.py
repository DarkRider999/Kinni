"""Request/response contracts (JSON, snake_case). The backend's ai_client.ts mirrors these."""
from __future__ import annotations

from datetime import datetime
from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, Field

Condition = Literal["CLEAR", "CLOUDY", "RAIN", "FOG", "DUST", "SANDSTORM", "HEAT"]


class Point(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


class Weather(BaseModel):
    condition: Condition = "CLEAR"
    visibility_km: Optional[float] = Field(default=None, ge=0)
    rain_mm: float = Field(default=0, ge=0)


class TrafficRequest(BaseModel):
    origin: Point
    destination: Point
    departure_time: datetime
    crowd_speed_ratio: Optional[float] = Field(default=None, ge=0, le=3)


class ForecastPoint(BaseModel):
    departure_time: datetime
    congestion_factor: float
    level: str


class TrafficResponse(BaseModel):
    congestion_factor: float
    level: str
    peak_label: str
    forecast: List[ForecastPoint]


class EtaRequest(BaseModel):
    free_flow_minutes: float = Field(gt=0, le=24 * 60)
    distance_km: float = Field(ge=0, le=2000)
    congestion_factor: float = Field(default=1.0, ge=1, le=5)
    traffic_aware_minutes: Optional[float] = Field(default=None, gt=0, le=24 * 60)
    weather: Weather = Weather()
    disruption_score: float = Field(default=0, ge=0, le=100)
    school_zone_count: int = Field(default=0, ge=0, le=50)
    departure_time: Optional[datetime] = None


class EtaResponse(BaseModel):
    eta_minutes: float
    p10_minutes: float
    p90_minutes: float
    confidence: float
    breakdown: Dict[str, float]


class EventIn(BaseModel):
    expected_attendance: int = Field(ge=0)
    distance_km: float = Field(ge=0)
    minutes_to_start: float
    minutes_to_end: float


class DisruptionRequest(BaseModel):
    weather: Weather = Weather()
    events: List[EventIn] = []
    school_zone_active: bool = False
    incident_count: int = Field(default=0, ge=0, le=100)


class DisruptionResponse(BaseModel):
    score: float
    level: str
    factors: List[str]


class DriverStateRequest(BaseModel):
    continuous_drive_minutes: float = Field(ge=0, le=24 * 60)
    local_hour: int = Field(ge=0, le=23)
    steering_variance: float = Field(default=0, ge=0)
    harsh_event_count: int = Field(default=0, ge=0)
    speed_variance: float = Field(default=0, ge=0)
    hours_slept: Optional[float] = Field(default=None, ge=0, le=24)


class DriverStateResponse(BaseModel):
    fatigue_score: float
    level: str
    should_alert: bool
    recommendation: str
