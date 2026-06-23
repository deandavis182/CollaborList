import { useState, useEffect } from 'react'

const VALID_VIEWS = ['list', 'board', 'calendar', 'timeline']
const VALID_GROUP_BY = ['none', 'completion', 'status', 'assignee', 'tag']

const DEFAULTS = { view: 'list', groupBy: 'none' }

function lsKey(scopeKey) {
  return `collaborlist:viewpref:${scopeKey}`
}

function readPref(scopeKey) {
  try {
    const raw = localStorage.getItem(lsKey(scopeKey))
    if (!raw) return { ...DEFAULTS }
    const parsed = JSON.parse(raw)
    const view = VALID_VIEWS.includes(parsed.view) ? parsed.view : DEFAULTS.view
    const groupBy = VALID_GROUP_BY.includes(parsed.groupBy) ? parsed.groupBy : DEFAULTS.groupBy
    if (view !== parsed.view || groupBy !== parsed.groupBy) {
      // At least one field was invalid; fall back to full defaults
      return { ...DEFAULTS }
    }
    return { view, groupBy }
  } catch {
    return { ...DEFAULTS }
  }
}

/**
 * useViewPref(scopeKey) → { view, setView, groupBy, setGroupBy }
 *
 * Persists view preference to localStorage under:
 *   collaborlist:viewpref:<scopeKey>
 *
 * Changing scopeKey loads that scope's saved preference.
 */
export function useViewPref(scopeKey) {
  const [pref, setPref] = useState(() => readPref(scopeKey))

  // When scopeKey changes, reload from localStorage
  useEffect(() => {
    setPref(readPref(scopeKey))
  }, [scopeKey])

  function setView(view) {
    setPref((prev) => {
      const next = { ...prev, view }
      localStorage.setItem(lsKey(scopeKey), JSON.stringify(next))
      return next
    })
  }

  function setGroupBy(groupBy) {
    setPref((prev) => {
      const next = { ...prev, groupBy }
      localStorage.setItem(lsKey(scopeKey), JSON.stringify(next))
      return next
    })
  }

  return {
    view: pref.view,
    groupBy: pref.groupBy,
    setView,
    setGroupBy,
  }
}
