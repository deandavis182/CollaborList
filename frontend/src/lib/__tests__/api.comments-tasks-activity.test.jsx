import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// ---------------------------------------------------------------------------
// Mock axios module before importing api.js so the interceptor is set up on
// the mocked instance.
// ---------------------------------------------------------------------------
vi.mock('axios', () => {
  const mockInstance = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
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
import {
  apiClient,
  useItemComments,
  useCreateComment,
  useDeleteComment,
  useMyTasks,
  useWorkspaceActivity,
  useMarkActivityRead,
} from '../api.js'

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
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
// useItemComments
// ---------------------------------------------------------------------------

describe('useItemComments', () => {
  let queryClient

  beforeEach(() => {
    queryClient = makeQueryClient()
    vi.resetAllMocks()
  })

  it('returns data from GET /items/:itemId/comments', async () => {
    const comments = [
      { id: 1, item_id: 5, body: 'First comment', user_id: 10 },
      { id: 2, item_id: 5, body: 'Second comment', user_id: 11 },
    ]
    apiClient.get.mockResolvedValueOnce({ data: comments })

    const { result } = renderHook(() => useItemComments(5), { wrapper: wrapper(queryClient) })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(comments)
    expect(apiClient.get).toHaveBeenCalledWith('/items/5/comments')
  })

  it('uses query key ["comments", itemId]', async () => {
    apiClient.get.mockResolvedValueOnce({ data: [] })

    const { result } = renderHook(() => useItemComments(5), { wrapper: wrapper(queryClient) })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const cached = queryClient.getQueryData(['comments', 5])
    expect(cached).toEqual([])
  })

  it('is disabled when itemId is null', () => {
    const { result } = renderHook(() => useItemComments(null), { wrapper: wrapper(queryClient) })

    expect(result.current.fetchStatus).toBe('idle')
    expect(apiClient.get).not.toHaveBeenCalled()
  })

  it('is disabled when itemId is undefined', () => {
    const { result } = renderHook(() => useItemComments(undefined), { wrapper: wrapper(queryClient) })

    expect(result.current.fetchStatus).toBe('idle')
    expect(apiClient.get).not.toHaveBeenCalled()
  })

  it('is disabled when itemId is 0 (falsy)', () => {
    const { result } = renderHook(() => useItemComments(0), { wrapper: wrapper(queryClient) })

    expect(result.current.fetchStatus).toBe('idle')
    expect(apiClient.get).not.toHaveBeenCalled()
  })

  it('surfaces errors from the API', async () => {
    apiClient.get.mockRejectedValueOnce(new Error('Not found'))

    const { result } = renderHook(() => useItemComments(5), { wrapper: wrapper(queryClient) })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error.message).toBe('Not found')
  })
})

// ---------------------------------------------------------------------------
// useCreateComment
// ---------------------------------------------------------------------------

describe('useCreateComment', () => {
  let queryClient

  beforeEach(() => {
    queryClient = makeQueryClient()
    vi.resetAllMocks()
  })

  it('posts { body } to /items/:itemId/comments', async () => {
    const created = { id: 10, item_id: 5, body: 'Hello', user_id: 1 }
    apiClient.post.mockResolvedValueOnce({ data: created })
    apiClient.get.mockResolvedValueOnce({ data: [created] }) // invalidation refetch

    const { result } = renderHook(() => useCreateComment(5), { wrapper: wrapper(queryClient) })

    await act(async () => {
      result.current.mutate({ body: 'Hello' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(apiClient.post).toHaveBeenCalledWith('/items/5/comments', { body: 'Hello' })
  })

  it('invalidates ["comments", itemId] on settled (success)', async () => {
    const created = { id: 10, item_id: 5, body: 'Hello', user_id: 1 }
    apiClient.post.mockResolvedValueOnce({ data: created })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    apiClient.get.mockResolvedValueOnce({ data: [created] })

    const { result } = renderHook(() => useCreateComment(5), { wrapper: wrapper(queryClient) })

    await act(async () => {
      result.current.mutate({ body: 'Hello' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['comments', 5] })
  })

  it('invalidates ["comments", itemId] on settled even when mutation fails', async () => {
    apiClient.post.mockRejectedValueOnce(new Error('Server error'))
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    apiClient.get.mockResolvedValueOnce({ data: [] })

    const { result } = renderHook(() => useCreateComment(5), { wrapper: wrapper(queryClient) })

    await act(async () => {
      result.current.mutate({ body: 'Bad comment' })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    // onSettled fires on both success and error
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['comments', 5] })
  })

  it('surfaces errors from the API', async () => {
    apiClient.post.mockRejectedValueOnce(new Error('Forbidden'))
    apiClient.get.mockResolvedValueOnce({ data: [] })

    const { result } = renderHook(() => useCreateComment(5), { wrapper: wrapper(queryClient) })

    await act(async () => {
      result.current.mutate({ body: 'Nope' })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error.message).toBe('Forbidden')
  })
})

// ---------------------------------------------------------------------------
// useDeleteComment
// ---------------------------------------------------------------------------

describe('useDeleteComment', () => {
  let queryClient

  beforeEach(() => {
    queryClient = makeQueryClient()
    vi.resetAllMocks()
  })

  it('calls DELETE /comments/:commentId', async () => {
    apiClient.delete.mockResolvedValueOnce({ data: { success: true } })
    apiClient.get.mockResolvedValueOnce({ data: [] }) // invalidation refetch

    const { result } = renderHook(() => useDeleteComment(5), { wrapper: wrapper(queryClient) })

    await act(async () => {
      result.current.mutate(10)
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(apiClient.delete).toHaveBeenCalledWith('/comments/10')
  })

  it('invalidates ["comments", itemId] on settled (success)', async () => {
    apiClient.delete.mockResolvedValueOnce({ data: { success: true } })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    apiClient.get.mockResolvedValueOnce({ data: [] })

    const { result } = renderHook(() => useDeleteComment(5), { wrapper: wrapper(queryClient) })

    await act(async () => {
      result.current.mutate(10)
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['comments', 5] })
  })

  it('invalidates ["comments", itemId] on settled even when mutation fails', async () => {
    apiClient.delete.mockRejectedValueOnce(new Error('Not found'))
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    apiClient.get.mockResolvedValueOnce({ data: [] })

    const { result } = renderHook(() => useDeleteComment(5), { wrapper: wrapper(queryClient) })

    await act(async () => {
      result.current.mutate(99)
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    // onSettled fires on both success and error
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['comments', 5] })
  })

  it('surfaces errors from a failed delete', async () => {
    apiClient.delete.mockRejectedValueOnce(new Error('Not found'))
    apiClient.get.mockResolvedValueOnce({ data: [] })

    const { result } = renderHook(() => useDeleteComment(5), { wrapper: wrapper(queryClient) })

    await act(async () => {
      result.current.mutate(99)
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error.message).toBe('Not found')
  })
})

// ---------------------------------------------------------------------------
// useMyTasks
// ---------------------------------------------------------------------------

describe('useMyTasks', () => {
  let queryClient

  beforeEach(() => {
    queryClient = makeQueryClient()
    vi.resetAllMocks()
  })

  it('returns data from GET /me/tasks', async () => {
    const tasks = [
      { id: 1, text: 'Finish report', completed: false, list_id: 3 },
      { id: 2, text: 'Review PR', completed: true, list_id: 4 },
    ]
    apiClient.get.mockResolvedValueOnce({ data: tasks })

    const { result } = renderHook(() => useMyTasks(), { wrapper: wrapper(queryClient) })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(tasks)
    expect(apiClient.get).toHaveBeenCalledWith('/me/tasks')
  })

  it('uses query key ["myTasks"]', async () => {
    apiClient.get.mockResolvedValueOnce({ data: [] })

    const { result } = renderHook(() => useMyTasks(), { wrapper: wrapper(queryClient) })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const cached = queryClient.getQueryData(['myTasks'])
    expect(cached).toEqual([])
  })

  it('is always enabled (fetches without a guard argument)', async () => {
    apiClient.get.mockResolvedValueOnce({ data: [] })

    const { result } = renderHook(() => useMyTasks(), { wrapper: wrapper(queryClient) })

    // Should start fetching immediately (not idle)
    expect(result.current.fetchStatus).not.toBe('idle')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiClient.get).toHaveBeenCalledWith('/me/tasks')
  })

  it('returns an array of tasks', async () => {
    const tasks = [{ id: 1, text: 'Task one', completed: false }]
    apiClient.get.mockResolvedValueOnce({ data: tasks })

    const { result } = renderHook(() => useMyTasks(), { wrapper: wrapper(queryClient) })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(Array.isArray(result.current.data)).toBe(true)
    expect(result.current.data).toHaveLength(1)
  })

  it('surfaces errors from the API', async () => {
    apiClient.get.mockRejectedValueOnce(new Error('Unauthorized'))

    const { result } = renderHook(() => useMyTasks(), { wrapper: wrapper(queryClient) })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error.message).toBe('Unauthorized')
  })
})

// ---------------------------------------------------------------------------
// useWorkspaceActivity
// ---------------------------------------------------------------------------

describe('useWorkspaceActivity', () => {
  let queryClient

  beforeEach(() => {
    queryClient = makeQueryClient()
    vi.resetAllMocks()
  })

  it('returns { items, unread } from GET /activity/workspace/:workspaceId', async () => {
    const activityData = {
      items: [
        { id: 1, type: 'item_created', actor: 'Alice', created_at: '2026-06-01T12:00:00Z' },
      ],
      unread: 3,
    }
    apiClient.get.mockResolvedValueOnce({ data: activityData })

    const { result } = renderHook(() => useWorkspaceActivity(7), { wrapper: wrapper(queryClient) })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(activityData)
    expect(result.current.data.items).toHaveLength(1)
    expect(result.current.data.unread).toBe(3)
    expect(apiClient.get).toHaveBeenCalledWith('/activity/workspace/7')
  })

  it('uses query key ["activity", workspaceId]', async () => {
    const activityData = { items: [], unread: 0 }
    apiClient.get.mockResolvedValueOnce({ data: activityData })

    const { result } = renderHook(() => useWorkspaceActivity(7), { wrapper: wrapper(queryClient) })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const cached = queryClient.getQueryData(['activity', 7])
    expect(cached).toEqual(activityData)
  })

  it('is disabled when workspaceId is null', () => {
    const { result } = renderHook(() => useWorkspaceActivity(null), { wrapper: wrapper(queryClient) })

    expect(result.current.fetchStatus).toBe('idle')
    expect(apiClient.get).not.toHaveBeenCalled()
  })

  it('is disabled when workspaceId is undefined', () => {
    const { result } = renderHook(() => useWorkspaceActivity(undefined), { wrapper: wrapper(queryClient) })

    expect(result.current.fetchStatus).toBe('idle')
    expect(apiClient.get).not.toHaveBeenCalled()
  })

  it('is disabled when workspaceId is 0 (falsy)', () => {
    const { result } = renderHook(() => useWorkspaceActivity(0), { wrapper: wrapper(queryClient) })

    expect(result.current.fetchStatus).toBe('idle')
    expect(apiClient.get).not.toHaveBeenCalled()
  })

  it('surfaces errors from the API', async () => {
    apiClient.get.mockRejectedValueOnce(new Error('Forbidden'))

    const { result } = renderHook(() => useWorkspaceActivity(7), { wrapper: wrapper(queryClient) })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error.message).toBe('Forbidden')
  })
})

// ---------------------------------------------------------------------------
// useMarkActivityRead
// ---------------------------------------------------------------------------

describe('useMarkActivityRead', () => {
  let queryClient

  beforeEach(() => {
    queryClient = makeQueryClient()
    vi.resetAllMocks()
  })

  it('posts to /activity/workspace/:workspaceId/read', async () => {
    apiClient.post.mockResolvedValueOnce({ data: { success: true } })
    apiClient.get.mockResolvedValueOnce({ data: { items: [], unread: 0 } }) // invalidation refetch

    const { result } = renderHook(() => useMarkActivityRead(7), { wrapper: wrapper(queryClient) })

    await act(async () => {
      result.current.mutate()
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(apiClient.post).toHaveBeenCalledWith('/activity/workspace/7/read')
  })

  it('invalidates ["activity", workspaceId] on success', async () => {
    apiClient.post.mockResolvedValueOnce({ data: { success: true } })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    apiClient.get.mockResolvedValueOnce({ data: { items: [], unread: 0 } })

    const { result } = renderHook(() => useMarkActivityRead(7), { wrapper: wrapper(queryClient) })

    await act(async () => {
      result.current.mutate()
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['activity', 7] })
  })

  it('surfaces errors from a failed mark-read', async () => {
    apiClient.post.mockRejectedValueOnce(new Error('Forbidden'))

    const { result } = renderHook(() => useMarkActivityRead(7), { wrapper: wrapper(queryClient) })

    await act(async () => {
      result.current.mutate()
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error.message).toBe('Forbidden')
  })

  it('does not call GET (invalidation) when POST fails', async () => {
    apiClient.post.mockRejectedValueOnce(new Error('Server error'))

    const { result } = renderHook(() => useMarkActivityRead(7), { wrapper: wrapper(queryClient) })

    await act(async () => {
      result.current.mutate()
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    // onSuccess guard means invalidation GET should not have been called
    expect(apiClient.get).not.toHaveBeenCalled()
  })
})
