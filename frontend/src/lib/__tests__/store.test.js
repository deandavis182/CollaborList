import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from '../store.js'

// Reset the store to its initial state before each test so they are isolated.
function resetStore() {
  useStore.setState({
    currentWorkspaceId: null,
    currentProjectId: null,
    detailItemId: null,
    detailContext: null,
    presence: {},
    typing: {},
    theme: 'light',
    searchQuery: '',
    quickAddOpen: false,
    toast: null,
  })
}

describe('useStore — navigation', () => {
  beforeEach(resetStore)

  it('starts with null workspace and project IDs', () => {
    const { currentWorkspaceId, currentProjectId } = useStore.getState()
    expect(currentWorkspaceId).toBeNull()
    expect(currentProjectId).toBeNull()
  })

  it('setCurrentWorkspace updates currentWorkspaceId', () => {
    useStore.getState().setCurrentWorkspace(42)
    expect(useStore.getState().currentWorkspaceId).toBe(42)
  })

  it('setCurrentProject updates currentProjectId', () => {
    useStore.getState().setCurrentProject('project-99')
    expect(useStore.getState().currentProjectId).toBe('project-99')
  })

  it('setting one ID does not affect the other', () => {
    useStore.getState().setCurrentWorkspace(1)
    useStore.getState().setCurrentProject(2)
    expect(useStore.getState().currentWorkspaceId).toBe(1)
    expect(useStore.getState().currentProjectId).toBe(2)
  })
})

describe('useStore — detail sheet', () => {
  beforeEach(resetStore)

  it('starts with no open detail', () => {
    expect(useStore.getState().detailItemId).toBeNull()
  })

  it('openDetail sets detailItemId', () => {
    useStore.getState().openDetail('item-abc')
    expect(useStore.getState().detailItemId).toBe('item-abc')
  })

  it('closeDetail clears detailItemId', () => {
    useStore.getState().openDetail('item-abc')
    useStore.getState().closeDetail()
    expect(useStore.getState().detailItemId).toBeNull()
  })

  it('openDetail replaces a previously open item', () => {
    useStore.getState().openDetail('item-1')
    useStore.getState().openDetail('item-2')
    expect(useStore.getState().detailItemId).toBe('item-2')
  })
})

describe('useStore — presence', () => {
  beforeEach(resetStore)

  it('starts with an empty presence map', () => {
    expect(useStore.getState().presence).toEqual({})
  })

  it('setPresence replaces the presence map', () => {
    const map = { 'user-1': { name: 'Alice', color: '#FF0000' } }
    useStore.getState().setPresence(map)
    expect(useStore.getState().presence).toEqual(map)
  })

  it('setPresence with an empty object clears presence', () => {
    useStore.getState().setPresence({ 'user-1': { name: 'Alice' } })
    useStore.getState().setPresence({})
    expect(useStore.getState().presence).toEqual({})
  })
})

describe('useStore — typing', () => {
  beforeEach(resetStore)

  it('starts with an empty typing map', () => {
    expect(useStore.getState().typing).toEqual({})
  })

  it('setTyping with isTyping=true adds userId under listId', () => {
    useStore.getState().setTyping({ listId: 5, userId: 'u1', email: 'alice@x.com', isTyping: true })
    expect(useStore.getState().typing).toEqual({ 5: { u1: 'alice@x.com' } })
  })

  it('setTyping with isTyping=true adds multiple users under the same listId', () => {
    useStore.getState().setTyping({ listId: 5, userId: 'u1', email: 'alice@x.com', isTyping: true })
    useStore.getState().setTyping({ listId: 5, userId: 'u2', email: 'bob@x.com', isTyping: true })
    expect(useStore.getState().typing).toEqual({ 5: { u1: 'alice@x.com', u2: 'bob@x.com' } })
  })

  it('setTyping with isTyping=false removes userId from under listId', () => {
    useStore.getState().setTyping({ listId: 5, userId: 'u1', email: 'alice@x.com', isTyping: true })
    useStore.getState().setTyping({ listId: 5, userId: 'u2', email: 'bob@x.com', isTyping: true })
    useStore.getState().setTyping({ listId: 5, userId: 'u1', email: 'alice@x.com', isTyping: false })
    expect(useStore.getState().typing).toEqual({ 5: { u2: 'bob@x.com' } })
  })

  it('drops the listId key when the last user stops typing', () => {
    useStore.getState().setTyping({ listId: 5, userId: 'u1', email: 'alice@x.com', isTyping: true })
    useStore.getState().setTyping({ listId: 5, userId: 'u1', email: 'alice@x.com', isTyping: false })
    expect(useStore.getState().typing).toEqual({})
    expect(Object.keys(useStore.getState().typing)).not.toContain('5')
  })

  it('setTyping handles multiple lists independently', () => {
    useStore.getState().setTyping({ listId: 1, userId: 'u1', email: 'alice@x.com', isTyping: true })
    useStore.getState().setTyping({ listId: 2, userId: 'u2', email: 'bob@x.com', isTyping: true })
    expect(useStore.getState().typing).toEqual({
      1: { u1: 'alice@x.com' },
      2: { u2: 'bob@x.com' },
    })
  })

  it('removing from one list does not affect another', () => {
    useStore.getState().setTyping({ listId: 1, userId: 'u1', email: 'alice@x.com', isTyping: true })
    useStore.getState().setTyping({ listId: 2, userId: 'u2', email: 'bob@x.com', isTyping: true })
    useStore.getState().setTyping({ listId: 1, userId: 'u1', email: 'alice@x.com', isTyping: false })
    expect(useStore.getState().typing).toEqual({ 2: { u2: 'bob@x.com' } })
  })

  it('isTyping=false on a user not in the map does not throw', () => {
    expect(() =>
      useStore.getState().setTyping({ listId: 99, userId: 'u-ghost', email: 'x@y.com', isTyping: false })
    ).not.toThrow()
  })
})

