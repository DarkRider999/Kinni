from datetime import datetime

import pytest

from app.models import disruption_score_model as dsm
from app.models import eta_model, traffic_forecast_model as tfm
from app.models.geo import UAE_TZ, LatLng, emirate_of
from app.services import driver_state_service as dss

DUBAI_MARINA = LatLng(25.0763, 55.1401)
DOWNTOWN = LatLng(25.1972, 55.2796)
SHARJAH = LatLng(25.3257, 55.3935)
ABU_DHABI = LatLng(24.4764, 54.3239)


def uae(y, m, d, hh, mm=0):
    """A UAE wall-clock time."""
    return datetime(y, m, d, hh, mm, tzinfo=UAE_TZ)


# 2026-09-28 is a Monday, 2026-10-03 a Saturday.
MONDAY_0800 = uae(2026, 9, 28, 8)
MONDAY_0300 = uae(2026, 9, 28, 3)
MONDAY_1800 = uae(2026, 9, 28, 18)
SATURDAY_0800 = uae(2026, 10, 3, 8)


class TestGeo:
    @pytest.mark.parametrize(
        "point,expected",
        [(DUBAI_MARINA, "Dubai"), (DOWNTOWN, "Dubai"), (SHARJAH, "Sharjah"), (ABU_DHABI, "Abu Dhabi"), (LatLng(51.5, -0.1), "Unknown")],
    )
    def test_emirate_of(self, point, expected):
        assert emirate_of(point) == expected


class TestTraffic:
    def predict(self, when, origin=DUBAI_MARINA, dest=DOWNTOWN, crowd=None):
        return tfm.predict(tfm.TrafficInput(origin=origin, destination=dest, departure_time=when, crowd_speed_ratio=crowd))

    def test_weekday_morning_peak_is_heavier_than_night(self):
        peak, night = self.predict(MONDAY_0800), self.predict(MONDAY_0300)
        assert peak.congestion_factor > 1.6
        assert night.congestion_factor < 1.05
        assert peak.peak_label == "morning peak"
        assert night.peak_label == "night"

    def test_weekend_morning_is_lighter_than_weekday(self):
        assert self.predict(SATURDAY_0800).congestion_factor < self.predict(MONDAY_0800).congestion_factor

    def test_sharjah_to_dubai_morning_corridor_is_worse(self):
        local = self.predict(MONDAY_0800)
        corridor = self.predict(MONDAY_0800, origin=SHARJAH, dest=DOWNTOWN)
        assert corridor.congestion_factor > local.congestion_factor
        assert corridor.level == "SEVERE"

    def test_evening_reverse_corridor(self):
        assert tfm.corridor_multiplier(DOWNTOWN, SHARJAH, 18 * 60, 1) == 1.6
        assert tfm.corridor_multiplier(DOWNTOWN, SHARJAH, 18 * 60, 6) == 1.0

    def test_crowd_observations_pull_the_forecast(self):
        slow = self.predict(MONDAY_0300, crowd=0.3)  # observed crawling at night, e.g. after a crash
        assert slow.congestion_factor > 2.0

    def test_forecast_window_has_nine_points_around_departure(self):
        out = self.predict(MONDAY_0800)
        assert len(out.forecast) == 9
        assert out.forecast[4].departure_time == MONDAY_0800

    @pytest.mark.parametrize("factor,level", [(1.0, "LOW"), (1.2, "MODERATE"), (1.5, "HEAVY"), (2.0, "SEVERE")])
    def test_levels(self, factor, level):
        assert tfm.congestion_level(factor) == level

    def test_factor_is_bounded(self):
        for hour in range(24):
            f = self.predict(uae(2026, 9, 29, hour), origin=SHARJAH, dest=DOWNTOWN).congestion_factor
            assert 1.0 <= f <= 3.0


