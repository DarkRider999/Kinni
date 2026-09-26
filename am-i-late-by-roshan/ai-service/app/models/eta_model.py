"""ETA with an uncertainty band.

eta = traffic_time x weather_factor x disruption_multiplier + school-zone delay
where traffic_time is the provider's traffic-aware duration when available,
else free-flow x congestion factor. The band (p10/p90) widens with congestion,
bad weather and disruption; confidence is derived from its width.

Swap-in point for a trained model (e.g. gradient-boosted quantile regression
on traffic_snapshots): keep `EtaInput` / `EtaPrediction`, replace `predict()`.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, Optional

from .geo import clamp

Z90 = 1.2816  # z-score of the 90th percentile


@dataclass(frozen=True)
class WeatherInput:
    condition: str = "CLEAR"  # CLEAR | CLOUDY | RAIN | FOG | DUST | SANDSTORM | HEAT
    visibility_km: Optional[float] = None
    rain_mm: float = 0.0


@dataclass(frozen=True)
class EtaInput:
    free_flow_minutes: float
    distance_km: float
    congestion_factor: float = 1.0
    traffic_aware_minutes: Optional[float] = None
    weather: WeatherInput = WeatherInput()
    disruption_score: float = 0.0
    school_zone_count: int = 0


@dataclass
class EtaPrediction:
    eta_minutes: float
    p10_minutes: float
    p90_minutes: float
    confidence: float
    breakdown: Dict[str, float] = field(default_factory=dict)


def weather_factor(w: WeatherInput) -> float:
    c = w.condition.upper()
    if c == "RAIN":
        return 1.2 + min(w.rain_mm, 20) * 0.01
    if c == "FOG":
        if w.visibility_km is not None and w.visibility_km < 0.2:
            return 1.45
        if w.visibility_km is not None and w.visibility_km < 1:
            return 1.3
        return 1.12
    if c == "SANDSTORM":
        return 1.35
    if c == "DUST":
        return 1.08
    if c == "HEAT":
        return 1.02
    return 1.0


def predict(inp: EtaInput) -> EtaPrediction:
    wf = weather_factor(inp.weather)
    if inp.traffic_aware_minutes is not None:
        traffic_min = max(inp.traffic_aware_minutes, inp.free_flow_minutes)
    else:
        traffic_min = inp.free_flow_minutes * inp.congestion_factor
    disruption = clamp(inp.disruption_score, 0, 100)
    disruption_mult = 1 + disruption / 100 * 0.25
    school_delay = inp.school_zone_count * 1.5
    eta = traffic_min * wf * disruption_mult + school_delay

    sigma = clamp(0.06 + 0.12 * (inp.congestion_factor - 1) + (wf - 1) * 0.5 + disruption / 100 * 0.15, 0.05, 0.45)
    # Delays skew late: the early side of the band is narrower than the late side.
    p10 = max(inp.free_flow_minutes * 0.95, eta * (1 - Z90 * sigma * 0.8))
    p90 = eta * (1 + Z90 * sigma)
    confidence = clamp(1 - sigma * 1.5, 0.3, 0.97)

    return EtaPrediction(
        eta_minutes=round(eta, 1),
        p10_minutes=round(p10, 1),
        p90_minutes=round(p90, 1),
        confidence=round(confidence, 2),
        breakdown={
            "base_minutes": round(inp.free_flow_minutes, 1),
            "traffic_minutes": round(traffic_min - inp.free_flow_minutes, 1),
            "weather_minutes": round(traffic_min * (wf - 1), 1),
            "disruption_minutes": round(traffic_min * wf * (disruption_mult - 1), 1),
            "school_zone_minutes": round(school_delay, 1),
        },
    )
