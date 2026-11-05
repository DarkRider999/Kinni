export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

/** Rounds to the step's precision so 0.1 + 0.2 shows as 0.3. */
export function snapToStep(value: number, step: number) {
  const decimals = (String(step).split('.')[1] ?? '').length
  return Number((Math.round(value / step) * step).toFixed(decimals))
}

/** "1:05", "12:03.4": media durations, always shown in tabular figures. */
export function formatDuration(ms: number, withTenths = false) {
  const safe = Math.max(0, Math.round(ms))
  const totalSec = Math.floor(safe / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  const base = `${m}:${String(s).padStart(2, '0')}`
  return withTenths ? `${base}.${Math.floor((safe % 1000) / 100)}` : base
}
