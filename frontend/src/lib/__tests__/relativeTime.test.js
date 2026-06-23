import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { relativeTime } from '../relativeTime.js'

// ---------------------------------------------------------------------------
// Use fixed "now" to make tests deterministic
// ---------------------------------------------------------------------------

const FIXED_NOW = new Date('2024-06-15T12:00:00Z').getTime()

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(FIXED_NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('relativeTime', () => {
  it('returns "just now" for a timestamp 10 seconds ago', () => {
    const iso = new Date(FIXED_NOW - 10 * 1000).toISOString()
    expect(relativeTime(iso)).toBe('just now')
  })

  it('returns "just now" for a timestamp 59 seconds ago', () => {
    const iso = new Date(FIXED_NOW - 59 * 1000).toISOString()
    expect(relativeTime(iso)).toBe('just now')
  })

  it('returns "1m ago" for exactly 60 seconds ago', () => {
    const iso = new Date(FIXED_NOW - 60 * 1000).toISOString()
    expect(relativeTime(iso)).toBe('1m ago')
  })

  it('returns "5m ago" for 5 minutes ago', () => {
    const iso = new Date(FIXED_NOW - 5 * 60 * 1000).toISOString()
    expect(relativeTime(iso)).toBe('5m ago')
  })

  it('returns "59m ago" for 59 minutes ago', () => {
    const iso = new Date(FIXED_NOW - 59 * 60 * 1000).toISOString()
    expect(relativeTime(iso)).toBe('59m ago')
  })

  it('returns "1h ago" for exactly 60 minutes ago', () => {
    const iso = new Date(FIXED_NOW - 60 * 60 * 1000).toISOString()
    expect(relativeTime(iso)).toBe('1h ago')
  })

  it('returns "3h ago" for 3 hours ago', () => {
    const iso = new Date(FIXED_NOW - 3 * 60 * 60 * 1000).toISOString()
    expect(relativeTime(iso)).toBe('3h ago')
  })

  it('returns "23h ago" for 23 hours ago', () => {
    const iso = new Date(FIXED_NOW - 23 * 60 * 60 * 1000).toISOString()
    expect(relativeTime(iso)).toBe('23h ago')
  })

  it('returns "1d ago" for exactly 24 hours ago', () => {
    const iso = new Date(FIXED_NOW - 24 * 60 * 60 * 1000).toISOString()
    expect(relativeTime(iso)).toBe('1d ago')
  })

  it('returns "3d ago" for 3 days ago', () => {
    const iso = new Date(FIXED_NOW - 3 * 24 * 60 * 60 * 1000).toISOString()
    expect(relativeTime(iso)).toBe('3d ago')
  })

  it('returns "29d ago" for 29 days ago', () => {
    const iso = new Date(FIXED_NOW - 29 * 24 * 60 * 60 * 1000).toISOString()
    expect(relativeTime(iso)).toBe('29d ago')
  })

  it('returns toLocaleDateString() for 30+ days ago', () => {
    const longAgoDate = new Date(FIXED_NOW - 30 * 24 * 60 * 60 * 1000)
    const iso = longAgoDate.toISOString()
    expect(relativeTime(iso)).toBe(longAgoDate.toLocaleDateString())
  })

  it('returns the raw string for an invalid ISO date', () => {
    expect(relativeTime('not-a-date')).toBe('not-a-date')
  })
})
