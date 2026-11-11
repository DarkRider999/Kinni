"""Small geographic helpers shared by the heuristic models."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

UAE_TZ = timezone(timedelta(hours=4))  # Asia/Dubai: fixed UTC+4, no DST.


@dataclass(frozen=True)
class LatLng:
    lat: float
    lng: float


def emirate_of(p: LatLng) -> str:
    """Coarse emirate lookup by bounding boxes (mirrors backend/src/utils/geo.ts)."""
    lat, lng = p.lat, p.lng
    if lat < 22.5 or lat > 26.2 or lng < 51.5 or lng > 56.5:
        return "Unknown"
    if lng >= 55.9:
        return "Fujairah"
    if lat >= 25.55:
        return "Ras Al Khaimah"
    if lat >= 25.47:
        return "Umm Al Quwain"
    if lat >= 25.37 and lng >= 55.42:
        return "Ajman"
    if lat >= 25.27 and lng >= 55.36:
        return "Sharjah"
    if lat >= 24.75 and lng >= 54.95:
        return "Dubai"
    return "Abu Dhabi"


def uae_local(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(UAE_TZ)


def clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))
