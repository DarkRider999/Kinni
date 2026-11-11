/**
 * Place search / reverse geocoding via OpenStreetMap Nominatim (free, limited
 * to the UAE). A built-in list of landmarks is used when Nominatim is
 * unavailable, so the app always has something to offer.
 */
import { config } from '../config';
import { logger } from '../logger';
import { haversineKm, type LatLng } from '../utils/geo';
import { fetchJson, TtlCache } from '../utils/http';

export interface PlaceResult {
  label: string;
  address: string;
  lat: number;
  lng: number;
  source: 'nominatim' | 'builtin';
}

export const UAE_LANDMARKS: PlaceResult[] = [
  ['Dubai Mall', 'Downtown Dubai', 25.1972, 55.2796],
  ['Burj Khalifa', 'Downtown Dubai', 25.1972, 55.2744],
  ['Dubai International Airport (DXB) Terminal 3', 'Al Garhoud, Dubai', 25.2468, 55.3654],
  ['Dubai Marina Mall', 'Dubai Marina', 25.0763, 55.1401],
  ['Mall of the Emirates', 'Al Barsha, Dubai', 25.1181, 55.2006],
  ['Dubai Internet City', 'Dubai', 25.0955, 55.1616],
  ['DIFC (Gate Building)', 'Dubai International Financial Centre', 25.2138, 55.2821],
  ['Business Bay Metro Station', 'Business Bay, Dubai', 25.1913, 55.2606],
  ['Dubai World Trade Centre', 'Trade Centre, Dubai', 25.225, 55.287],
  ['Deira City Centre', 'Port Saeed, Dubai', 25.2522, 55.3325],
  ['Dubai Silicon Oasis HQ', 'Dubai Silicon Oasis', 25.1181, 55.3861],
  ['Expo City Dubai', 'Dubai South', 24.964, 55.151],
  ['Al Maktoum International Airport (DWC)', 'Dubai South', 24.8964, 55.1614],
  ['Jumeirah Beach Residence (JBR)', 'Dubai Marina', 25.0781, 55.1339],
  ['Sharjah City Centre', 'Al Qasimia, Sharjah', 25.3257, 55.3935],
  ['Sahara Centre', 'Al Nahda, Sharjah', 25.2973, 55.3726],
  ['University City Sharjah', 'Sharjah', 25.2866, 55.4788],
  ['Ajman City Centre', 'Al Jurf, Ajman', 25.3993, 55.4787],
  ['Sheikh Zayed Grand Mosque', 'Abu Dhabi', 24.4128, 54.4749],
  ['Abu Dhabi International Airport (AUH)', 'Abu Dhabi', 24.4431, 54.6511],
  ['Yas Mall', 'Yas Island, Abu Dhabi', 24.4886, 54.6089],
  ['Abu Dhabi Corniche', 'Abu Dhabi', 24.4764, 54.3239],
  ['Al Ain Mall', 'Al Ain', 24.2227, 55.7806],
  ['Ras Al Khaimah Manar Mall', 'Ras Al Khaimah', 25.7978, 55.9642],
  ['Fujairah City Centre', 'Fujairah', 25.1242, 56.3226],
].map(([label, address, lat, lng]) => ({ label: label as string, address: address as string, lat: lat as number, lng: lng as number, source: 'builtin' as const }));

function searchBuiltin(q: string, near?: LatLng): PlaceResult[] {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  return UAE_LANDMARKS.filter((p) => terms.every((t) => `${p.label} ${p.address}`.toLowerCase().includes(t)))
    .sort((a, b) => (near ? haversineKm(near, a) - haversineKm(near, b) : 0))
    .slice(0, 8);
}

const searchCache = new TtlCache<PlaceResult[]>(24 * 3600_000, 5000);

interface NominatimItem {
  display_name: string;
  name?: string;
  lat: string;
  lon: string;
}

export async function searchPlaces(q: string, near?: LatLng): Promise<PlaceResult[]> {
  const query = q.trim();
  if (query.length < 2) return [];
  const key = query.toLowerCase();
  const cached = searchCache.get(key);
  if (cached) return cached;
  const builtin = searchBuiltin(query, near);
  try {
    const params = new URLSearchParams({ q: query, format: 'jsonv2', countrycodes: 'ae', limit: '8', addressdetails: '0' });
    if (near) params.set('viewbox', `${near.lng - 0.5},${near.lat + 0.5},${near.lng + 0.5},${near.lat - 0.5}`);
    const items = await fetchJson<NominatimItem[]>(`${config.nominatimBaseUrl}/search?${params}`, {
      headers: { 'User-Agent': config.osmUserAgent, 'Accept-Language': 'en' },
    });
    const results: PlaceResult[] = items.map((i) => {
      const parts = i.display_name.split(',').map((s) => s.trim());
      return {
        label: i.name || parts[0],
        address: parts.slice(1, 4).join(', '),
        lat: Number(i.lat),
        lng: Number(i.lon),
        source: 'nominatim',
      };
    });
    const merged = [...builtin, ...results.filter((r) => !builtin.some((b) => haversineKm(b, r) < 0.2))].slice(0, 10);
    searchCache.set(key, merged);
    return merged;
  } catch (err) {
    logger.debug({ err: (err as Error).message }, 'Nominatim search failed');
    return builtin;
  }
}

export async function reverseGeocode(p: LatLng): Promise<PlaceResult> {
  const fallbackLabel = `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
  try {
    const params = new URLSearchParams({ lat: String(p.lat), lon: String(p.lng), format: 'jsonv2', zoom: '17' });
    const item = await fetchJson<NominatimItem & { error?: string }>(`${config.nominatimBaseUrl}/reverse?${params}`, {
      headers: { 'User-Agent': config.osmUserAgent, 'Accept-Language': 'en' },
    });
    if (item.error) throw new Error(item.error);
    const parts = item.display_name.split(',').map((s) => s.trim());
    return { label: item.name || parts.slice(0, 2).join(', '), address: parts.slice(1, 4).join(', '), lat: p.lat, lng: p.lng, source: 'nominatim' };
  } catch {
    const nearest = [...UAE_LANDMARKS].sort((a, b) => haversineKm(p, a) - haversineKm(p, b))[0];
    const label = haversineKm(p, nearest) < 1 ? `Near ${nearest.label}` : fallbackLabel;
    return { label, address: '', lat: p.lat, lng: p.lng, source: 'builtin' };
  }
}
