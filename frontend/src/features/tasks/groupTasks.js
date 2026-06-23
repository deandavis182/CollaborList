import { parseLocalDay } from '../../lib/dates.js'

/**
 * groupTasksByDue — pure helper that buckets tasks by due date relative to `now`.
 *
 * Bucketing rules (in precedence order):
 *   noDate   : due_date is null/falsy
 *   overdue  : due_date < startOfToday AND NOT completed
 *   today    : due_date within [startOfToday, endOfToday]
 *   upcoming : due_date > endOfToday
 *
 * A completed past-due item is NOT overdue (the completed check is exclusive to
 * overdue); it falls through to the date comparison — due_date <= endOfToday
 * so it lands in `today`.
 *
 * Input order is preserved within each bucket.
 *
 * @param {Array} tasks  — list of task objects from the API
 * @param {Date}  now    — reference point (default: new Date())
 * @returns {{ overdue: Array, today: Array, upcoming: Array, noDate: Array }}
 */
/**
 * Extract the local-time calendar date components from a Date object.
 * Returns { y, m, d } using local year/month(0-indexed)/date.
 */
function localDay(date) {
  return { y: date.getFullYear(), m: date.getMonth(), d: date.getDate() }
}

/**
 * Compare two Date objects by calendar day (local time) only.
 * Returns -1 if a < b, 0 if same day, 1 if a > b.
 */
function cmpDay(a, b) {
  const da = localDay(a)
  const db = localDay(b)
  if (da.y !== db.y) return da.y < db.y ? -1 : 1
  if (da.m !== db.m) return da.m < db.m ? -1 : 1
  if (da.d !== db.d) return da.d < db.d ? -1 : 1
  return 0
}

export function groupTasksByDue(tasks, now = new Date()) {
  const result = { overdue: [], today: [], upcoming: [], noDate: [] }

  for (const task of tasks) {
    if (!task.due_date) {
      result.noDate.push(task)
      continue
    }

    const due = parseLocalDay(task.due_date)
    if (!due) { result.noDate.push(task); continue }
    const diff = cmpDay(due, now)

    if (diff < 0 && !task.completed) {
      // due_date is before today (local) AND not completed → overdue
      result.overdue.push(task)
    } else if (diff <= 0) {
      // due_date is today or earlier (but not overdue — completed or today)
      result.today.push(task)
    } else {
      // due_date is after today (local)
      result.upcoming.push(task)
    }
  }

  return result
}