class TestEta:
    def test_free_flow_clear_weather(self):
        out = eta_model.predict(eta_model.EtaInput(free_flow_minutes=20, distance_km=18))
        assert out.eta_minutes == 20
        assert out.p10_minutes <= out.eta_minutes <= out.p90_minutes
        assert out.confidence > 0.85

    def test_congestion_scales_eta_and_widens_band(self):
        calm = eta_model.predict(eta_model.EtaInput(free_flow_minutes=20, distance_km=18))
        busy = eta_model.predict(eta_model.EtaInput(free_flow_minutes=20, distance_km=18, congestion_factor=1.8))
        assert busy.eta_minutes == pytest.approx(36)
        assert (busy.p90_minutes - busy.eta_minutes) > (calm.p90_minutes - calm.eta_minutes)
        assert busy.confidence < calm.confidence

    def test_traffic_aware_duration_overrides_congestion(self):
        out = eta_model.predict(eta_model.EtaInput(free_flow_minutes=20, distance_km=18, congestion_factor=2.0, traffic_aware_minutes=25))
        assert out.eta_minutes == 25

    def test_traffic_aware_never_below_free_flow(self):
        out = eta_model.predict(eta_model.EtaInput(free_flow_minutes=20, distance_km=18, traffic_aware_minutes=15))
        assert out.eta_minutes == 20

    @pytest.mark.parametrize(
        "weather,factor",
        [
            (eta_model.WeatherInput("CLEAR"), 1.0),
            (eta_model.WeatherInput("RAIN", rain_mm=5), 1.25),
            (eta_model.WeatherInput("FOG", visibility_km=0.1), 1.45),
            (eta_model.WeatherInput("FOG", visibility_km=0.5), 1.3),
            (eta_model.WeatherInput("SANDSTORM"), 1.35),
        ],
    )
    def test_weather_factor(self, weather, factor):
        assert eta_model.weather_factor(weather) == pytest.approx(factor)

    def test_school_zones_and_disruption_add_time(self):
        out = eta_model.predict(eta_model.EtaInput(free_flow_minutes=20, distance_km=18, school_zone_count=2, disruption_score=40))
        assert out.eta_minutes == pytest.approx(20 * 1.1 + 3)
        assert out.breakdown["school_zone_minutes"] == 3

    def test_confidence_bounds(self):
        worst = eta_model.predict(
            eta_model.EtaInput(free_flow_minutes=30, distance_km=30, congestion_factor=3, weather=eta_model.WeatherInput("SANDSTORM"), disruption_score=100)
        )
        assert 0.3 <= worst.confidence <= 0.97


class TestDisruption:
    def test_clear_day_is_low(self):
        out = dsm.score(dsm.DisruptionInput())
        assert out.score == 0 and out.level == "LOW" and out.factors == []

    def test_big_event_starting_soon_nearby(self):
        event = dsm.EventInput(expected_attendance=30000, distance_km=0.5, minutes_to_start=30, minutes_to_end=210)
        out = dsm.score(dsm.DisruptionInput(events=[event]))
        assert out.score > 20
        assert any("Event traffic" in f for f in out.factors)

    def test_far_or_past_events_are_ignored(self):
        far = dsm.EventInput(expected_attendance=30000, distance_km=8, minutes_to_start=30, minutes_to_end=200)
        over = dsm.EventInput(expected_attendance=30000, distance_km=0.5, minutes_to_start=-400, minutes_to_end=-200)
        assert dsm.score(dsm.DisruptionInput(events=[far, over])).score == 0

    def test_everything_bad_is_capped(self):
        out = dsm.score(
            dsm.DisruptionInput(
                weather=eta_model.WeatherInput("SANDSTORM"),
                events=[dsm.EventInput(60000, 0, 10, 200)] * 3,
                school_zone_active=True,
                incident_count=5,
            )
        )
        assert out.score == 100 and out.level == "SEVERE"


class TestDriverState:
    def test_fresh_daytime_driver_is_alert(self):
        out = dss.assess(dss.DriverStateInput(continuous_drive_minutes=20, local_hour=10))
        assert out.level == "ALERT" and not out.should_alert

    def test_long_night_drive_with_weaving_alerts(self):
        out = dss.assess(dss.DriverStateInput(continuous_drive_minutes=200, local_hour=3, steering_variance=0.4, harsh_event_count=1))
        assert out.should_alert
        assert out.level in {"TIRED", "DANGER"}

    def test_little_sleep_raises_score(self):
        rested = dss.assess(dss.DriverStateInput(continuous_drive_minutes=60, local_hour=9, hours_slept=8))
        tired = dss.assess(dss.DriverStateInput(continuous_drive_minutes=60, local_hour=9, hours_slept=3))
        assert tired.fatigue_score - rested.fatigue_score == pytest.approx(15)
