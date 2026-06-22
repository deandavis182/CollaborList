import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from '../store.js'

// Reset the store to its initial state before each test so they are isolated.
function resetStore() {
  useStore.setState({
    currentWorkspaceId: null,
    currentProjectId: null,
    detailItemId: null,
    presence: {},
    theme: 'light',
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
})
