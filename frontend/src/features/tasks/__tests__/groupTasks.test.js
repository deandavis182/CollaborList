import { describe, it, expect } from 'vitest'
import { groupTasksByDue, isCompletedToday } from '../groupTasks.js'

// Fixed reference point: 2025-06-15 noon (local time)
const NOW = new Date(2025, 5, 15, 12, 0, 0) // month is 0-indexed → June

// Use local-time date constructors so timezone doesn't affect calendar day comparisons.
// groupTasksByDue uses getFullYear/getMonth/getDate (local), so we must match.
function localISO(year, month1based, day) {
  // Build a local-midnight date and return it as a Date (not string),
  // but the component accepts Date objects too — actually the SUT calls
  // new Date(task.due_date), so we pass the Date directly as due_date.
  return new Date(year, month1based - 1, day, 0, 0, 0, 0)
}

// Helpers to build task objects
function task(overrides) {
  return { id: 1, text: 'Task', completed: false, due_date: null, ...overrides }
}

// withDue accepts either a Date (from localISO) or null
function withDue(date, overrides = {}) {
  return task({ due_date: date, ...overrides })
}

// Convenience shorthands for commonly used dates in tests
const DUE_YESTERDAY = localISO(2025, 6, 14) // June 14, 2025
const DUE_TODAY     = localISO(2025, 6, 15) // June 15, 2025
const DUE_TOMORROW  = localISO(2025, 6, 16) // June 16, 2025
const DUE_FUTURE    = localISO(2025, 7, 1)  // July 1, 2025
const DUE_PAST      = localISO(2025, 6, 1)  // June 1, 2025
const DUE_LONG_PAST = localISO(2020, 1, 1)  // Jan 1, 2020

describe('isCompletedToday', () => {
  it('isCompletedToday: true only for completed tasks due today', () => {
    const today = new Date().toISOString().slice(0, 10)
    expect(isCompletedToday({ completed: true, due_date: today })).toBe(true)
    expect(isCompletedToday({ completed: false, due_date: today })).toBe(false)
    expect(isCompletedToday({ completed: true, due_date: '2000-01-01' })).toBe(false)
    expect(isCompletedToday({ completed: true, due_date: null })).toBe(false)
  })
})

describe('groupTasksByDue', () => {
  // -----------------------------------------------------------------------
  // noDate bucket
  // -----------------------------------------------------------------------

  it('places a task with null due_date into noDate', () => {
    const t = task({ id: 1, due_date: null })
    const { noDate } = groupTasksByDue([t], NOW)
    expect(noDate).toContain(t)
  })

  it('places a task with undefined due_date into noDate', () => {
    const t = task({ id: 2, due_date: undefined })
    const { noDate } = groupTasksByDue([t], NOW)
    expect(noDate).toContain(t)
  })

  it('places a task with empty-string due_date into noDate', () => {
    const t = task({ id: 3, due_date: '' })
    const { noDate } = groupTasksByDue([t], NOW)
    expect(noDate).toContain(t)
  })

  // -----------------------------------------------------------------------
  // overdue bucket
  // -----------------------------------------------------------------------

  it('places an incomplete past-due task into overdue', () => {
    const t = withDue(DUE_YESTERDAY, { id: 10, completed: false })
    const { overdue } = groupTasksByDue([t], NOW)
    expect(overdue).toContain(t)
  })

  it('does NOT place a completed past-due task into overdue', () => {
    const t = withDue(DUE_PAST, { id: 11, completed: true })
    const { overdue } = groupTasksByDue([t], NOW)
    expect(overdue).not.toContain(t)
  })

  // -----------------------------------------------------------------------
  // today bucket
  // -----------------------------------------------------------------------

  it('places a task due today (same calendar day) into today', () => {
    const t = withDue(DUE_TODAY, { id: 20 })
    const { today } = groupTasksByDue([t], NOW)
    expect(today).toContain(t)
  })

  it('places a completed past-due task into today (not overdue)', () => {
    const t = withDue(DUE_PAST, { id: 21, completed: true })
    const { today } = groupTasksByDue([t], NOW)
    expect(today).toContain(t)
  })

  // -----------------------------------------------------------------------
  // upcoming bucket
  // -----------------------------------------------------------------------

  it('places a future task into upcoming', () => {
    const t = withDue(DUE_FUTURE, { id: 30 })
    const { upcoming } = groupTasksByDue([t], NOW)
    expect(upcoming).toContain(t)
  })

  it('places tomorrow\'s task into upcoming', () => {
    const t = withDue(DUE_TOMORROW, { id: 31 })
    const { upcoming } = groupTasksByDue([t], NOW)
    expect(upcoming).toContain(t)
  })

  // -----------------------------------------------------------------------
  // Bucket exclusivity
  // -----------------------------------------------------------------------

  it('returns empty arrays for buckets that have no tasks', () => {
    const { overdue, today, upcoming, noDate } = groupTasksByDue([], NOW)
    expect(overdue).toEqual([])
    expect(today).toEqual([])
    expect(upcoming).toEqual([])
    expect(noDate).toEqual([])
  })

  it('each task lands in exactly one bucket', () => {
    const tasks = [
      withDue(null, { id: 1 }),
      withDue('2025-06-14', { id: 2, completed: false }),
      withDue('2025-06-14', { id: 3, completed: true }),
      withDue('2025-06-15', { id: 4 }),
      withDue('2025-06-20', { id: 5 }),
    ]
    const { overdue, today, upcoming, noDate } = groupTasksByDue(tasks, NOW)
    const allBucketed = [...overdue, ...today, ...upcoming, ...noDate]
    expect(allBucketed).toHaveLength(tasks.length)
    // Each task id appears exactly once
    const ids = allBucketed.map((t) => t.id)
    expect(new Set(ids).size).toBe(tasks.length)
  })

  // -----------------------------------------------------------------------
  // Order preservation
  // -----------------------------------------------------------------------

  it('preserves input order within each bucket', () => {
    const a = withDue(localISO(2025, 6, 20), { id: 10 })
    const b = withDue(localISO(2025, 6, 21), { id: 11 })
    const c = withDue(localISO(2025, 6, 22), { id: 12 })
    const { upcoming } = groupTasksByDue([a, b, c], NOW)
    expect(upcoming).toEqual([a, b, c])
  })

  it('preserves input order for noDate tasks', () => {
    const x = task({ id: 50 })
    const y = task({ id: 51 })
    const { noDate } = groupTasksByDue([x, y], NOW)
    expect(noDate).toEqual([x, y])
  })

  // -----------------------------------------------------------------------
  // Mixed bucket scenario
  // -----------------------------------------------------------------------

  it('correctly separates a mixed set of tasks', () => {
    const overdue1      = withDue(DUE_PAST,             { id: 1, completed: false })
    const overdue2      = withDue(DUE_YESTERDAY,        { id: 2, completed: false })
    const todayTask     = withDue(DUE_TODAY,             { id: 3 })
    const upcoming1     = withDue(DUE_FUTURE,            { id: 4 })
    const noDate1       = task({ id: 5 })
    const completedPast = withDue(localISO(2025, 5, 1), { id: 6, completed: true })

    const result = groupTasksByDue(
      [overdue1, overdue2, todayTask, upcoming1, noDate1, completedPast],
      NOW
    )

    expect(result.overdue).toEqual([overdue1, overdue2])
    expect(result.today).toEqual([todayTask, completedPast])
    expect(result.upcoming).toEqual([upcoming1])
    expect(result.noDate).toEqual([noDate1])
  })
})
