import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { TimelineView } from '../TimelineView.jsx'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a local-midnight Date for a given year/month/day (1-indexed month).
 * Avoids UTC offset bugs by using the Date(y, m-1, d) constructor.
 */
function ld(year, month, day) {
  return new Date(year, month - 1, day)
}

/**
 * Compute the Monday of the week containing `date` (local).
 * Returns a YYYY-MM-DD string for use in testids.
 */
function mondayKey(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const dow = d.getDay() // 0=Sun
  const offset = dow === 0 ? -6 : 1 - dow
  d.setDate(d.getDate() + offset)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Fixed "now" = June 15 2026 (Monday)
const NOW = ld(2026, 6, 15)

// Items
const ITEM_A = { id: 'item-A', text: 'Task A', due_date: ld(2026, 6, 9),  completed: false } // Tue Jun 9  → week of Jun 9 (Mon Jun 8)
const ITEM_B = { id: 'item-B', text: 'Task B', due_date: ld(2026, 6, 11), completed: false } // Thu Jun 11 → week of Jun 9 (Mon Jun 8)
const ITEM_C = { id: 'item-C', text: 'Task C', due_date: ld(2026, 6, 16), completed: false } // Tue Jun 16 → week of Jun 15 (Mon Jun 15)
const ITEM_D = { id: 'item-D', text: 'Task D', due_date: null,            completed: false } // no due date
const ITEM_E = { id: 'item-E', text: 'Task E', due_date: null,            completed: false } // no due date
const ITEM_F = { id: 'item-F', text: 'Task F', due_date: ld(2026, 6, 8),  completed: false } // Mon Jun 8  → week of Jun 8 (same week as A, B)

// Week keys
const WEEK_JUN8  = mondayKey(ld(2026, 6, 8))  // '2026-06-08'
const WEEK_JUN15 = mondayKey(ld(2026, 6, 15)) // '2026-06-15'
const WEEK_JUN22 = mondayKey(ld(2026, 6, 22)) // '2026-06-22'

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('TimelineView', () => {
  // ── Root element ─────────────────────────────────────────────────────────────
  it('renders root with data-testid="timeline-view"', () => {
    render(<TimelineView items={[]} now={NOW} />)
    expect(screen.getByTestId('timeline-view')).toBeInTheDocument()
  })

  // ── Empty state ───────────────────────────────────────────────────────────────
  it('shows empty hint when no items, no weddingDate', () => {
    render(<TimelineView items={[]} now={NOW} />)
    expect(screen.getByTestId('timeline-empty')).toBeInTheDocument()
  })

  it('does NOT show empty hint when there are dated items', () => {
    render(<TimelineView items={[ITEM_A]} now={NOW} />)
    expect(screen.queryByTestId('timeline-empty')).toBeNull()
  })

  it('does NOT show empty hint when there are undated items', () => {
    render(<TimelineView items={[ITEM_D]} now={NOW} />)
    expect(screen.queryByTestId('timeline-empty')).toBeNull()
  })

  it('does NOT show empty hint when weddingDate is provided', () => {
    render(<TimelineView items={[]} weddingDate={ld(2026, 6, 28)} now={NOW} />)
    expect(screen.queryByTestId('timeline-empty')).toBeNull()
  })

  // ── Week buckets ──────────────────────────────────────────────────────────────
  it('items in the same week appear in the same tl-week-* bucket', () => {
    // ITEM_A (Jun 9) and ITEM_B (Jun 11) are both in the week starting Jun 8
    render(<TimelineView items={[ITEM_A, ITEM_B]} now={NOW} />)
    const weekBucket = screen.getByTestId(`tl-week-${WEEK_JUN8}`)
    expect(within(weekBucket).getByTestId('tl-item-item-A')).toBeInTheDocument()
    expect(within(weekBucket).getByTestId('tl-item-item-B')).toBeInTheDocument()
  })

  it('items in different weeks appear in different tl-week-* buckets', () => {
    render(<TimelineView items={[ITEM_A, ITEM_C]} now={NOW} />)
    const weekA = screen.getByTestId(`tl-week-${WEEK_JUN8}`)
    const weekC = screen.getByTestId(`tl-week-${WEEK_JUN15}`)

    expect(within(weekA).getByTestId('tl-item-item-A')).toBeInTheDocument()
    expect(within(weekA).queryByTestId('tl-item-item-C')).toBeNull()

    expect(within(weekC).getByTestId('tl-item-item-C')).toBeInTheDocument()
    expect(within(weekC).queryByTestId('tl-item-item-A')).toBeNull()
  })

  it('renders items in each week bucket', () => {
    render(<TimelineView items={[ITEM_A, ITEM_B, ITEM_C]} now={NOW} />)
    expect(screen.getByTestId(`tl-week-${WEEK_JUN8}`)).toBeInTheDocument()
    expect(screen.getByTestId(`tl-week-${WEEK_JUN15}`)).toBeInTheDocument()
  })

  it('Monday itself belongs to its own week (not the previous)', () => {
    // ITEM_F is due on Mon Jun 8 — the Monday itself → week of Jun 8
    render(<TimelineView items={[ITEM_F]} now={NOW} />)
    const bucket = screen.getByTestId(`tl-week-${WEEK_JUN8}`)
    expect(within(bucket).getByTestId('tl-item-item-F')).toBeInTheDocument()
  })

  // ── Week ordering (ascending by Monday date) ──────────────────────────────────
  it('renders week buckets in ascending order (earlier week first)', () => {
    render(<TimelineView items={[ITEM_C, ITEM_A]} now={NOW} />)
    const view = screen.getByTestId('timeline-view')
    const weekElements = Array.from(view.querySelectorAll('[data-testid^="tl-week-"]'))
    const keys = weekElements.map((el) => el.getAttribute('data-testid'))
    expect(keys.indexOf(`tl-week-${WEEK_JUN8}`)).toBeLessThan(
      keys.indexOf(`tl-week-${WEEK_JUN15}`)
    )
  })

  // ── Within-week ordering (ascending by due_date) ──────────────────────────────
  it('renders items within a week ordered by due_date ascending', () => {
    // ITEM_A (Jun 9) should appear before ITEM_B (Jun 11) in the Jun 8 week
    render(<TimelineView items={[ITEM_B, ITEM_A]} now={NOW} />)
    const bucket = screen.getByTestId(`tl-week-${WEEK_JUN8}`)
    const itemEls = Array.from(bucket.querySelectorAll('[data-testid^="tl-item-"]'))
    const ids = itemEls.map((el) => el.getAttribute('data-testid'))
    expect(ids.indexOf('tl-item-item-A')).toBeLessThan(ids.indexOf('tl-item-item-B'))
  })

  // ── Item display ──────────────────────────────────────────────────────────────
  it('each item shows its text', () => {
    render(<TimelineView items={[ITEM_A]} now={NOW} />)
    const el = screen.getByTestId('tl-item-item-A')
    expect(el.textContent).toMatch(/Task A/)
  })

  it('clicking an item calls onOpen(item.id)', () => {
    const onOpen = vi.fn()
    render(<TimelineView items={[ITEM_A]} onOpen={onOpen} now={NOW} />)
    fireEvent.click(screen.getByTestId('tl-item-item-A'))
    expect(onOpen).toHaveBeenCalledWith('item-A')
  })

  // ── Wedding milestone ─────────────────────────────────────────────────────────
  it('renders tl-wedding when weddingDate is provided', () => {
    render(<TimelineView items={[]} weddingDate={ld(2026, 6, 28)} now={NOW} />)
    expect(screen.getByTestId('tl-wedding')).toBeInTheDocument()
  })

  it('tl-wedding appears inside the correct week bucket', () => {
    const weddingDate = ld(2026, 6, 28) // Sun Jun 28 → week of Mon Jun 22
    render(<TimelineView items={[]} weddingDate={weddingDate} now={NOW} />)
    const weddingWeekKey = mondayKey(weddingDate)
    const bucket = screen.getByTestId(`tl-week-${weddingWeekKey}`)
    expect(within(bucket).getByTestId('tl-wedding')).toBeInTheDocument()
  })

  it('creates the wedding week bucket even when no items fall that week', () => {
    const weddingDate = ld(2026, 6, 28) // Jun 28 — no items that week
    render(<TimelineView items={[ITEM_A]} weddingDate={weddingDate} now={NOW} />)
    const weddingWeekKey = mondayKey(weddingDate)
    expect(screen.getByTestId(`tl-week-${weddingWeekKey}`)).toBeInTheDocument()
  })

  it('does NOT render tl-wedding when weddingDate is not provided', () => {
    render(<TimelineView items={[ITEM_A]} now={NOW} />)
    expect(screen.queryByTestId('tl-wedding')).toBeNull()
  })

  it('wedding week bucket in the right order among other weeks', () => {
    // weddingDate Jun 28 → week Jun 22, which is after Jun 8 and Jun 15
    const weddingDate = ld(2026, 6, 28)
    render(<TimelineView items={[ITEM_A, ITEM_C]} weddingDate={weddingDate} now={NOW} />)
    const view = screen.getByTestId('timeline-view')
    const weekEls = Array.from(view.querySelectorAll('[data-testid^="tl-week-"]'))
    const keys = weekEls.map((el) => el.getAttribute('data-testid'))
    const weddingKey = `tl-week-${mondayKey(weddingDate)}`
    expect(keys.indexOf(`tl-week-${WEEK_JUN8}`)).toBeLessThan(keys.indexOf(weddingKey))
    expect(keys.indexOf(`tl-week-${WEEK_JUN15}`)).toBeLessThan(keys.indexOf(weddingKey))
  })

  // ── Undated rail ──────────────────────────────────────────────────────────────
  it('renders tl-undated section when there are undated items', () => {
    render(<TimelineView items={[ITEM_D]} now={NOW} />)
    expect(screen.getByTestId('tl-undated')).toBeInTheDocument()
  })

  it('undated items appear in tl-undated section', () => {
    render(<TimelineView items={[ITEM_D, ITEM_E]} now={NOW} />)
    const rail = screen.getByTestId('tl-undated')
    expect(within(rail).getByTestId('tl-item-item-D')).toBeInTheDocument()
    expect(within(rail).getByTestId('tl-item-item-E')).toBeInTheDocument()
  })

  it('undated items do NOT appear in any tl-week-* bucket', () => {
    render(<TimelineView items={[ITEM_A, ITEM_D]} now={NOW} />)
    const bucket = screen.getByTestId(`tl-week-${WEEK_JUN8}`)
    expect(within(bucket).queryByTestId('tl-item-item-D')).toBeNull()
  })

  it('dated items do NOT appear in tl-undated section', () => {
    render(<TimelineView items={[ITEM_A, ITEM_D]} now={NOW} />)
    const rail = screen.getByTestId('tl-undated')
    expect(within(rail).queryByTestId('tl-item-item-A')).toBeNull()
  })

  it('does NOT render tl-undated when all items are dated', () => {
    render(<TimelineView items={[ITEM_A, ITEM_C]} now={NOW} />)
    expect(screen.queryByTestId('tl-undated')).toBeNull()
  })

  it('clicking an undated item calls onOpen(item.id)', () => {
    const onOpen = vi.fn()
    render(<TimelineView items={[ITEM_D]} onOpen={onOpen} now={NOW} />)
    fireEvent.click(screen.getByTestId('tl-item-item-D'))
    expect(onOpen).toHaveBeenCalledWith('item-D')
  })
})
