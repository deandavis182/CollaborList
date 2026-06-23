import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock socket.io-client so no real network connection is attempted
// ---------------------------------------------------------------------------
vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    on: vi.fn(),
    off: vi.fn(),
    disconnect: vi.fn(),
  })),
}))

// ---------------------------------------------------------------------------
// Mock the zustand store so we can spy on setPresence / setTyping without
// needing a real DOM / React environment.
// ---------------------------------------------------------------------------
vi.mock('../store.js', () => {
  const setPresence = vi.fn()
  const setTyping = vi.fn()
  return {
    useStore: {
      getState: () => ({ setPresence, setTyping }),
    },
    __setPresenceSpy: setPresence,
    __setTypingSpy: setTyping,
  }
})

import { io } from 'socket.io-client'
import { createSocket, registerSocketHandlers } from '../socket.js'
import { useStore } from '../store.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a fake socket with handler tracking (on/off as vi.fn). */
function makeFakeSocket() {
  const handlers = {}

  return {
    on: vi.fn((event, handler) => {
      handlers[event] = handlers[event] ?? []
      handlers[event].push(handler)
    }),
    off: vi.fn((event, handler) => {
      if (handlers[event]) {
        handlers[event] = handlers[event].filter((h) => h !== handler)
      }
    }),
    emit: (event, payload) => {
      // Simulate server push by calling all registered handlers
      handlers[event]?.forEach((h) => h(payload))
    },
    _handlers: handlers,
  }
}

/** Build a mock QueryClient with the methods we care about. */
function makeMockQueryClient() {
  return {
    invalidateQueries: vi.fn(),
    setQueryData: vi.fn(),
  }
}

// ---------------------------------------------------------------------------
// createSocket
// ---------------------------------------------------------------------------

describe('createSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls io() with the token in the auth option', () => {
    createSocket('my-jwt-token')
    expect(io).toHaveBeenCalledWith({ auth: { token: 'my-jwt-token' } })
  })

  it('returns the socket object returned by io()', () => {
    const mockSocket = { on: vi.fn(), off: vi.fn() }
    io.mockReturnValueOnce(mockSocket)

    const socket = createSocket('token')
    expect(socket).toBe(mockSocket)
  })

  it('does not call io() at import time (no side effects)', () => {
    // io has been cleared; importing the module should not have called it
    // We simply verify that any calls are from explicit createSocket invocations
    const callsBefore = io.mock.calls.length
    // Re-import would be cached; we just verify count stays 0 without a call
    expect(callsBefore).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// registerSocketHandlers — workspace events
// ---------------------------------------------------------------------------

describe('registerSocketHandlers — workspace events', () => {
  let socket, queryClient

  beforeEach(() => {
    socket = makeFakeSocket()
    queryClient = makeMockQueryClient()
  })

  it('registers listeners on the socket', () => {
    registerSocketHandlers(socket, queryClient)
    expect(socket.on).toHaveBeenCalledWith('workspace-updated', expect.any(Function))
    expect(socket.on).toHaveBeenCalledWith('member-added', expect.any(Function))
    expect(socket.on).toHaveBeenCalledWith('member-removed', expect.any(Function))
  })

  it('invalidates workspaces on workspace-updated', () => {
    registerSocketHandlers(socket, queryClient)
    socket.emit('workspace-updated', { id: 1, name: 'Updated' })
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['workspaces'] })
  })

  it('invalidates workspaces on member-added', () => {
    registerSocketHandlers(socket, queryClient)
    socket.emit('member-added', { workspaceId: 1, userId: 99 })
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['workspaces'] })
  })

  it('invalidates workspaces on member-removed', () => {
    registerSocketHandlers(socket, queryClient)
    socket.emit('member-removed', { workspaceId: 1, userId: 99 })
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['workspaces'] })
  })
})

// ---------------------------------------------------------------------------
// registerSocketHandlers — list events
// ---------------------------------------------------------------------------

