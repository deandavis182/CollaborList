import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// ---------------------------------------------------------------------------
// Mock axios before importing api.js
// ---------------------------------------------------------------------------
vi.mock('axios', () => {
  const mockInstance = {
    get:    vi.fn(),
    post:   vi.fn(),
    put:    vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: {
        use: vi.fn((fn) => {
          mockInstance._requestInterceptor = fn
        }),
      },
    },
    _requestInterceptor: null,
  }

  return {
    default: {
      create: vi.fn(() => mockInstance),
    },
  }
})

// Import AFTER mocking
import { apiClient, useUpdateAnyItem, useProjectItems } from '../api.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries:   { retry: false },
      mutations: { retry: false },
    },
  })
}

function wrapper(queryClient) {
  return function Wrapper({ children }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

// ---------------------------------------------------------------------------
// useUpdateAnyItem
// ---------------------------------------------------------------------------

describe('useUpdateAnyItem', () => {
  let queryClient

  beforeEach(() => {
    queryClient = makeQueryClient()
    vi.resetAllMocks()
  })

  it('PUTs /items/:id with the changes (excluding list_id)', async () => {
    const updated = { id: 3, list_id: 10, text: 'Updated', completed: true }
    apiClient.put.mockResolvedValueOnce({ data: updated })
    apiClient.get.mockResolvedValue({ data: [] })

    const { result } = renderHook(() => useUpdateAnyItem(), { wrapper: wrapper(queryClient) })

    await act(async () => {
      result.current.mutate({ id: 3, list_id: 10, completed: true })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    // list_id should NOT be sent in the PUT body
    expect(apiClient.put).toHaveBeenCalledWith('/items/3', { completed: true })
  })

  it('invalidates ["items", list_id] on settled when list_id is present', async () => {
    apiClient.put.mockResolvedValueOnce({ data: { id: 3, list_id: 10 } })
    apiClient.get.mockResolvedValue({ data: [] })

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useUpdateAnyItem(), { wrapper: wrapper(queryClient) })

    await act(async () => {
      result.current.mutate({ id: 3, list_id: 10, completed: true })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['items', 10] })
  })

  it('does NOT invalidate ["items", list_id] when list_id is absent', async () => {
    apiClient.put.mockResolvedValueOnce({ data: { id: 3 } })
    apiClient.get.mockResolvedValue({ data: [] })

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useUpdateAnyItem(), { wrapper: wrapper(queryClient) })

    await act(async () => {
      result.current.mutate({ id: 3, completed: true })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    // Must NOT have been called with any ['items', ...] key
    const itemsInvalidations = invalidateSpy.mock.calls.filter(
      ([arg]) => Array.isArray(arg?.queryKey) && arg.queryKey[0] === 'items'
    )
    expect(itemsInvalidations).toHaveLength(0)
  })

  it('invalidates ["projectItems"] on settled', async () => {
    apiClient.put.mockResolvedValueOnce({ data: { id: 3, list_id: 10 } })
    apiClient.get.mockResolvedValue({ data: [] })

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useUpdateAnyItem(), { wrapper: wrapper(queryClient) })

    await act(async () => {
      result.current.mutate({ id: 3, list_id: 10, status: 'Done' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['projectItems'] })
  })

  it('invalidates ["myTasks"] on settled', async () => {
    apiClient.put.mockResolvedValueOnce({ data: { id: 3, list_id: 10 } })
    apiClient.get.mockResolvedValue({ data: [] })

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useUpdateAnyItem(), { wrapper: wrapper(queryClient) })

    await act(async () => {
      result.current.mutate({ id: 3, list_id: 10, assignee_id: 5 })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['myTasks'] })
  })

  it('invalidates all three targets on a single successful mutation', async () => {
    apiClient.put.mockResolvedValueOnce({ data: { id: 7, list_id: 20 } })
    apiClient.get.mockResolvedValue({ data: [] })

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useUpdateAnyItem(), { wrapper: wrapper(queryClient) })

    await act(async () => {
      result.current.mutate({ id: 7, list_id: 20, completed: false })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const keys = invalidateSpy.mock.calls.map(([arg]) => JSON.stringify(arg?.queryKey))
    expect(keys).toContain(JSON.stringify(['items', 20]))
    expect(keys).toContain(JSON.stringify(['projectItems']))
    expect(keys).toContain(JSON.stringify(['myTasks']))
  })

  it('surfaces errors from the API', async () => {
    apiClient.put.mockRejectedValueOnce(new Error('Forbidden'))

    const { result } = renderHook(() => useUpdateAnyItem(), { wrapper: wrapper(queryClient) })

    await act(async () => {
      result.current.mutate({ id: 3, list_id: 10, completed: true })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error.message).toBe('Forbidden')
  })
})

// ---------------------------------------------------------------------------
// useProjectItems
// ---------------------------------------------------------------------------

describe('useProjectItems', () => {
  let queryClient

  beforeEach(() => {
    queryClient = makeQueryClient()
    vi.resetAllMocks()
  })

  it('GETs /projects/:projectId/items', async () => {
    const items = [
      { id: 1, list_id: 5, text: 'Flower order',   completed: false },
      { id: 2, list_id: 6, text: 'Venue confirmed', completed: true  },
    ]
    apiClient.get.mockResolvedValueOnce({ data: items })

    const { result } = renderHook(() => useProjectItems(42), { wrapper: wrapper(queryClient) })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(items)
    expect(apiClient.get).toHaveBeenCalledWith('/projects/42/items')
  })

  it('uses query key ["projectItems", projectId]', async () => {
    apiClient.get.mockResolvedValueOnce({ data: [] })

    const { result } = renderHook(() => useProjectItems(42), { wrapper: wrapper(queryClient) })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const cached = queryClient.getQueryData(['projectItems', 42])
    expect(cached).toEqual([])
  })

  it('is disabled when projectId is null', () => {
    const { result } = renderHook(() => useProjectItems(null), { wrapper: wrapper(queryClient) })

    expect(result.current.fetchStatus).toBe('idle')
    expect(apiClient.get).not.toHaveBeenCalled()
  })

  it('is disabled when projectId is undefined', () => {
    const { result } = renderHook(() => useProjectItems(undefined), { wrapper: wrapper(queryClient) })

    expect(result.current.fetchStatus).toBe('idle')
    expect(apiClient.get).not.toHaveBeenCalled()
  })

  it('is enabled when projectId is a truthy string', async () => {
    apiClient.get.mockResolvedValueOnce({ data: [] })

    const { result } = renderHook(() => useProjectItems('proj-7'), { wrapper: wrapper(queryClient) })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(apiClient.get).toHaveBeenCalledWith('/projects/proj-7/items')
  })

  it('surfaces errors from the API', async () => {
    apiClient.get.mockRejectedValueOnce(new Error('Not found'))

    const { result } = renderHook(() => useProjectItems(42), { wrapper: wrapper(queryClient) })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error.message).toBe('Not found')
  })
})
