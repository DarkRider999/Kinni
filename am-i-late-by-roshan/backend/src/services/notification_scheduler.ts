/**
 * Smart Commute Early-Warning job (every 5 minutes).
 *
 * For each active commute that runs today (UAE time) and whose arrival target
 * is within the next 3 hours, it re-plans the trip and:
 *  - sends EARLY_WARNING when the ETA grew by >= the user's threshold since the
 *    last check (at most one per 30 minutes per commute), and
 *  - sends LEAVE_NOW once per day when the recommended departure is within 10 minutes.
 */
import cron, { type ScheduledTask } from 'node-cron';
import { config } from '../config';
import { type CommuteProfile, listActiveCommuteProfiles, recordCommuteCheck } from '../db/models/CommuteProfile';
import { getDriverProfile } from '../db/models/DriverProfile';
import { getNotificationPreferences, isInQuietHours } from '../db/models/NotificationPreference';
import { logger } from '../logger';
import { formatUaeTime, uaeDateAt, uaeLocal } from '../utils/geo';
import { getEngine } from './engine_factory';
import { sendToUser } from './push_notification_service';
import type { SmartArrivalEngine } from './smart_arrival_engine';

const LOOKAHEAD_MIN = 180;
const LEAVE_NOW_LEAD_MIN = 10;
const ALERT_COOLDOWN_MIN = 30;

export interface CommuteCheckResult {
  commuteId: string;
  skipped?: string;
  etaMinutes?: number;
  sent: ('EARLY_WARNING' | 'LEAVE_NOW')[];
}

export async function checkCommute(c: CommuteProfile, now: Date, engine: SmartArrivalEngine = getEngine()): Promise<CommuteCheckResult> {
  const local = uaeLocal(now);
  if (!c.days_of_week.includes(local.isoDow)) return { commuteId: c.id, skipped: 'not today', sent: [] };
  const target = uaeDateAt(local.dateString, c.target_arrival_time);
  const minutesToTarget = (target.getTime() - now.getTime()) / 60_000;
  if (minutesToTarget <= 0 || minutesToTarget > LOOKAHEAD_MIN) return { commuteId: c.id, skipped: 'outside window', sent: [] };

  const [prefs, profile] = await Promise.all([getNotificationPreferences(c.user_id), getDriverProfile(c.user_id)]);
  const plan = await engine.plan({
    origin: { ...c.origin, label: c.origin_label },
    destination: { ...c.destination, label: c.destination_label },
    targetArrival: target,
    bufferMinutes: profile.buffer_minutes,
    now,
  });
  const preferred = plan.routes.find((r) => r.routeType === profile.preferred_route_type) ?? plan.routes[0];
  const eta = preferred.durationMinutes;
  const quiet = isInQuietHours(prefs, local.minutesOfDay);
  const sent: CommuteCheckResult['sent'] = [];
  const label = c.destination_label ?? c.name;

  const increase = c.last_eta_minutes != null ? eta - c.last_eta_minutes : 0;
  const cooledDown = !c.last_alert_at || now.getTime() - new Date(c.last_alert_at).getTime() > ALERT_COOLDOWN_MIN * 60_000;
  if (prefs.early_warning_enabled && !quiet && increase >= prefs.eta_increase_threshold_minutes && cooledDown) {
    await sendToUser(c.user_id, {
      kind: 'EARLY_WARNING',
      title: `Traffic worsened on your way to ${label}`,
      body: `Your commute now takes ~${Math.round(eta)} min (+${Math.round(increase)}). Leave by ${formatUaeTime(new Date(plan.recommendedDeparture))}.`,
      data: { commuteId: c.id, etaMinutes: Math.round(eta), recommendedDeparture: plan.recommendedDeparture },
    });
    sent.push('EARLY_WARNING');
  }

  const minutesToLeave = (new Date(plan.recommendedDeparture).getTime() - now.getTime()) / 60_000;
  if (prefs.leave_now_enabled && !quiet && minutesToLeave <= LEAVE_NOW_LEAD_MIN && c.last_leave_alert_on !== local.dateString) {
    await sendToUser(c.user_id, {
      kind: 'LEAVE_NOW',
      title: plan.verdict === 'LATE' ? `You're running late for ${label}` : `Time to leave for ${label}`,
      body:
        plan.verdict === 'LATE'
          ? `Leaving now, you'll arrive ~${plan.minutesLate} min after ${c.target_arrival_time}.`
          : `Leave ${minutesToLeave <= 1 ? 'now' : `in ${Math.round(minutesToLeave)} min`} ${preferred.summary} (~${Math.round(eta)} min).`,
      data: { commuteId: c.id, verdict: plan.verdict },
    });
    sent.push('LEAVE_NOW');
  }

  await recordCommuteCheck(c.id, eta, {
    alerted: sent.includes('EARLY_WARNING'),
    leaveAlertOn: sent.includes('LEAVE_NOW') ? local.dateString : undefined,
    at: now,
  });
  return { commuteId: c.id, etaMinutes: eta, sent };
}

let running = false;

export async function runEarlyWarningCycle(now = new Date()): Promise<CommuteCheckResult[]> {
  if (running) return [];
  running = true;
  try {
    const commutes = await listActiveCommuteProfiles();
    const results: CommuteCheckResult[] = [];
    for (const c of commutes) {
      try {
        results.push(await checkCommute(c, now));
      } catch (err) {
        logger.warn({ commuteId: c.id, err: (err as Error).message }, 'Commute check failed');
      }
    }
    const sent = results.reduce((n, r) => n + r.sent.length, 0);
    if (sent) logger.info({ checked: results.length, sent }, 'Early-warning cycle complete');
    return results;
  } finally {
    running = false;
  }
}

export function startNotificationScheduler(): ScheduledTask | null {
  if (!config.cronEnabled) return null;
  return cron.schedule('*/5 * * * *', () => {
    runEarlyWarningCycle().catch((err) => logger.error({ err }, 'Early-warning cycle crashed'));
  });
}