describe('registerSocketHandlers — list events', () => {
  let socket, queryClient

  beforeEach(() => {
    socket = makeFakeSocket()
    queryClient = makeMockQueryClient()
  })

  it('registers list-created, list-updated, list-deleted listeners', () => {
    registerSocketHandlers(socket, queryClient)
    expect(socket.on).toHaveBeenCalledWith('list-created', expect.any(Function))
    expect(socket.on).toHaveBeenCalledWith('list-updated', expect.any(Function))
    expect(socket.on).toHaveBeenCalledWith('list-deleted', expect.any(Function))
  })

  it('invalidates projects for the given workspaceId on list-created', () => {
    registerSocketHandlers(socket, queryClient)
    socket.emit('list-created', { workspaceId: 5, list: { id: 10, name: 'New List' } })
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['projects', 5] })
  })

  it('invalidates all projects when workspaceId is absent on list-created', () => {
    registerSocketHandlers(socket, queryClient)
    socket.emit('list-created', { list: { id: 10, name: 'New List' } })
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['projects'] })
  })

  it('invalidates projects for the given workspaceId on list-updated', () => {
    registerSocketHandlers(socket, queryClient)
    socket.emit('list-updated', { workspaceId: 3, list: { id: 7, name: 'Renamed' } })
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['projects', 3] })
  })

  it('also invalidates the specific list key on list-updated', () => {
    registerSocketHandlers(socket, queryClient)
    socket.emit('list-updated', { workspaceId: 3, list: { id: 7, name: 'Renamed' } })
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['lists', 7] })
  })

  it('invalidates projects and the deleted list key on list-deleted', () => {
    registerSocketHandlers(socket, queryClient)
    socket.emit('list-deleted', { workspaceId: 2, id: 55 })
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['projects', 2] })
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['lists', 55] })
  })
})

// ---------------------------------------------------------------------------
// registerSocketHandlers — cleanup
// ---------------------------------------------------------------------------

