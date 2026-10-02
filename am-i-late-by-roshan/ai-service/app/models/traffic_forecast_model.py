"""Traffic congestion forecast.

Heuristic model of UAE traffic: a congestion factor (1.0 = free flow, 2.0 =
trips take twice as long) built from time-of-day peaks per weekday type
(UAE weekend is Saturday/Sunday, Friday is a short working day), commuter
corridors (Sharjah/Ajman -> Dubai mornings and back in the evening), and —
when available — live crowd-sourced speed observations.

Swap-in point for a trained model: keep `TrafficInput` / `TrafficForecast`
and replace `predict()`.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import List, Optional

from .geo import LatLng, clamp, emirate_of, uae_local


@dataclass(frozen=True)
class TrafficInput:
    origin: LatLng
    destination: LatLng
    departure_time: datetime
    crowd_speed_ratio: Optional[float] = None  # observed speed / limit near origin, 0..1+


@dataclass
class ForecastPoint:
    departure_time: datetime
    congestion_factor: float
    level: str


@dataclass
class TrafficForecast:
    congestion_factor: float
    level: str
    peak_label: str
    forecast: List[ForecastPoint] = field(default_factory=list)


def _bump(h: float, center: float, width: float, height: float) -> float:
    return height * math.exp(-(((h - center) / width) ** 2))


def time_of_day_congestion(minutes_of_day: float, iso_dow: int) -> tuple[float, str]:
    """Extra congestion above free flow (0 = free flow) and a human label."""
    h = minutes_of_day / 60
    if iso_dow <= 4:  # Mon-Thu
        extra = _bump(h, 7.75, 1.0, 0.85) + _bump(h, 18.0, 1.4, 0.75) + _bump(h, 14.25, 0.8, 0.25)
    elif iso_dow == 5:  # Friday: short working day
        extra = _bump(h, 7.75, 1.0, 0.8) + _bump(h, 13.0, 1.0, 0.45) + _bump(h, 18.5, 1.8, 0.55)
    elif iso_dow == 6:  # Saturday
        extra = _bump(h, 12.5, 3.0, 0.25) + _bump(h, 20.0, 2.2, 0.45)
    else:  # Sunday
        extra = _bump(h, 13.0, 3.0, 0.2) + _bump(h, 19.5, 2.0, 0.4)

    weekday = iso_dow <= 5
    if weekday and 6.5 <= h < 9.5:
        label = "morning peak"
    elif weekday and 16.5 <= h < 20:
        label = "evening peak"
    elif weekday and 13.5 <= h < 15:
        label = "school pick-up"
    elif not weekday and 18 <= h < 23:
        label = "weekend evening"
    elif h >= 22 or h < 6:
        label = "night"
    else:
        label = "off-peak"
    return extra, label


def corridor_multiplier(origin: LatLng, destination: LatLng, minutes_of_day: float, iso_dow: int) -> float:
    src, dst = emirate_of(origin), emirate_of(destination)
    h = minutes_of_day / 60
    weekday = iso_dow <= 5
    northern = {"Sharjah", "Ajman", "Umm Al Quwain"}
    if weekday and src in northern and dst == "Dubai" and 5.5 <= h < 10.5:
        return 1.6
    if weekday and src == "Dubai" and dst in northern and 16 <= h < 21:
        return 1.6
    if {src, dst} == {"Abu Dhabi", "Dubai"}:
        return 0.8  # long highway trips: congestion is a smaller share of the drive
    return 1.0


def congestion_level(factor: float) -> str:
    if factor < 1.15:
        return "LOW"
    if factor < 1.4:
        return "MODERATE"
    if factor < 1.75:
        return "HEAVY"
    return "SEVERE"


def _factor_at(inp: TrafficInput, when: datetime) -> float:
    local = uae_local(when)
    minutes = local.hour * 60 + local.minute
    iso_dow = local.isoweekday()
    extra, _ = time_of_day_congestion(minutes, iso_dow)
    factor = 1 + extra * corridor_multiplier(inp.origin, inp.destination, minutes, iso_dow)
    if inp.crowd_speed_ratio is not None and inp.crowd_speed_ratio > 0:
        observed = 1 / clamp(inp.crowd_speed_ratio, 0.2, 1.2)
        factor = 0.6 * observed + 0.4 * factor
    return round(clamp(factor, 1.0, 3.0), 2)


def predict(inp: TrafficInput) -> TrafficForecast:
    factor = _factor_at(inp, inp.departure_time)
    local = uae_local(inp.departure_time)
    _, label = time_of_day_congestion(local.hour * 60 + local.minute, local.isoweekday())
    points = []
    for offset in range(-60, 61, 15):
        when = inp.departure_time + timedelta(minutes=offset)
        f = _factor_at(inp, when)
        points.append(ForecastPoint(departure_time=when, congestion_factor=f, level=congestion_level(f)))
    return TrafficForecast(congestion_factor=factor, level=congestion_level(factor), peak_label=label, forecast=points)
