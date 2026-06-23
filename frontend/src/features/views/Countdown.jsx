/**
 * Countdown — banner showing days until/since the wedding date.
 *
 * PURE component — no data fetching. Inject `now` for deterministic tests.
 *
 * Props:
 *   weddingDate : string | Date | null — the wedding date (raw value; parsed internally)
 *   now         : Date                 — current date (default: new Date())
 */

import { daysUntil, formatDay } from '../../lib/dates.js'

export function Countdown({ weddingDate, now = new Date() }) {
  if (!weddingDate) return null

  const days = daysUntil(weddingDate, now)
  if (days === null) return null

  let message
  if (days > 0) {
    const dateStr = formatDay(weddingDate)
    message = `${days} days until the big day 🎉 (${dateStr})`
  } else if (days === 0) {
    message = 'The big day is today! 🎉'
  } else {
    message = 'The big day has passed'
  }

  return (
    <div
      data-testid="countdown"
      style={{
        background: 'var(--color-primary)',
        color: 'var(--color-surface)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-3) var(--space-4)',
        marginBottom: 'var(--space-4)',
        fontWeight: 600,
        fontSize: 'var(--text-sm)',
        textAlign: 'center',
        letterSpacing: '0.01em',
      }}
    >
      {message}
    </div>
  )
}