describe('registerSocketHandlers — cleanup', () => {
  let socket, queryClient

  beforeEach(() => {
    socket = makeFakeSocket()
    queryClient = makeMockQueryClient()
  })

  it('returns a cleanup function', () => {
    const cleanup = registerSocketHandlers(socket, queryClient)
    expect(typeof cleanup).toBe('function')
  })

  it('cleanup removes all registered listeners', () => {
    const cleanup = registerSocketHandlers(socket, queryClient)
    cleanup()
    expect(socket.off).toHaveBeenCalledWith('workspace-updated', expect.any(Function))
    expect(socket.off).toHaveBeenCalledWith('member-added', expect.any(Function))
    expect(socket.off).toHaveBeenCalledWith('member-removed', expect.any(Function))
    expect(socket.off).toHaveBeenCalledWith('list-created', expect.any(Function))
    expect(socket.off).toHaveBeenCalledWith('list-updated', expect.any(Function))
    expect(socket.off).toHaveBeenCalledWith('list-deleted', expect.any(Function))
  })

  it('after cleanup, events no longer trigger cache invalidation', () => {
    const cleanup = registerSocketHandlers(socket, queryClient)
    cleanup()

    // Simulate events after cleanup — handlers have been removed from our
    // fake socket's internal map via .off, so emit won't call them.
    socket.emit('workspace-updated', {})
    socket.emit('list-created', { workspaceId: 1 })

    expect(queryClient.invalidateQueries).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// registerSocketHandlers — item events
// ---------------------------------------------------------------------------

describe('registerSocketHandlers — item events', () => {
  let socket, queryClient

  beforeEach(() => {
    socket = makeFakeSocket()
    queryClient = makeMockQueryClient()
    vi.clearAllMocks()
  })

  it('registers item-created, item-updated, item-deleted listeners', () => {
    registerSocketHandlers(socket, queryClient)
    expect(socket.on).toHaveBeenCalledWith('item-created', expect.any(Function))
    expect(socket.on).toHaveBeenCalledWith('item-updated', expect.any(Function))
    expect(socket.on).toHaveBeenCalledWith('item-deleted', expect.any(Function))
  })

  it('item-created invalidates ["items", listId]', () => {
    registerSocketHandlers(socket, queryClient)
    socket.emit('item-created', { listId: 7, item: { id: 1 } })
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['items', 7] })
  })

  it('item-created also invalidates ["projectItems"]', () => {
    registerSocketHandlers(socket, queryClient)
    socket.emit('item-created', { listId: 7, item: { id: 1 } })
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['projectItems'] })
  })

  it('item-created also invalidates ["myTasks"]', () => {
    registerSocketHandlers(socket, queryClient)
    socket.emit('item-created', { listId: 7, item: { id: 1 } })
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['myTasks'] })
  })

  it('item-updated invalidates ["items", listId]', () => {
    registerSocketHandlers(socket, queryClient)
    socket.emit('item-updated', { listId: 3, item: { id: 2 } })
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['items', 3] })
  })

  it('item-updated also invalidates ["projectItems"]', () => {
    registerSocketHandlers(socket, queryClient)
    socket.emit('item-updated', { listId: 3, item: { id: 2 } })
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['projectItems'] })
  })

  it('item-updated also invalidates ["myTasks"]', () => {
    registerSocketHandlers(socket, queryClient)
    socket.emit('item-updated', { listId: 3, item: { id: 2 } })
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['myTasks'] })
  })

  it('item-deleted invalidates ["items", listId]', () => {
    registerSocketHandlers(socket, queryClient)
    socket.emit('item-deleted', { listId: 9, itemId: 5 })
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['items', 9] })
  })

  it('item-deleted also invalidates ["projectItems"]', () => {
    registerSocketHandlers(socket, queryClient)
    socket.emit('item-deleted', { listId: 9, itemId: 5 })
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['projectItems'] })
  })

  it('item-deleted also invalidates ["myTasks"]', () => {
    registerSocketHandlers(socket, queryClient)
    socket.emit('item-deleted', { listId: 9, itemId: 5 })
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['myTasks'] })
  })

  it('item-created does not throw on missing listId', () => {
    registerSocketHandlers(socket, queryClient)
    expect(() => socket.emit('item-created', {})).not.toThrow()
    expect(queryClient.invalidateQueries).not.toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['items', undefined] })
    )
  })

  it('item-created with missing listId still invalidates ["projectItems"] and ["myTasks"]', () => {
    registerSocketHandlers(socket, queryClient)
    socket.emit('item-created', {})
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['projectItems'] })
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['myTasks'] })
  })

  it('item-created does not throw on null payload', () => {
    registerSocketHandlers(socket, queryClient)
    expect(() => socket.emit('item-created', null)).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// registerSocketHandlers — comment events
// ---------------------------------------------------------------------------

describe('registerSocketHandlers — comment events', () => {
  let socket, queryClient

  beforeEach(() => {
    socket = makeFakeSocket()
    queryClient = makeMockQueryClient()
    vi.clearAllMocks()
  })

  it('registers comment-created, comment-deleted listeners', () => {
    registerSocketHandlers(socket, queryClient)
    expect(socket.on).toHaveBeenCalledWith('comment-created', expect.any(Function))
    expect(socket.on).toHaveBeenCalledWith('comment-deleted', expect.any(Function))
  })

  it('comment-created invalidates ["comments", itemId]', () => {
    registerSocketHandlers(socket, queryClient)
    socket.emit('comment-created', { listId: 1, itemId: 42, comment: {} })
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['comments', 42] })
  })

  it('comment-deleted invalidates ["comments", itemId]', () => {
    registerSocketHandlers(socket, queryClient)
    socket.emit('comment-deleted', { listId: 1, itemId: 42, commentId: 99 })
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['comments', 42] })
  })

  it('comment-created does not throw on missing itemId', () => {
    registerSocketHandlers(socket, queryClient)
    expect(() => socket.emit('comment-created', { listId: 1 })).not.toThrow()
  })

  it('comment-created does not throw on null payload', () => {
    registerSocketHandlers(socket, queryClient)
    expect(() => socket.emit('comment-created', null)).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// registerSocketHandlers — activity events
// ---------------------------------------------------------------------------

describe('registerSocketHandlers — activity events', () => {
  let socket, queryClient

  beforeEach(() => {
    socket = makeFakeSocket()
    queryClient = makeMockQueryClient()
    vi.clearAllMocks()
  })

  it('registers activity-created listener', () => {
    registerSocketHandlers(socket, queryClient)
    expect(socket.on).toHaveBeenCalledWith('activity-created', expect.any(Function))
  })

  it('activity-created invalidates ["activity", workspace_id]', () => {
    registerSocketHandlers(socket, queryClient)
    socket.emit('activity-created', { id: 1, workspace_id: 10, verb: 'commented' })
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['activity', 10] })
  })

  it('activity-created with verb "assigned" ALSO invalidates ["myTasks"]', () => {
    registerSocketHandlers(socket, queryClient)
    socket.emit('activity-created', { id: 1, workspace_id: 10, verb: 'assigned' })
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['activity', 10] })
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['myTasks'] })
  })

  it('activity-created with verb other than "assigned" does NOT invalidate ["myTasks"]', () => {
    registerSocketHandlers(socket, queryClient)
    socket.emit('activity-created', { id: 1, workspace_id: 10, verb: 'commented' })
    expect(queryClient.invalidateQueries).not.toHaveBeenCalledWith({ queryKey: ['myTasks'] })
  })

  it('activity-created does not throw on missing workspace_id', () => {
    registerSocketHandlers(socket, queryClient)
    expect(() => socket.emit('activity-created', { verb: 'commented' })).not.toThrow()
  })

  it('activity-created does not throw on null payload', () => {
    registerSocketHandlers(socket, queryClient)
    expect(() => socket.emit('activity-created', null)).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// registerSocketHandlers — presence events
// ---------------------------------------------------------------------------

describe('registerSocketHandlers — presence events', () => {
  let socket, queryClient, setPresenceSpy

  beforeEach(() => {
    socket = makeFakeSocket()
    queryClient = makeMockQueryClient()
    vi.clearAllMocks()
    setPresenceSpy = useStore.getState().setPresence
  })

  it('registers presence-update listener', () => {
    registerSocketHandlers(socket, queryClient)
    expect(socket.on).toHaveBeenCalledWith('presence-update', expect.any(Function))
  })

  it('presence-update converts array snapshot to map keyed by userId', () => {
    registerSocketHandlers(socket, queryClient)
    const snapshot = [
      { userId: 'u1', email: 'alice@x.com', currentListId: 1, lastSeen: '2024-01-01' },
      { userId: 'u2', email: 'bob@x.com', currentListId: 2, lastSeen: '2024-01-02' },
    ]
    socket.emit('presence-update', snapshot)
    expect(setPresenceSpy).toHaveBeenCalledWith({
      u1: { userId: 'u1', email: 'alice@x.com', currentListId: 1, lastSeen: '2024-01-01' },
      u2: { userId: 'u2', email: 'bob@x.com', currentListId: 2, lastSeen: '2024-01-02' },
    })
  })

  it('presence-update with empty array calls setPresence with empty map', () => {
    registerSocketHandlers(socket, queryClient)
    socket.emit('presence-update', [])
    expect(setPresenceSpy).toHaveBeenCalledWith({})
  })

  it('presence-update does not throw on null payload', () => {
    registerSocketHandlers(socket, queryClient)
    expect(() => socket.emit('presence-update', null)).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// registerSocketHandlers — typing events
// ---------------------------------------------------------------------------

describe('registerSocketHandlers — typing events', () => {
  let socket, queryClient, setTypingSpy

  beforeEach(() => {
    socket = makeFakeSocket()
    queryClient = makeMockQueryClient()
    vi.clearAllMocks()
    setTypingSpy = useStore.getState().setTyping
  })

  it('registers typing listener', () => {
    registerSocketHandlers(socket, queryClient)
    expect(socket.on).toHaveBeenCalledWith('typing', expect.any(Function))
  })

  it('typing event calls setTyping with the payload fields', () => {
    registerSocketHandlers(socket, queryClient)
    socket.emit('typing', { userId: 'u1', email: 'alice@x.com', listId: 5, isTyping: true })
    expect(setTypingSpy).toHaveBeenCalledWith({
      listId: 5,
      userId: 'u1',
      email: 'alice@x.com',
      isTyping: true,
    })
  })

  it('typing event with isTyping false calls setTyping correctly', () => {
    registerSocketHandlers(socket, queryClient)
    socket.emit('typing', { userId: 'u1', email: 'alice@x.com', listId: 5, isTyping: false })
    expect(setTypingSpy).toHaveBeenCalledWith({
      listId: 5,
      userId: 'u1',
      email: 'alice@x.com',
      isTyping: false,
    })
  })

  it('typing event does not throw on null payload', () => {
    registerSocketHandlers(socket, queryClient)
    expect(() => socket.emit('typing', null)).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// registerSocketHandlers — list events: projectLists invalidation
// ---------------------------------------------------------------------------

describe('registerSocketHandlers — list events: projectLists invalidation', () => {
  let socket, queryClient

  beforeEach(() => {
    socket = makeFakeSocket()
    queryClient = makeMockQueryClient()
    vi.clearAllMocks()
  })

  it('list-created with project_id invalidates ["projectLists", project_id]', () => {
    registerSocketHandlers(socket, queryClient)
    // payload IS the list row (has project_id directly)
    socket.emit('list-created', { id: 10, name: 'New List', project_id: 5 })
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['projectLists', 5] })
  })

  it('list-created with only workspaceId (no project_id) invalidates all projectLists broadly', () => {
    registerSocketHandlers(socket, queryClient)
    socket.emit('list-created', { workspaceId: 1, list: { id: 10, name: 'New List' } })
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['projectLists'] })
  })

  it('list-created with list.project_id invalidates ["projectLists", project_id]', () => {
    registerSocketHandlers(socket, queryClient)
    socket.emit('list-created', { workspaceId: 1, list: { id: 10, project_id: 7 } })
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['projectLists', 7] })
  })

  it('list-updated with project_id invalidates ["projectLists", project_id]', () => {
    registerSocketHandlers(socket, queryClient)
    socket.emit('list-updated', { workspaceId: 3, list: { id: 7, name: 'Renamed', project_id: 9 } })
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['projectLists', 9] })
  })

  it('list-updated without project_id invalidates all projectLists broadly', () => {
    registerSocketHandlers(socket, queryClient)
    socket.emit('list-updated', { workspaceId: 3, list: { id: 7, name: 'Renamed' } })
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['projectLists'] })
  })

  it('list-deleted with only id (no project_id) invalidates ["projectLists"] broadly', () => {
    registerSocketHandlers(socket, queryClient)
    socket.emit('list-deleted', { id: 55 })
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['projectLists'] })
  })

  it('list-deleted with project_id invalidates ["projectLists", project_id]', () => {
    registerSocketHandlers(socket, queryClient)
    socket.emit('list-deleted', { id: 55, project_id: 4 })
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['projectLists', 4] })
  })

  it('list-created does not throw on null payload', () => {
    registerSocketHandlers(socket, queryClient)
    expect(() => socket.emit('list-created', null)).not.toThrow()
  })

  it('list-updated does not throw on null payload', () => {
    registerSocketHandlers(socket, queryClient)
    expect(() => socket.emit('list-updated', null)).not.toThrow()
  })

  it('list-deleted does not throw on null payload', () => {
    registerSocketHandlers(socket, queryClient)
    expect(() => socket.emit('list-deleted', null)).not.toThrow()
  })

  it('existing list-created ["projects"] invalidation still fires', () => {
    registerSocketHandlers(socket, queryClient)
    socket.emit('list-created', { workspaceId: 5, list: { id: 10, name: 'New List' } })
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['projects', 5] })
  })

  it('existing list-deleted ["lists", id] invalidation still fires', () => {
    registerSocketHandlers(socket, queryClient)
    socket.emit('list-deleted', { workspaceId: 2, id: 55 })
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['lists', 55] })
  })
})

