import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CalendarView } from '../CalendarView.jsx'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a local-midnight ISO string for a given year/month/day in LOCAL time.
 * This avoids the UTC offset bug that toISOString() introduces.
 */
function localISO(year, month, day) {
  // Pad month and day
  const mm = String(month).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  // Return a date-only string that Date parse will interpret as local midnight
  // when used as new Date('2026-06-10') — actually UTC in some environments.
  // Instead, store as a JS Date for reliable local parts.
  return new Date(year, month - 1, day)
}

// Fixed "now" = June 15 2026 (local)
const NOW = new Date(2026, 5, 15)   // month 0-indexed

// Items with due_dates in June 2026 (local midnight Dates to avoid UTC issues)
// We store due_date as a string that the component should parse correctly.
// Use "YYYY-MM-DD" date strings — the component must use local parts.
// To be safe we also test with actual Date objects — the brief says "timestamp".
// The test stores them as local-midnight Date objects which is the safest approach.

const ITEMS_JUNE = [
  {
    id: 'item-A',
    text: 'Task on June 10',
    due_date: new Date(2026, 5, 10),   // June 10 local midnight
    completed: false,
  },
  {
    id: 'item-B',
    text: 'Task on June 20',
    due_date: new Date(2026, 5, 20),   // June 20 local midnight
    completed: false,
  },
  {
    id: 'item-C',
    text: 'No due date task',
    due_date: null,
    completed: false,
  },
]

const ITEM_JULY = {
  id: 'item-D',
  text: 'Task on July 5',
  due_date: new Date(2026, 6, 5),    // July 5 local midnight
  completed: false,
}

// Wedding date in June 2026
const WEDDING_JUNE = new Date(2026, 5, 28)   // June 28

// Wedding date in a different month (July) — should NOT appear when viewing June
const WEDDING_JULY = new Date(2026, 6, 4)    // July 4