describe('useStore — theme', () => {
  beforeEach(resetStore)

  it('starts with light theme', () => {
    expect(useStore.getState().theme).toBe('light')
  })

  it('toggleTheme switches from light to dark', () => {
    useStore.getState().toggleTheme()
    expect(useStore.getState().theme).toBe('dark')
  })

  it('toggleTheme switches from dark back to light', () => {
    useStore.getState().toggleTheme()
    useStore.getState().toggleTheme()
    expect(useStore.getState().theme).toBe('light')
  })

  it('toggles multiple times correctly', () => {
    for (let i = 0; i < 5; i++) {
      useStore.getState().toggleTheme()
    }
    // 5 toggles: light → dark → light → dark → light → dark
    expect(useStore.getState().theme).toBe('dark')
  })

  it('toggleTheme persists to localStorage', () => {
    useStore.getState().toggleTheme()
    expect(localStorage.getItem('theme')).toBe('dark')
  })
})

describe('useStore — mobile extensions', () => {
  beforeEach(resetStore)

  it('setSearchQuery updates searchQuery', () => {
    useStore.getState().setSearchQuery('cake')
    expect(useStore.getState().searchQuery).toBe('cake')
  })

  it('setQuickAddOpen toggles quickAddOpen', () => {
    useStore.getState().setQuickAddOpen(true)
    expect(useStore.getState().quickAddOpen).toBe(true)
  })

  it('openItem sets id and context; closeDetail clears both', () => {
    useStore.getState().openItem(5, { listId: 2, workspaceId: 9 })
    expect(useStore.getState().detailItemId).toBe(5)
    expect(useStore.getState().detailContext).toEqual({ listId: 2, workspaceId: 9 })
    useStore.getState().closeDetail()
    expect(useStore.getState().detailItemId).toBeNull()
    expect(useStore.getState().detailContext).toBeNull()
  })

  it('setTheme persists to localStorage', () => {
    useStore.getState().setTheme('dark')
    expect(localStorage.getItem('theme')).toBe('dark')
    expect(useStore.getState().theme).toBe('dark')
  })
})

describe('useStore — socketConnected', () => {
  beforeEach(resetStore)

  it('starts with socketConnected false', () => {
    expect(useStore.getState().socketConnected).toBe(false)
  })

  it('setSocketConnected(true) sets socketConnected to true', () => {
    useStore.getState().setSocketConnected(true)
    expect(useStore.getState().socketConnected).toBe(true)
  })

  it('setSocketConnected(false) sets socketConnected back to false', () => {
    useStore.getState().setSocketConnected(true)
    useStore.getState().setSocketConnected(false)
    expect(useStore.getState().socketConnected).toBe(false)
  })
})

describe('useStore — global toast', () => {
  beforeEach(resetStore)

  it('starts with no toast', () => {
    expect(useStore.getState().toast).toBeNull()
  })

  it('showToast sets the message with default success variant', () => {
    useStore.getState().showToast('Task added')
    expect(useStore.getState().toast).toEqual({ message: 'Task added', variant: 'success' })
  })

  it('showToast accepts an explicit variant', () => {
    useStore.getState().showToast('Something broke', 'error')
    expect(useStore.getState().toast).toEqual({ message: 'Something broke', variant: 'error' })
  })

  it('dismissToast clears the toast', () => {
    useStore.getState().showToast('Task added')
    useStore.getState().dismissToast()
    expect(useStore.getState().toast).toBeNull()
  })
})
