"""Disruption score (0-100) for a trip: weather, nearby events, school zones, incidents.

Swap-in point for a trained model: keep the dataclasses, replace `score()`.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List

from .eta_model import WeatherInput
from .geo import clamp

WEATHER_IMPACT = {
    "RAIN": (20.0, "Rain: slippery roads and possible flooding"),
    "FOG": (25.0, "Fog: reduced visibility"),
    "SANDSTORM": (35.0, "Sandstorm: very low visibility"),
    "DUST": (12.0, "Dust: reduced visibility"),
    "HEAT": (3.0, "Extreme heat"),
}


@dataclass(frozen=True)
class EventInput:
    expected_attendance: int
    distance_km: float
    minutes_to_start: float
    minutes_to_end: float


@dataclass(frozen=True)
class DisruptionInput:
    weather: WeatherInput = WeatherInput()
    events: List[EventInput] = field(default_factory=list)
    school_zone_active: bool = False
    incident_count: int = 0


@dataclass
class DisruptionScore:
    score: float
    level: str
    factors: List[str]


def event_impact(e: EventInput) -> float:
    size = min(e.expected_attendance / 20000, 1.5) * 25
    proximity = max(0.0, 1 - e.distance_km / 5)
    if 0 <= e.minutes_to_start <= 120:
        timing = 1 - e.minutes_to_start / 180  # crowds arriving
    elif e.minutes_to_start < 0 and e.minutes_to_end > 0:
        timing = 0.3  # event in progress
    elif -45 <= e.minutes_to_end <= 0:
        timing = 0.9  # crowds leaving
    else:
        timing = 0.0
    return size * proximity * timing


def score(inp: DisruptionInput) -> DisruptionScore:
    total = 0.0
    factors: List[str] = []
    impact = WEATHER_IMPACT.get(inp.weather.condition.upper())
    if impact:
        s = impact[0]
        if inp.weather.condition.upper() == "RAIN":
            s += min(inp.weather.rain_mm, 20)
        total += s
        factors.append(impact[1])
    for e in inp.events:
        s = event_impact(e)
        if s >= 1:
            total += s
            factors.append(f"Event traffic ({e.expected_attendance:,} expected, {e.distance_km:.1f} km from route)")
    if inp.school_zone_active:
        total += 10
        factors.append("Active school zone on route")
    if inp.incident_count > 0:
        total += min(inp.incident_count * 15, 30)
        factors.append(f"{inp.incident_count} reported incident(s)")
    total = round(clamp(total, 0, 100), 1)
    level = "LOW" if total < 20 else "MODERATE" if total < 45 else "HIGH" if total < 70 else "SEVERE"
    return DisruptionScore(score=total, level=level, factors=factors)
