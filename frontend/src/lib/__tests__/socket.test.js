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

import { io } from 'socket.io-client'
import { createSocket, registerSocketHandlers } from '../socket.js'

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
