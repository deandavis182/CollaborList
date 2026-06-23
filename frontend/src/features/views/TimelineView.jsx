/**
 * TimelineView — week-bucket lens placing items by their due dates.
 *
 * PURE lens — no data fetching. Handlers via props only.
 *
 * Props:
 *   items       : array    — item objects (may have due_date)
 *   weddingDate : Date     — optional; renders a milestone marker in its week bucket
 *   onOpen      : function — called with item.id when an item is clicked
 *   now         : Date     — injected for deterministic tests (default: new Date())
 *
 * IMPORTANT: All date bucketing uses LOCAL date parts (getFullYear/getMonth/getDate),
 * NOT toISOString() which is UTC and causes off-by-one bugs near midnight.
 *
 * Week definition: Monday-based (ISO weeks). Given any date, its week key is
 * the YYYY-MM-DD of the Monday that starts the week containing that date.
 */

import { parseLocalDay, formatDay } from '../../lib/dates.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Format a local date as YYYY-MM-DD using LOCAL date parts.
 * NEVER uses toISOString() to avoid UTC offset bugs.
 */
function toLocalKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Given a Date, return the Date of the Monday starting its ISO week (local).
 * Sunday (dow=0) is treated as the last day of the previous week.
 */
function getMondayOfWeek(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const dow = d.getDay() // 0=Sun, 1=Mon, …, 6=Sat
  const offset = dow === 0 ? -6 : 1 - dow
  d.setDate(d.getDate() + offset)
  return d
}

/**
 * Return the Monday-keyed YYYY-MM-DD string for the week containing `date` (local).
 */
function weekKey(date) {
  return toLocalKey(getMondayOfWeek(date))
}

/**
 * Given an item's due_date (Date object, ISO string, or other parseable value),
 * return a local-date Monday key (YYYY-MM-DD). Returns null if due_date is falsy.
 */
function itemWeekKey(due_date) {
  if (!due_date) return null
  const d = parseLocalDay(due_date)
  if (!d) return null
  return weekKey(d)
}

/**
 * Produce a human-readable week label from a Monday key string (e.g. "Week of Jun 9").
 * The Monday key is YYYY-MM-DD; we parse it as local midnight via Date(y, m, d).
 */
