/**
 * CalendarView — month-grid lens placing items on their due dates.
 *
 * PURE lens — no data fetching. Handlers via props only.
 *
 * Props:
 *   items       : array   — item objects (may have due_date)
 *   weddingDate : Date    — optional; marks that day cell with a 🎉 indicator
 *   onOpen      : function — called with item.id when an item is clicked
 *   now         : Date    — injected for deterministic tests (default: new Date())
 *
 * IMPORTANT: All day bucketing uses LOCAL date parts (getFullYear/getMonth/getDate),
 * NOT toISOString() which is UTC and causes off-by-one bugs near midnight.
 */

import { useState } from 'react'
import { Countdown } from './Countdown.jsx'
import { parseLocalDay } from '../../lib/dates.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

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
 * Given an item's due_date (which may be a Date object, ISO string, or other
 * parseable value), return a local-date key (YYYY-MM-DD) using LOCAL date parts.
 * Returns null if due_date is falsy.
 */
function itemLocalKey(due_date) {
  if (!due_date) return null
  const d = parseLocalDay(due_date)
  if (!d) return null
  return toLocalKey(d)
}

/**
 * Build the grid cells for a given year/month.
 * Returns an array of { date: Date | null } objects (nulls = leading/trailing blanks).
 */
function buildMonthGrid(year, month) {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startDow = firstDay.getDay()   // 0=Sun
  const daysInMonth = lastDay.getDate()

  const cells = []

  // Leading blank cells
  for (let i = 0; i < startDow; i++) {
    cells.push(null)
  }

  // Day cells
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(year, month, d))
  }

  return cells
}

// ─── CalendarView ─────────────────────────────────────────────────────────────

export function CalendarView({
  items = [],
  weddingDate,
  onOpen,
  now = new Date(),
}) {
  // viewedMonth tracks {year, month} (month is 0-indexed)
  const [viewedYear, setViewedYear] = useState(now.getFullYear())
  const [viewedMonth, setViewedMonth] = useState(now.getMonth())

  function prevMonth() {
    if (viewedMonth === 0) {
      setViewedYear((y) => y - 1)
      setViewedMonth(11)
    } else {
      setViewedMonth((m) => m - 1)
    }
  }

  function nextMonth() {
    if (viewedMonth === 11) {
      setViewedYear((y) => y + 1)
      setViewedMonth(0)
    } else {
      setViewedMonth((m) => m + 1)
    }
  }

  // Build map: localKey → [items]
  const itemsByDay = {}
  for (const item of items) {
    const key = itemLocalKey(item.due_date)
    if (!key) continue
    if (!itemsByDay[key]) itemsByDay[key] = []
    itemsByDay[key].push(item)
  }

  // Wedding day key (local parts)
  const parsedWedding = parseLocalDay(weddingDate)
  const weddingKey = parsedWedding ? toLocalKey(parsedWedding) : null

  // Is wedding in the viewed month?
  const weddingInView =
    parsedWedding !== null &&
    parsedWedding.getFullYear() === viewedYear &&
    parsedWedding.getMonth() === viewedMonth

  // Build grid
  const cells = buildMonthGrid(viewedYear, viewedMonth)

  return (
    <div
      data-testid="calendar-view"
      style={{
        background: 'var(--color-bg)',
        color: 'var(--color-text)',
        padding: 'var(--space-4)',
        minHeight: '100%',
      }}
    >
      {/* Countdown banner */}
      <Countdown weddingDate={weddingDate} now={now} />

      {/* Month navigation header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          marginBottom: 'var(--space-4)',
        }}
      >
        <button
          data-testid="cal-prev"
          onClick={prevMonth}
          style={{
            background: 'var(--color-surface-2)',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            padding: 'var(--space-1) var(--space-3)',
            cursor: 'pointer',
            color: 'var(--color-text)',
            fontSize: 'var(--text-sm)',
          }}
          aria-label="Previous month"
        >
          ‹
        </button>

        <h2
          style={{
            flex: 1,
            textAlign: 'center',
            fontSize: 'var(--text-lg)',
            fontWeight: 700,
            margin: 0,
          }}
        >
          {MONTH_NAMES[viewedMonth]} {viewedYear}
        </h2>

        <button
          data-testid="cal-next"
          onClick={nextMonth}
          style={{
            background: 'var(--color-surface-2)',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            padding: 'var(--space-1) var(--space-3)',
            cursor: 'pointer',
            color: 'var(--color-text)',
            fontSize: 'var(--text-sm)',
          }}
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      {/* Weekday headers */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '1px',
          marginBottom: 'var(--space-1)',
        }}
      >
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            style={{
              textAlign: 'center',
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              color: 'var(--color-text-muted)',
              padding: 'var(--space-1) 0',
            }}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '2px',
        }}
      >
        {cells.map((date, idx) => {
          if (!date) {
            // Blank leading/trailing cell
            return (
              <div
                key={`blank-${idx}`}
                style={{
                  minHeight: '80px',
                  background: 'var(--color-surface-2)',
                  borderRadius: 'var(--radius-sm)',
                  opacity: 0.3,
                }}
              />
            )
          }

          const key = toLocalKey(date)
          const dayItems = itemsByDay[key] || []
          const isWeddingDay = weddingInView && key === weddingKey

          return (
            <div
              key={key}
              data-testid={`cal-day-${key}`}
              style={{
                minHeight: '80px',
                background: 'var(--color-surface)',
                borderRadius: 'var(--radius-sm)',
                padding: 'var(--space-1)',
                border: isWeddingDay
                  ? '2px solid var(--color-accent)'
                  : '1px solid var(--color-border)',
                boxSizing: 'border-box',
                overflow: 'hidden',
              }}
            >
              {/* Day number */}
              <div
                style={{
                  fontSize: 'var(--text-xs)',
                  fontWeight: 600,
                  color: 'var(--color-text-muted)',
                  marginBottom: 'var(--space-1)',
                }}
              >
                {date.getDate()}
              </div>

              {/* Wedding marker */}
              {isWeddingDay && (
                <div
                  data-testid="cal-wedding-day"
                  style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--color-accent)',
                    fontWeight: 700,
                    marginBottom: 'var(--space-1)',
                  }}
                  title="Wedding day!"
                >
                  🎉
                </div>
              )}

              {/* Items in this cell */}
              {dayItems.map((item) => (
                <button
                  key={item.id}
                  data-testid={`cal-item-${item.id}`}
                  onClick={() => onOpen && onOpen(item.id)}
                  title={item.text}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    background: 'var(--color-primary)',
                    color: 'var(--color-surface)',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    padding: '2px var(--space-1)',
                    marginBottom: '2px',
                    fontSize: 'var(--text-xs)',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {item.text}
                </button>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
