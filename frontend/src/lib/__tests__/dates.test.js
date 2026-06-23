import { describe, it, expect } from 'vitest'
import { parseLocalDay, formatDay, daysUntil } from '../dates.js'

describe('parseLocalDay', () => {
  it('parses "2026-10-17" to LOCAL date (year/month/day = 2026/9/17 via getters)', () => {
    const d = parseLocalDay('2026-10-17')
    expect(d).not.toBeNull()
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(9)   // 0-indexed → October
    expect(d.getDate()).toBe(17)
  })

  it('parses "2026-10-17T00:00:00.000Z" to LOCAL date (same calendar day)', () => {
    const d = parseLocalDay('2026-10-17T00:00:00.000Z')
    expect(d).not.toBeNull()
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(9)
    expect(d.getDate()).toBe(17)
  })

  it('returns null for null', () => {
    expect(parseLocalDay(null)).toBeNull()
  })

  it('returns null for undefined', () => {
    expect(parseLocalDay(undefined)).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(parseLocalDay('')).toBeNull()
  })

  it('returns null for garbage string', () => {
    expect(parseLocalDay('not-a-date')).toBeNull()
  })

  it('parses a Date object (already a Date) — returns a Date at that instant', () => {
    const input = new Date(2026, 9, 17) // Oct 17 2026 local midnight
    const d = parseLocalDay(input)
    expect(d).not.toBeNull()
    // The result is based on new Date(input) — same millisecond value
    expect(d.getTime()).toBe(input.getTime())
  })
})

describe('formatDay', () => {
  it('returns a string containing the correct day number', () => {
    const result = formatDay('2026-09-15')
    // toLocaleDateString always includes the day number 15
    expect(result).toMatch(/15/)
  })

  it('returns "" for null', () => {
    expect(formatDay(null)).toBe('')
  })

  it('returns "" for empty string', () => {
    expect(formatDay('')).toBe('')
  })

  it('respects opts when provided', () => {
    // Ask for numeric month and day — result should contain "10" and "17"
    const result = formatDay('2026-10-17', { month: 'numeric', day: 'numeric' })
    expect(result).toMatch(/17/)
    expect(result).toMatch(/10/)
  })
})

describe('daysUntil', () => {
  // Fixed now = 2026-06-15 local midnight
  const NOW = new Date(2026, 5, 15, 0, 0, 0)

  it('returns 0 when value is the same calendar day as now', () => {
    expect(daysUntil('2026-06-15', NOW)).toBe(0)
  })

  it('returns positive for a future date', () => {
    expect(daysUntil('2026-06-25', NOW)).toBe(10)
  })

  it('returns negative for a past date', () => {
    expect(daysUntil('2026-06-05', NOW)).toBe(-10)
  })

  it('returns null for invalid value', () => {
    expect(daysUntil(null, NOW)).toBeNull()
    expect(daysUntil('', NOW)).toBeNull()
    expect(daysUntil('not-a-date', NOW)).toBeNull()
  })

  it('works with ISO timestamp strings (same calendar day)', () => {
    // "2026-06-25T00:00:00.000Z" — calendar day 25 should give +10
    expect(daysUntil('2026-06-25T00:00:00.000Z', NOW)).toBe(10)
  })
})
