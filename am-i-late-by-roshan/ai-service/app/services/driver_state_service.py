"""Driver fatigue scoring from on-device sensor aggregates.

Inputs are aggregates the app computes locally (no raw sensor streams leave
the phone): continuous drive time, local hour (circadian dips at 02-06 and
14-16), steering/lateral-acceleration variance (weaving), harsh braking or
swerving events, and optionally self-reported sleep.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from app.models.geo import clamp

ALERT_THRESHOLD = 60.0


@dataclass(frozen=True)
class DriverStateInput:
    continuous_drive_minutes: float
    local_hour: int
    steering_variance: float = 0.0
    harsh_event_count: int = 0
    speed_variance: float = 0.0
    hours_slept: Optional[float] = None


@dataclass
class DriverState:
    fatigue_score: float
    level: str
    should_alert: bool
    recommendation: str


def circadian_risk(hour: int) -> float:
    if 2 <= hour < 6:
        return 25.0
    if 0 <= hour < 2:
        return 15.0
    if 14 <= hour < 16:
        return 10.0
    if hour >= 22:
        return 8.0
    return 0.0


def assess(inp: DriverStateInput) -> DriverState:
    time_on_task = min(inp.continuous_drive_minutes / 240, 1) * 40
    steering = clamp(inp.steering_variance / 0.5, 0, 1) * 20
    harsh = min(inp.harsh_event_count * 5, 15)
    sleep = min((6 - inp.hours_slept) * 5, 20) if inp.hours_slept is not None and inp.hours_slept < 6 else 0.0
    score = round(clamp(time_on_task + circadian_risk(inp.local_hour) + steering + harsh + sleep, 0, 100), 1)

    if score < 30:
        level, rec = "ALERT", "You seem alert. Drive safely."
    elif score < 50:
        level, rec = "MILD", "Stay hydrated and plan a break within the next 30 minutes."
    elif score < 70:
        level, rec = "TIRED", "Signs of fatigue detected. Take a break at the next petrol station or rest area."
    else:
        level, rec = "DANGER", "Pull over safely now and rest. Consider a 20-minute nap before continuing."
    return DriverState(fatigue_score=score, level=level, should_alert=score >= ALERT_THRESHOLD, recommendation=rec)