describe('CalendarView', () => {
  // ── Root element ─────────────────────────────────────────────────────────────
  it('renders root with data-testid="calendar-view"', () => {
    render(<CalendarView items={[]} now={NOW} />)
    expect(screen.getByTestId('calendar-view')).toBeInTheDocument()
  })

  // ── Month header ─────────────────────────────────────────────────────────────
  it('shows the viewed month/year in the header', () => {
    render(<CalendarView items={[]} now={NOW} />)
    const view = screen.getByTestId('calendar-view')
    // June 2026 should appear somewhere in the header
    expect(view.textContent).toMatch(/june/i)
    expect(view.textContent).toMatch(/2026/)
  })

  // ── Prev / Next navigation ────────────────────────────────────────────────────
  it('has prev and next buttons', () => {
    render(<CalendarView items={[]} now={NOW} />)
    expect(screen.getByTestId('cal-prev')).toBeInTheDocument()
    expect(screen.getByTestId('cal-next')).toBeInTheDocument()
  })

  it('clicking Next moves to July 2026', () => {
    render(<CalendarView items={[]} now={NOW} />)
    fireEvent.click(screen.getByTestId('cal-next'))
    const view = screen.getByTestId('calendar-view')
    expect(view.textContent).toMatch(/july/i)
    expect(view.textContent).toMatch(/2026/)
  })

  it('clicking Prev moves to May 2026', () => {
    render(<CalendarView items={[]} now={NOW} />)
    fireEvent.click(screen.getByTestId('cal-prev'))
    const view = screen.getByTestId('calendar-view')
    expect(view.textContent).toMatch(/may/i)
    expect(view.textContent).toMatch(/2026/)
  })

  // ── Day cells ────────────────────────────────────────────────────────────────
  it('renders a cell for June 10 with testid cal-day-2026-06-10', () => {
    render(<CalendarView items={[]} now={NOW} />)
    expect(screen.getByTestId('cal-day-2026-06-10')).toBeInTheDocument()
  })

  it('renders a cell for June 20 with testid cal-day-2026-06-20', () => {
    render(<CalendarView items={[]} now={NOW} />)
    expect(screen.getByTestId('cal-day-2026-06-20')).toBeInTheDocument()
  })

  // ── Item bucketing (LOCAL date parts) ────────────────────────────────────────
  it('places an item due June 10 in the cal-day-2026-06-10 cell', () => {
    render(<CalendarView items={ITEMS_JUNE} now={NOW} />)
    const cell = screen.getByTestId('cal-day-2026-06-10')
    expect(within(cell).getByTestId('cal-item-item-A')).toBeInTheDocument()
  })

  it('places an item due June 20 in the cal-day-2026-06-20 cell', () => {
    render(<CalendarView items={ITEMS_JUNE} now={NOW} />)
    const cell = screen.getByTestId('cal-day-2026-06-20')
    expect(within(cell).getByTestId('cal-item-item-B')).toBeInTheDocument()
  })

  it('does NOT place item-A in the wrong day cell', () => {
    render(<CalendarView items={ITEMS_JUNE} now={NOW} />)
    const wrongCell = screen.getByTestId('cal-day-2026-06-20')
    expect(within(wrongCell).queryByTestId('cal-item-item-A')).toBeNull()
  })

  // ── Items without due_date are NOT shown ─────────────────────────────────────
  it('does not show undated items anywhere in the calendar', () => {
    render(<CalendarView items={ITEMS_JUNE} now={NOW} />)
    expect(screen.queryByTestId('cal-item-item-C')).toBeNull()
  })

  // ── Clicking an item calls onOpen(id) ────────────────────────────────────────
  it('clicking a calendar item calls onOpen with the item id', () => {
    const onOpen = vi.fn()
    render(<CalendarView items={ITEMS_JUNE} onOpen={onOpen} now={NOW} />)
    fireEvent.click(screen.getByTestId('cal-item-item-A'))
    expect(onOpen).toHaveBeenCalledWith('item-A')
  })

  // ── Navigate to a different month, item appears there ────────────────────────
  it('after clicking Next, shows a July item in the July cell', () => {
    render(<CalendarView items={[...ITEMS_JUNE, ITEM_JULY]} now={NOW} />)
    // Initially in June — July item not visible
    expect(screen.queryByTestId('cal-item-item-D')).toBeNull()

    // Navigate to July
    fireEvent.click(screen.getByTestId('cal-next'))
    const cell = screen.getByTestId('cal-day-2026-07-05')
    expect(within(cell).getByTestId('cal-item-item-D')).toBeInTheDocument()
  })

  it('after clicking Next, June items are no longer shown', () => {
    render(<CalendarView items={ITEMS_JUNE} now={NOW} />)
    fireEvent.click(screen.getByTestId('cal-next'))
    expect(screen.queryByTestId('cal-item-item-A')).toBeNull()
    expect(screen.queryByTestId('cal-item-item-B')).toBeNull()
  })

  // ── Wedding date marker ───────────────────────────────────────────────────────
  it('marks the wedding day cell with data-testid="cal-wedding-day" when in viewed month', () => {
    render(<CalendarView items={[]} weddingDate={WEDDING_JUNE} now={NOW} />)
    expect(screen.getByTestId('cal-wedding-day')).toBeInTheDocument()
  })

  it('wedding marker is inside the correct day cell (June 28)', () => {
    render(<CalendarView items={[]} weddingDate={WEDDING_JUNE} now={NOW} />)
    const weddingCell = screen.getByTestId('cal-day-2026-06-28')
    expect(within(weddingCell).getByTestId('cal-wedding-day')).toBeInTheDocument()
  })

  it('does NOT render cal-wedding-day when wedding is in a different month', () => {
    render(<CalendarView items={[]} weddingDate={WEDDING_JULY} now={NOW} />)
    expect(screen.queryByTestId('cal-wedding-day')).toBeNull()
  })

  it('does NOT render cal-wedding-day when weddingDate is not provided', () => {
    render(<CalendarView items={[]} now={NOW} />)
    expect(screen.queryByTestId('cal-wedding-day')).toBeNull()
  })

  // ── Countdown integration ─────────────────────────────────────────────────────
  it('renders countdown banner when weddingDate is provided', () => {
    render(<CalendarView items={[]} weddingDate={WEDDING_JUNE} now={NOW} />)
    expect(screen.getByTestId('countdown')).toBeInTheDocument()
  })

  it('does NOT render countdown when weddingDate is absent', () => {
    render(<CalendarView items={[]} now={NOW} />)
    expect(screen.queryByTestId('countdown')).toBeNull()
  })

  // ── Weekday headers ───────────────────────────────────────────────────────────
  it('renders 7 weekday header cells (Sun–Sat)', () => {
    render(<CalendarView items={[]} now={NOW} />)
    const view = screen.getByTestId('calendar-view')
    // All 7 day abbreviations should be present
    ;['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach((day) => {
      expect(view.textContent).toMatch(new RegExp(day, 'i'))
    })
  })
})
