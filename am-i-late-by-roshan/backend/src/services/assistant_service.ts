/**
 * "Ask Roshan" assistant. Always gathers real context (the user's commutes,
 * latest trip, a fresh plan for their next commute, weather, tolls) and then:
 *  - with LLM_API_KEY set: asks Claude (Anthropic Messages API) to answer from that context;
 *  - without a key (free mode): answers with built-in intent rules.
 */
import { config } from '../config';
import { type CommuteProfile, listCommuteProfiles } from '../db/models/CommuteProfile';
import { getDriverProfile } from '../db/models/DriverProfile';
import { listTrips } from '../db/models/Trip';
import { logger } from '../logger';
import { formatUaeTime, type LatLng, uaeDateAt, uaeLocal } from '../utils/geo';
import { getEngine } from './engine_factory';
import { estimateParkingTariff } from './parking_service';
import { salikFeeAed, darbFeeAed } from './toll_service';
import type { PlanResult } from './types';
import { getCurrentWeather } from './weather_service';

export interface AssistantReply {
  reply: string;
  intent: string;
  source: 'llm' | 'rules';
  plan?: PlanResult;
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

/** The next occurrence of a commute (today if its arrival time is still ahead, else the next active day). */
export function nextCommuteArrival(c: CommuteProfile, now: Date): Date {
  for (let offset = 0; offset < 8; offset++) {
    const day = new Date(now.getTime() + offset * 86_400_000);
    const local = uaeLocal(day);
    if (!c.days_of_week.includes(local.isoDow)) continue;
    const at = uaeDateAt(local.dateString, c.target_arrival_time);
    if (at > now) return at;
  }
  return uaeDateAt(uaeLocal(new Date(now.getTime() + 86_400_000)).dateString, c.target_arrival_time);
}

function pickCommute(commutes: CommuteProfile[], message: string): CommuteProfile | undefined {
  const m = message.toLowerCase();
  return commutes.find((c) => m.includes(c.name.toLowerCase()) || (c.destination_label && m.includes(c.destination_label.toLowerCase()))) ?? commutes[0];
}

export function detectIntent(message: string): string {
  const m = message.toLowerCase();
  if (/\b(late|leave|when should|what time|on time|departure|commute|eta|how long)\b/.test(m)) return 'commute';
  if (/\b(salik|darb|toll)\b/.test(m)) return 'tolls';
  if (/\b(park|parking)\b/.test(m)) return 'parking';
  if (/\b(weather|rain|fog|dust|sandstorm|hot)\b/.test(m)) return 'weather';
  if (/\b(tired|sleepy|fatigue|break)\b/.test(m)) return 'fatigue';
  if (/\b(hi|hello|salam|hey)\b/.test(m)) return 'greeting';
  return 'help';
}

async function ruleReply(intent: string, ctx: { commute?: CommuteProfile; plan?: PlanResult; location?: LatLng; now: Date }): Promise<string> {
  const { commute, plan, location, now } = ctx;
  switch (intent) {
    case 'commute':
      if (!commute || !plan) return 'Add a commute in Settings > My commutes (e.g. Home to Work, arrive 08:30) and I can tell you exactly when to leave.';
      return plan.explanation;
    case 'tolls': {
      const s = salikFeeAed(now);
      const d = darbFeeAed(now);
      const route = plan?.routes[0];
      const onRoute = route ? ` Your ${commute?.name ?? 'commute'} ${route.summary} costs AED ${route.tollCostAed} in tolls.` : '';
      return `Right now a Salik gate costs AED ${s} and a DARB gate AED ${d}. Salik is AED 6 at peak (06-10, 16-20 Mon-Sat), AED 4 off-peak, free 01-06; DARB is AED 4 at peak (07-09, 17-19 Mon-Sat) and free otherwise.${onRoute}`;
    }
    case 'parking': {
      const p = location ?? commute?.destination;
      if (!p) return 'Share your location or add a commute and I can estimate parking tariffs there.';
      const t = estimateParkingTariff(p, now);
      return t.free ? `${t.note} in ${t.emirate}.` : `${t.note} in ${t.emirate}: about AED ${t.standardAedPerHour}/h standard, AED ${t.premiumAedPerHour}/h premium. Open the trip result to see nearby car parks.`;
    }
    case 'weather': {
      const p = location ?? commute?.origin;
      if (!p) return 'Share your location and I will check the weather for your drive.';
      const w = await getCurrentWeather(p);
      return w.source === 'default' ? "I couldn't reach the weather service just now." : `${w.description}${w.temperatureC != null ? `, ${Math.round(w.temperatureC)}°C` : ''}${w.visibilityKm != null ? `, visibility ${w.visibilityKm} km` : ''}.`;
    }
    case 'fatigue':
      return 'If you feel sleepy, pull over somewhere safe (a petrol station or rest area) and rest for 15-20 minutes. During navigation I watch your drive time and steering and will warn you if you seem tired.';
    case 'greeting':
      return `Hi! Ask me "Am I late for work?", "How much Salik will I pay?", or "Is parking free now?".`;
    default:
      return 'I can tell you when to leave, whether you are running late, what tolls you will pay, parking tariffs and the weather on your route. Try "When should I leave for work?"';
  }
}

async function llmReply(message: string, history: ChatTurn[], context: Record<string, unknown>): Promise<string> {
  const system = [
    'You are "Am I Late? by Roshan", a friendly UAE commute assistant.',
    'Answer in at most 4 short sentences. Use UAE local time (24h) and AED.',
    'Only use the facts in the JSON context; if something is unknown, say so. Never invent traffic incidents.',
    'Safety first: never encourage speeding or using the phone while driving.',
    `Context: ${JSON.stringify(context)}`,
  ].join('\n');
  const res = await fetch(`${config.llmBaseUrl}/v1/messages`, {
    method: 'POST',
    headers: { 'x-api-key': config.llmApiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: config.llmModel,
      max_tokens: 400,
      system,
      messages: [...history.slice(-8), { role: 'user', content: message }],
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`LLM HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { content: { type: string; text?: string }[] };
  const text = data.content.filter((c) => c.type === 'text').map((c) => c.text).join('').trim();
  if (!text) throw new Error('Empty LLM response');
  return text;
}

export async function answer(userId: string, message: string, opts: { location?: LatLng; history?: ChatTurn[]; now?: Date } = {}): Promise<AssistantReply> {
  const now = opts.now ?? new Date();
  const intent = detectIntent(message);
  const [commutes, profile, trips] = await Promise.all([listCommuteProfiles(userId), getDriverProfile(userId), listTrips(userId, 3)]);
  const commute = pickCommute(commutes.filter((c) => c.active), message);

  let plan: PlanResult | undefined;
  if (commute && (intent === 'commute' || intent === 'tolls' || config.llmApiKey)) {
    try {
      const origin = opts.location && intent === 'commute' ? { ...opts.location, label: 'Current location' } : { ...commute.origin, label: commute.origin_label };
      plan = await getEngine().plan({
        origin,
        destination: { ...commute.destination, label: commute.destination_label },
        targetArrival: nextCommuteArrival(commute, now),
        bufferMinutes: profile.buffer_minutes,
        now,
      });
    } catch (err) {
      logger.warn({ err: (err as Error).message }, 'Assistant could not plan commute');
    }
  }

  if (config.llmApiKey) {
    try {
      const context = {
        nowUae: `${uaeLocal(now).dateString} ${formatUaeTime(now)}`,
        salikFeeNowAed: salikFeeAed(now),
        darbFeeNowAed: darbFeeAed(now),
        commutes: commutes.map((c) => ({ name: c.name, from: c.origin_label, to: c.destination_label, arriveBy: c.target_arrival_time, days: c.days_of_week })),
        nextCommutePlan: plan && {
          commute: commute?.name,
          verdict: plan.verdict,
          minutesLate: plan.minutesLate,
          leaveBy: formatUaeTime(new Date(plan.recommendedDeparture)),
          arriveAt: formatUaeTime(new Date(plan.expectedArrival)),
          explanation: plan.explanation,
          routes: plan.routes.map((r) => ({ type: r.routeType, summary: r.summary, minutes: r.durationMinutes, tollsAed: r.tollCostAed, stress: r.stressScore })),
          weather: plan.context.weather.description,
        },
        recentTrips: trips.map((t) => ({ to: t.destination_label, verdict: t.verdict, at: t.created_at })),
        driverProfile: { bufferMinutes: profile.buffer_minutes, preferredRoute: profile.preferred_route_type },
        parkingAtLocation: opts.location ? estimateParkingTariff(opts.location, now) : undefined,
      };
      return { reply: await llmReply(message, opts.history ?? [], context), intent, source: 'llm', plan };
    } catch (err) {
      logger.warn({ err: (err as Error).message }, 'LLM unavailable; falling back to rules');
    }
  }
  return { reply: await ruleReply(intent, { commute, plan, location: opts.location, now }), intent, source: 'rules', plan };
}
