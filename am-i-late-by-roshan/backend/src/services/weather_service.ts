/**
 * Current weather at a point. Uses Open-Meteo (free, no API key) by default,
 * or OpenWeather when OPENWEATHER_API_KEY is set. Falls back to CLEAR.
 */
import { config } from '../config';
import { logger } from '../logger';
import type { LatLng } from '../utils/geo';
import { fetchJson, TtlCache } from '../utils/http';
import type { WeatherCondition, WeatherNow } from './types';

const cache = new TtlCache<WeatherNow>(10 * 60_000);

export const DEFAULT_WEATHER: WeatherNow = {
  condition: 'CLEAR',
  temperatureC: null,
  visibilityKm: null,
  rainMm: 0,
  windKmh: null,
  description: 'Weather unavailable (assuming clear)',
  source: 'default',
};

/** WMO weather code (Open-Meteo) to our condition set, refined by visibility/wind/temperature. */
export function classifyOpenMeteo(code: number, visibilityM: number | null, windKmh: number | null, tempC: number | null): WeatherCondition {
  const visKm = visibilityM != null ? visibilityM / 1000 : null;
  if (code === 45 || code === 48) return 'FOG';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95) return 'RAIN';
  if (visKm != null && visKm < 1 && (windKmh ?? 0) >= 35) return 'SANDSTORM';
  if (visKm != null && visKm < 3) return (windKmh ?? 0) >= 20 ? 'DUST' : 'FOG';
  if (tempC != null && tempC >= 46) return 'HEAT';
  return code >= 2 ? 'CLOUDY' : 'CLEAR';
}

const DESCRIPTIONS: Record<WeatherCondition, string> = {
  CLEAR: 'Clear skies',
  CLOUDY: 'Cloudy',
  RAIN: 'Rain',
  FOG: 'Fog',
  DUST: 'Dusty, reduced visibility',
  SANDSTORM: 'Sandstorm',
  HEAT: 'Extreme heat',
};

async function openMeteo(p: LatLng): Promise<WeatherNow> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lng}&current=temperature_2m,precipitation,weather_code,visibility,wind_speed_10m&timezone=Asia%2FDubai`;
  const data = await fetchJson<{
    current: { temperature_2m: number; precipitation: number; weather_code: number; visibility?: number; wind_speed_10m: number };
  }>(url);
  const c = data.current;
  const condition = classifyOpenMeteo(c.weather_code, c.visibility ?? null, c.wind_speed_10m, c.temperature_2m);
  return {
    condition,
    temperatureC: c.temperature_2m,
    visibilityKm: c.visibility != null ? Math.round(c.visibility / 100) / 10 : null,
    rainMm: c.precipitation ?? 0,
    windKmh: c.wind_speed_10m,
    description: DESCRIPTIONS[condition],
    source: 'open-meteo',
  };
}

export function classifyOpenWeather(main: string, visibilityM: number | null, tempC: number | null): WeatherCondition {
  const m = main.toLowerCase();
  if (m === 'rain' || m === 'drizzle' || m === 'thunderstorm') return 'RAIN';
  if (m === 'fog' || m === 'mist' || m === 'haze') return 'FOG';
  if (m === 'sand' || m === 'dust') return visibilityM != null && visibilityM < 1000 ? 'SANDSTORM' : 'DUST';
  if (tempC != null && tempC >= 46) return 'HEAT';
  return m === 'clouds' ? 'CLOUDY' : 'CLEAR';
}

async function openWeather(p: LatLng): Promise<WeatherNow> {
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${p.lat}&lon=${p.lng}&units=metric&appid=${config.openWeatherApiKey}`;
  const data = await fetchJson<{
    weather: { main: string; description: string }[];
    main: { temp: number };
    visibility?: number;
    wind?: { speed: number };
    rain?: { '1h'?: number };
  }>(url);
  const condition = classifyOpenWeather(data.weather[0]?.main ?? 'Clear', data.visibility ?? null, data.main.temp);
  return {
    condition,
    temperatureC: data.main.temp,
    visibilityKm: data.visibility != null ? data.visibility / 1000 : null,
    rainMm: data.rain?.['1h'] ?? 0,
    windKmh: data.wind ? Math.round(data.wind.speed * 3.6) : null,
    description: data.weather[0]?.description ?? DESCRIPTIONS[condition],
    source: 'openweather',
  };
}

export async function getCurrentWeather(p: LatLng): Promise<WeatherNow> {
  const key = `${p.lat.toFixed(1)},${p.lng.toFixed(1)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  try {
    const weather = config.openWeatherApiKey ? await openWeather(p) : await openMeteo(p);
    cache.set(key, weather);
    return weather;
  } catch (err) {
    logger.debug({ err: (err as Error).message }, 'Weather lookup failed');
    return DEFAULT_WEATHER;
  }
}
