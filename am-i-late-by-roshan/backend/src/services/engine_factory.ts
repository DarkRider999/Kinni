import { getAiClient } from './ai_client';
import { getRoutes } from './directions_service';
import { eventsNearRoute } from './event_service';
import { schoolZonesOnRoute } from './school_zone_service';
import { createSmartArrivalEngine, type SmartArrivalEngine } from './smart_arrival_engine';
import { crowdSpeedNear } from './traffic_service';
import { getCurrentWeather } from './weather_service';

let engine: SmartArrivalEngine | null = null;

/** The production engine wired to real services. */
export function getEngine(): SmartArrivalEngine {
  if (!engine) {
    engine = createSmartArrivalEngine({
      directions: getRoutes,
      weather: getCurrentWeather,
      events: eventsNearRoute,
      schoolZones: (path, at) => schoolZonesOnRoute(path, at),
      crowdSpeedRatio: async (p) => (await crowdSpeedNear(p))?.ratio ?? null,
      ai: getAiClient(),
    });
  }
  return engine;
}

export function setEngineForTests(custom: SmartArrivalEngine | null): void {
  engine = custom;
}