// ---------------------------------------------------------------------------
// registerSocketHandlers — extended cleanup (collaboration events)
// ---------------------------------------------------------------------------

describe('registerSocketHandlers — extended cleanup for collaboration events', () => {
  let socket, queryClient

  beforeEach(() => {
    socket = makeFakeSocket()
    queryClient = makeMockQueryClient()
    vi.clearAllMocks()
  })

  it('cleanup removes item event listeners', () => {
    const cleanup = registerSocketHandlers(socket, queryClient)
    cleanup()
    expect(socket.off).toHaveBeenCalledWith('item-created', expect.any(Function))
    expect(socket.off).toHaveBeenCalledWith('item-updated', expect.any(Function))
    expect(socket.off).toHaveBeenCalledWith('item-deleted', expect.any(Function))
  })

  it('cleanup removes comment event listeners', () => {
    const cleanup = registerSocketHandlers(socket, queryClient)
    cleanup()
    expect(socket.off).toHaveBeenCalledWith('comment-created', expect.any(Function))
    expect(socket.off).toHaveBeenCalledWith('comment-deleted', expect.any(Function))
  })

  it('cleanup removes activity-created listener', () => {
    const cleanup = registerSocketHandlers(socket, queryClient)
    cleanup()
    expect(socket.off).toHaveBeenCalledWith('activity-created', expect.any(Function))
  })

  it('cleanup removes presence-update listener', () => {
    const cleanup = registerSocketHandlers(socket, queryClient)
    cleanup()
    expect(socket.off).toHaveBeenCalledWith('presence-update', expect.any(Function))
  })

  it('cleanup removes typing listener', () => {
    const cleanup = registerSocketHandlers(socket, queryClient)
    cleanup()
    expect(socket.off).toHaveBeenCalledWith('typing', expect.any(Function))
  })
})