function weekLabel(mondayKeyStr) {
  const [y, m, d] = mondayKeyStr.split('-').map(Number)
  const monday = new Date(y, m - 1, d)
  return `Week of ${monday.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
}

// ─── TimelineView ─────────────────────────────────────────────────────────────

export function TimelineView({
  items = [],
  weddingDate,
  onOpen,
  now = new Date(),
}) {
  // Separate dated vs undated items
  const dated = []
  const undated = []
  for (const item of items) {
    if (item.due_date) {
      dated.push(item)
    } else {
      undated.push(item)
    }
  }

  // Build week-bucket map: mondayKey → [items] sorted by due_date asc
  const bucketMap = new Map()

  for (const item of dated) {
    const key = itemWeekKey(item.due_date)
    if (!key) continue
    if (!bucketMap.has(key)) bucketMap.set(key, [])
    bucketMap.get(key).push(item)
  }

  // Sort items within each bucket by due_date ascending
  for (const [, bucket] of bucketMap) {
    bucket.sort((a, b) => {
      const da = parseLocalDay(a.due_date)
      const db = parseLocalDay(b.due_date)
      return (da?.getTime() ?? 0) - (db?.getTime() ?? 0)
    })
  }

  // Ensure wedding week exists (even if empty)
  const parsedWedding = parseLocalDay(weddingDate)
  const weddingWeekKey = parsedWedding ? weekKey(parsedWedding) : null
  if (weddingWeekKey && !bucketMap.has(weddingWeekKey)) {
    bucketMap.set(weddingWeekKey, [])
  }

  // Sort week keys ascending
  const sortedKeys = Array.from(bucketMap.keys()).sort()

  // Determine if there is anything at all to show
  const isEmpty = dated.length === 0 && undated.length === 0 && !weddingDate

  return (
    <div
      data-testid="timeline-view"
      style={{
        background: 'var(--color-bg)',
        color: 'var(--color-text)',
        padding: 'var(--space-4)',
        minHeight: '100%',
      }}
    >
      {/* Empty state */}
      {isEmpty && (
        <div
          data-testid="timeline-empty"
          style={{
            color: 'var(--color-text-muted)',
            fontSize: 'var(--text-sm)',
            textAlign: 'center',
            padding: 'var(--space-8) var(--space-4)',
          }}
        >
          Nothing scheduled
        </div>
      )}

      {/* Week buckets */}
      {sortedKeys.map((key) => {
        const bucketItems = bucketMap.get(key) || []
        const isWeddingWeek = key === weddingWeekKey

        return (
          <section
            key={key}
            data-testid={`tl-week-${key}`}
            style={{
              marginBottom: 'var(--space-6)',
            }}
          >
            {/* Week header */}
            <div
              style={{
                fontSize: 'var(--text-sm)',
                fontWeight: 700,
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: 'var(--space-2)',
                paddingBottom: 'var(--space-1)',
                borderBottom: '1px solid var(--color-border)',
              }}
            >
              {weekLabel(key)}
            </div>

            {/* Wedding milestone marker */}
            {isWeddingWeek && (
              <div
                data-testid="tl-wedding"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  padding: 'var(--space-2) var(--space-3)',
                  marginBottom: 'var(--space-2)',
                  background: 'var(--color-accent)',
                  color: 'var(--color-surface)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 700,
                }}
              >
                🎉{' '}
                <span>
                  Wedding Day —{' '}
                  {formatDay(weddingDate, {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>
            )}

            {/* Items in this bucket */}
            {bucketItems.map((item) => {
              const dateLabel = formatDay(item.due_date, {
                month: 'short',
                day: 'numeric',
              })

              return (
                <button
                  key={item.id}
                  data-testid={`tl-item-${item.id}`}
                  onClick={() => onOpen && onOpen(item.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 'var(--space-3)',
                    width: '100%',
                    textAlign: 'left',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: 'var(--space-2) var(--space-3)',
                    marginBottom: 'var(--space-1)',
                    cursor: 'pointer',
                    fontSize: 'var(--text-sm)',
                    color: 'var(--color-text)',
                  }}
                >
                  <span
                    style={{
                      flex: '0 0 auto',
                      fontSize: 'var(--text-xs)',
                      color: 'var(--color-text-muted)',
                      minWidth: '3.5rem',
                    }}
                  >
                    {dateLabel}
                  </span>
                  <span style={{ flex: 1 }}>{item.text}</span>
                </button>
              )
            })}

            {/* Empty week bucket (wedding week with no items) */}
            {bucketItems.length === 0 && !isWeddingWeek && (
              <div
                style={{
                  color: 'var(--color-text-muted)',
                  fontSize: 'var(--text-xs)',
                  padding: 'var(--space-1) 0',
                }}
              >
                No items this week
              </div>
            )}
          </section>
        )
      })}

      {/* Undated rail */}
      {undated.length > 0 && (
        <section
          data-testid="tl-undated"
          style={{
            marginTop: 'var(--space-4)',
          }}
        >
          <div
            style={{
              fontSize: 'var(--text-sm)',
              fontWeight: 700,
              color: 'var(--color-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 'var(--space-2)',
              paddingBottom: 'var(--space-1)',
              borderBottom: '1px solid var(--color-border)',
            }}
          >
            Undated
          </div>

          {undated.map((item) => (
            <button
              key={item.id}
              data-testid={`tl-item-${item.id}`}
              onClick={() => onOpen && onOpen(item.id)}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 'var(--space-3)',
                width: '100%',
                textAlign: 'left',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                padding: 'var(--space-2) var(--space-3)',
                marginBottom: 'var(--space-1)',
                cursor: 'pointer',
                fontSize: 'var(--text-sm)',
                color: 'var(--color-text)',
              }}
            >
              <span
                style={{
                  flex: '0 0 auto',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--color-text-muted)',
                  minWidth: '3.5rem',
                }}
              >
                —
              </span>
              <span style={{ flex: 1 }}>{item.text}</span>
            </button>
          ))}
        </section>
      )}
    </div>
  )
}
