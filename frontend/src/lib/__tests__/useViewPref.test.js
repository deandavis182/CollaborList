import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useViewPref } from '../useViewPref.js'

const LS_KEY = (scope) => `collaborlist:viewpref:${scope}`

beforeEach(() => {
  localStorage.clear()
})

describe('useViewPref — defaults', () => {
  it('returns view="list" and groupBy="none" when nothing is stored', () => {
    const { result } = renderHook(() => useViewPref('list:1'))
    expect(result.current.view).toBe('list')
    expect(result.current.groupBy).toBe('none')
  })
})

describe('useViewPref — setView persistence', () => {
  it('setView updates the view state', () => {
    const { result } = renderHook(() => useViewPref('list:1'))
    act(() => result.current.setView('board'))
    expect(result.current.view).toBe('board')
  })

  it('setView writes the new value to localStorage', () => {
    const { result } = renderHook(() => useViewPref('list:1'))
    act(() => result.current.setView('calendar'))
    const stored = JSON.parse(localStorage.getItem(LS_KEY('list:1')))
    expect(stored.view).toBe('calendar')
  })

  it('re-mounting with the same scopeKey reads the persisted value', () => {
    const { result: r1 } = renderHook(() => useViewPref('list:1'))
    act(() => r1.current.setView('timeline'))

    const { result: r2 } = renderHook(() => useViewPref('list:1'))
    expect(r2.current.view).toBe('timeline')
  })
})

describe('useViewPref — setGroupBy persistence', () => {
  it('setGroupBy updates the groupBy state', () => {
    const { result } = renderHook(() => useViewPref('list:1'))
    act(() => result.current.setGroupBy('assignee'))
    expect(result.current.groupBy).toBe('assignee')
  })

  it('setGroupBy writes the new value to localStorage', () => {
    const { result } = renderHook(() => useViewPref('list:1'))
    act(() => result.current.setGroupBy('status'))
    const stored = JSON.parse(localStorage.getItem(LS_KEY('list:1')))
    expect(stored.groupBy).toBe('status')
  })

  it('re-mounting with the same scopeKey reads the persisted groupBy', () => {
    const { result: r1 } = renderHook(() => useViewPref('list:1'))
    act(() => r1.current.setGroupBy('tag'))

    const { result: r2 } = renderHook(() => useViewPref('list:1'))
    expect(r2.current.groupBy).toBe('tag')
  })
})

describe('useViewPref — different scopeKeys are independent', () => {
  it('setting view on scope A does not affect scope B', () => {
    const { result: rA } = renderHook(() => useViewPref('list:1'))
    const { result: rB } = renderHook(() => useViewPref('list:2'))

    act(() => rA.current.setView('board'))

    // B still has default
    expect(rB.current.view).toBe('list')
  })

  it('each scopeKey writes to its own localStorage key', () => {
    const { result: rA } = renderHook(() => useViewPref('list:1'))
    const { result: rB } = renderHook(() => useViewPref('project:7'))

    act(() => rA.current.setView('calendar'))
    act(() => rB.current.setView('timeline'))

    expect(JSON.parse(localStorage.getItem(LS_KEY('list:1'))).view).toBe('calendar')
    expect(JSON.parse(localStorage.getItem(LS_KEY('project:7'))).view).toBe('timeline')
  })
})

describe('useViewPref — corrupt / invalid JSON falls back to defaults', () => {
  it('returns defaults when stored value is corrupt JSON', () => {
    localStorage.setItem(LS_KEY('list:99'), '{{not valid json}}')
    const { result } = renderHook(() => useViewPref('list:99'))
    expect(result.current.view).toBe('list')
    expect(result.current.groupBy).toBe('none')
  })

  it('returns defaults when stored value has an invalid view', () => {
    localStorage.setItem(LS_KEY('list:99'), JSON.stringify({ view: 'unknown', groupBy: 'none' }))
    const { result } = renderHook(() => useViewPref('list:99'))
    expect(result.current.view).toBe('list')
    expect(result.current.groupBy).toBe('none')
  })

  it('returns defaults when stored value has an invalid groupBy', () => {
    localStorage.setItem(LS_KEY('list:99'), JSON.stringify({ view: 'board', groupBy: 'bad-value' }))
    const { result } = renderHook(() => useViewPref('list:99'))
    expect(result.current.view).toBe('list')
    expect(result.current.groupBy).toBe('none')
  })

  it('returns defaults when localStorage is missing both keys', () => {
    localStorage.setItem(LS_KEY('list:99'), JSON.stringify({}))
    const { result } = renderHook(() => useViewPref('list:99'))
    expect(result.current.view).toBe('list')
    expect(result.current.groupBy).toBe('none')
  })
})

describe('useViewPref — changing scopeKey loads that scope', () => {
  it('loading a new scopeKey loads that scope\'s saved pref', () => {
    localStorage.setItem(LS_KEY('list:10'), JSON.stringify({ view: 'board', groupBy: 'assignee' }))
    localStorage.setItem(LS_KEY('list:20'), JSON.stringify({ view: 'calendar', groupBy: 'status' }))

    const { result: r1 } = renderHook(() => useViewPref('list:10'))
    expect(r1.current.view).toBe('board')
    expect(r1.current.groupBy).toBe('assignee')

    const { result: r2 } = renderHook(() => useViewPref('list:20'))
    expect(r2.current.view).toBe('calendar')
    expect(r2.current.groupBy).toBe('status')
  })
})
