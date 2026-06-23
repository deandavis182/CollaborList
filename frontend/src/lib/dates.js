/**
 * dates.js — shared local-date utility.
 *
 * Fixes the pervasive YYYY-MM-DD off-by-one: new Date("2026-10-17") parses as
 * UTC midnight and shifts back a calendar day in behind-UTC timezones.
 * We extract the calendar day from the ISO string directly so we never involve UTC.
 */

/**
 * parseLocalDay(value) → Date at LOCAL midnight of the intended calendar day, or null.
 *
 * - If value is a string: take the first 10 chars (handles "2026-10-17" and
 *   "2026-10-17T00:00:00.000Z"), match ^(\d{4})-(\d{2})-(\d{2})$, and construct
 *   new Date(y, m-1, d) — LOCAL midnight, no UTC shift.
 * - Otherwise falls back to new Date(value).
 * - Returns null for falsy input or NaN dates.
 */
export function parseLocalDay(value) {
  if (!value) return null
  if (typeof value === 'string' || value instanceof String) {
    const s = String(value).slice(0, 10)
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (m) {
      const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
      return isNaN(d.getTime()) ? null : d
    }
  }
  const d = new Date(value)
  return isNaN(d.getTime()) ? null : d
}

/**
 * formatDay(value, opts) → locale date string for the intended calendar day, or ''.
 * opts are passed directly to Date.prototype.toLocaleDateString.
 */
export function formatDay(value, opts) {
  const d = parseLocalDay(value)
  if (!d) return ''
  return d.toLocaleDateString(undefined, opts)
}

/**
 * daysUntil(value, now = new Date()) → whole days from local-midnight(now) to
 * parseLocalDay(value). Returns null if value is invalid.
 */
export function daysUntil(value, now = new Date()) {
  const target = parseLocalDay(value)
  if (!target) return null
  const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const ms = target.getTime() - nowMidnight.getTime()
  return Math.round(ms / (1000 * 60 * 60 * 24))
}
