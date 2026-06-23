/**
 * Countdown — banner showing days until/since the wedding date.
 *
 * PURE component — no data fetching. Inject `now` for deterministic tests.
 *
 * Props:
 *   weddingDate : Date | null   — the wedding date (local midnight)
 *   now         : Date          — current date (default: new Date())
 */

/**
 * Compute the whole-day difference between two dates using LOCAL date parts.
 * Returns positive when target is in the future, negative when in the past.
 */
function localDayDiff(now, target) {
  // Truncate both to local midnight to avoid time-of-day offsets
  const nowMidnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  )
  const targetMidnight = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate(),
  )
  const ms = targetMidnight.getTime() - nowMidnight.getTime()
  return Math.round(ms / (1000 * 60 * 60 * 24))
}

export function Countdown({ weddingDate, now = new Date() }) {
  if (!weddingDate) return null

  const days = localDayDiff(now, weddingDate)

  let message
  if (days > 0) {
    const dateStr = weddingDate.toLocaleDateString()
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