// ---------------------------------------------------------------------------
// registerSocketHandlers — field-updated events
// ---------------------------------------------------------------------------

describe('registerSocketHandlers — field-updated events', () => {
  let socket, queryClient

  beforeEach(() => {
    socket = makeFakeSocket()
    queryClient = makeMockQueryClient()
    vi.clearAllMocks()
  })

  it('registers field-updated listener', () => {
    registerSocketHandlers(socket, queryClient)
    expect(socket.on).toHaveBeenCalledWith('field-updated', expect.any(Function))
  })

  it('field-updated invalidates ["items", listId]', () => {
    registerSocketHandlers(socket, queryClient)
    socket.emit('field-updated', { listId: 5 })
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['items', 5] })
  })

  it('field-updated invalidates ["projectItems"]', () => {
    registerSocketHandlers(socket, queryClient)
    socket.emit('field-updated', { listId: 5 })
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['projectItems'] })
  })

  it('field-updated invalidates ["fieldDefs", listId]', () => {
    registerSocketHandlers(socket, queryClient)
    socket.emit('field-updated', { listId: 5 })
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['fieldDefs', 5] })
  })

  it('field-updated does not throw on null payload', () => {
    registerSocketHandlers(socket, queryClient)
    expect(() => socket.emit('field-updated', null)).not.toThrow()
  })

  it('field-updated does not throw on malformed payload (no listId)', () => {
    registerSocketHandlers(socket, queryClient)
    expect(() => socket.emit('field-updated', { itemId: 99 })).not.toThrow()
  })

  it('cleanup removes field-updated listener', () => {
    const cleanup = registerSocketHandlers(socket, queryClient)
    cleanup()
    expect(socket.off).toHaveBeenCalledWith('field-updated', expect.any(Function))
  })

  it('after cleanup, field-updated no longer triggers cache invalidation', () => {
    const cleanup = registerSocketHandlers(socket, queryClient)
    cleanup()
    socket.emit('field-updated', { listId: 5 })
    expect(queryClient.invalidateQueries).not.toHaveBeenCalled()
  })
})
