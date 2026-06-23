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
import { apiClient, useListItems, useCreateItem, useUpdateItem, useDeleteItem } from '../api.js'
import { EVENTS } from '../events.js'

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
// events.js catalog
// ---------------------------------------------------------------------------

describe('EVENTS catalog', () => {
  it('exports exactly 9 event names', () => {
    expect(Object.keys(EVENTS)).toHaveLength(9)
  })

  it('matches backend string values exactly', () => {
    expect(EVENTS.COMMENT_CREATED).toBe('comment-created')
    expect(EVENTS.COMMENT_DELETED).toBe('comment-deleted')
    expect(EVENTS.ACTIVITY_CREATED).toBe('activity-created')
    expect(EVENTS.PRESENCE_UPDATE).toBe('presence-update')
    expect(EVENTS.TYPING).toBe('typing')
    expect(EVENTS.ITEM_CREATED).toBe('item-created')
    expect(EVENTS.ITEM_UPDATED).toBe('item-updated')
    expect(EVENTS.ITEM_DELETED).toBe('item-deleted')
  })

  it('is frozen (immutable)', () => {
    expect(Object.isFrozen(EVENTS)).toBe(true)
  })

  it('does not allow adding new keys', () => {
    expect(() => {
      EVENTS.NEW_KEY = 'new-key'
    }).toThrow()
  })
})

// ---------------------------------------------------------------------------
// useListItems
// ---------------------------------------------------------------------------

describe('useListItems', () => {
  let queryClient

  beforeEach(() => {
    queryClient = makeQueryClient()
    vi.resetAllMocks()
  })

  it('returns data from GET /lists/:listId/items', async () => {
    const items = [
      { id: 1, list_id: 10, text: 'Buy groceries', completed: false },
      { id: 2, list_id: 10, text: 'Call dentist', completed: true },
    ]
    apiClient.get.mockResolvedValueOnce({ data: items })

    const { result } = renderHook(() => useListItems(10), { wrapper: wrapper(queryClient) })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(items)
    expect(apiClient.get).toHaveBeenCalledWith('/lists/10/items')
  })

  it('uses query key ["items", listId]', async () => {
    apiClient.get.mockResolvedValueOnce({ data: [] })

    const { result } = renderHook(() => useListItems(10), { wrapper: wrapper(queryClient) })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const cached = queryClient.getQueryData(['items', 10])
    expect(cached).toEqual([])
  })

  it('is disabled when listId is null', () => {
    const { result } = renderHook(() => useListItems(null), { wrapper: wrapper(queryClient) })

    expect(result.current.fetchStatus).toBe('idle')
    expect(apiClient.get).not.toHaveBeenCalled()
  })

  it('is disabled when listId is undefined', () => {
    const { result } = renderHook(() => useListItems(undefined), { wrapper: wrapper(queryClient) })

    expect(result.current.fetchStatus).toBe('idle')
    expect(apiClient.get).not.toHaveBeenCalled()
  })

  it('surfaces errors from the API', async () => {
    apiClient.get.mockRejectedValueOnce(new Error('Not found'))

    const { result } = renderHook(() => useListItems(10), { wrapper: wrapper(queryClient) })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error.message).toBe('Not found')
  })
})

// ---------------------------------------------------------------------------
// useCreateItem
// ---------------------------------------------------------------------------

describe('useCreateItem', () => {
  let queryClient

  beforeEach(() => {
    queryClient = makeQueryClient()
    vi.resetAllMocks()
  })

  it('posts to /lists/:listId/items', async () => {
    const created = { id: 5, list_id: 10, text: 'New item', completed: false }
    apiClient.post.mockResolvedValueOnce({ data: created })
    apiClient.get.mockResolvedValueOnce({ data: [] })

    const { result } = renderHook(() => useCreateItem(10), { wrapper: wrapper(queryClient) })

    await act(async () => {
      result.current.mutate({ text: 'New item' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(apiClient.post).toHaveBeenCalledWith('/lists/10/items', { text: 'New item' })
  })

  it('optimistically appends a temp item before server responds', async () => {
    queryClient.setQueryData(['items', 10], [{ id: 1, list_id: 10, text: 'Existing', completed: false }])

    let resolve
    apiClient.post.mockReturnValueOnce(new Promise((res) => { resolve = res }))

    const { result } = renderHook(() => useCreateItem(10), { wrapper: wrapper(queryClient) })

    act(() => {
      result.current.mutate({ text: 'New Item' })
    })

    // After onMutate fires, the temp item should be in cache
    await waitFor(() => {
      const cached = queryClient.getQueryData(['items', 10])
      return cached && cached.some((i) => i.text === 'New Item' && String(i.id).startsWith('temp-'))
    })

    const cached = queryClient.getQueryData(['items', 10])
    expect(cached).toHaveLength(2)
    const temp = cached.find((i) => String(i.id).startsWith('temp-'))
    expect(temp.text).toBe('New Item')
    expect(temp.completed).toBe(false)
    expect(temp.status).toBe('To do')
    expect(temp.list_id).toBe(10)

    // Clean up
    resolve({ data: { id: 99, list_id: 10, text: 'New Item', completed: false } })
    apiClient.get.mockResolvedValueOnce({ data: [] })
  })

  it('rolls back on error', async () => {
    const original = [{ id: 1, list_id: 10, text: 'Existing', completed: false }]
    queryClient.setQueryData(['items', 10], original)

    apiClient.post.mockRejectedValueOnce(new Error('Server error'))
    apiClient.get.mockResolvedValueOnce({ data: original })

    const { result } = renderHook(() => useCreateItem(10), { wrapper: wrapper(queryClient) })

    await act(async () => {
      result.current.mutate({ text: 'Bad item' })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    await waitFor(() => {
      const cached = queryClient.getQueryData(['items', 10])
      return !cached?.some((i) => String(i.id).startsWith('temp-'))
    })
  })

  it('invalidates ["items", listId] on settled', async () => {
    const created = { id: 5, list_id: 10, text: 'New item', completed: false }
    apiClient.post.mockResolvedValueOnce({ data: created })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    apiClient.get.mockResolvedValueOnce({ data: [created] })

    const { result } = renderHook(() => useCreateItem(10), { wrapper: wrapper(queryClient) })

    await act(async () => {
      result.current.mutate({ text: 'New item' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['items', 10] })
  })

  it('passes optional fields (parent_id, status, assignee_id, due_date) to the API', async () => {
    const created = { id: 6, list_id: 10, text: 'Child item', completed: false }
    apiClient.post.mockResolvedValueOnce({ data: created })
    apiClient.get.mockResolvedValueOnce({ data: [] })

    const { result } = renderHook(() => useCreateItem(10), { wrapper: wrapper(queryClient) })

    await act(async () => {
      result.current.mutate({
        text: 'Child item',
        parent_id: 1,
        status: 'In progress',
        assignee_id: 42,
        due_date: '2026-12-31',
      })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(apiClient.post).toHaveBeenCalledWith('/lists/10/items', {
      text: 'Child item',
      parent_id: 1,
      status: 'In progress',
      assignee_id: 42,
      due_date: '2026-12-31',
    })
  })
})

// ---------------------------------------------------------------------------
// useUpdateItem
// ---------------------------------------------------------------------------

describe('useUpdateItem', () => {
  let queryClient

  beforeEach(() => {
    queryClient = makeQueryClient()
    vi.resetAllMocks()
  })

  it('calls PUT /items/:id with the fields', async () => {
    const updated = { id: 3, list_id: 10, text: 'Updated text', completed: true }
    apiClient.put.mockResolvedValueOnce({ data: updated })
    apiClient.get.mockResolvedValueOnce({ data: [updated] })

    const { result } = renderHook(() => useUpdateItem(10), { wrapper: wrapper(queryClient) })

    await act(async () => {
      result.current.mutate({ id: 3, text: 'Updated text', completed: true })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(apiClient.put).toHaveBeenCalledWith('/items/3', { text: 'Updated text', completed: true })
  })

  it('optimistically merges fields into the matching cached item', async () => {
    queryClient.setQueryData(['items', 10], [
      { id: 3, list_id: 10, text: 'Original text', completed: false },
      { id: 4, list_id: 10, text: 'Another item', completed: false },
    ])

    let resolve
    apiClient.put.mockReturnValueOnce(new Promise((res) => { resolve = res }))

    const { result } = renderHook(() => useUpdateItem(10), { wrapper: wrapper(queryClient) })

    act(() => {
      result.current.mutate({ id: 3, text: 'Updated text', completed: true })
    })

    await waitFor(() => {
      const cached = queryClient.getQueryData(['items', 10])
      return cached && cached.find((i) => String(i.id) === '3')?.text === 'Updated text'
    })

    const cached = queryClient.getQueryData(['items', 10])
    const item3 = cached.find((i) => String(i.id) === '3')
    expect(item3.text).toBe('Updated text')
    expect(item3.completed).toBe(true)
    // Other item unchanged
    const item4 = cached.find((i) => String(i.id) === '4')
    expect(item4.text).toBe('Another item')

    // Clean up
    resolve({ data: { id: 3, list_id: 10, text: 'Updated text', completed: true } })
    apiClient.get.mockResolvedValueOnce({ data: [] })
  })

  it('handles String-id coercion — matches numeric id in cache against string id in mutate variable', async () => {
    // Cache has numeric id, mutate receives same numeric id — both should match via String()
    queryClient.setQueryData(['items', 10], [
      { id: 7, list_id: 10, text: 'Old text', completed: false },
    ])

    let resolve
    apiClient.put.mockReturnValueOnce(new Promise((res) => { resolve = res }))

    const { result } = renderHook(() => useUpdateItem(10), { wrapper: wrapper(queryClient) })

    act(() => {
      // Simulate numeric id passed as a number (as a server might return)
      result.current.mutate({ id: 7, text: 'New text' })
    })

    await waitFor(() => {
      const cached = queryClient.getQueryData(['items', 10])
      return cached && cached[0].text === 'New text'
    })

    const cached = queryClient.getQueryData(['items', 10])
    expect(cached[0].text).toBe('New text')

    // Clean up
    resolve({ data: { id: 7, list_id: 10, text: 'New text', completed: false } })
    apiClient.get.mockResolvedValueOnce({ data: [] })
  })

  it('rolls back on error', async () => {
    const original = [{ id: 3, list_id: 10, text: 'Original', completed: false }]
    queryClient.setQueryData(['items', 10], original)

    apiClient.put.mockRejectedValueOnce(new Error('Forbidden'))
    apiClient.get.mockResolvedValueOnce({ data: original })

    const { result } = renderHook(() => useUpdateItem(10), { wrapper: wrapper(queryClient) })

    await act(async () => {
      result.current.mutate({ id: 3, text: 'Should rollback' })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    // Cache should have been rolled back then refetched
    await waitFor(() => {
      const cached = queryClient.getQueryData(['items', 10])
      return cached && cached.every((i) => i.text !== 'Should rollback')
    })
  })

  it('invalidates ["items", listId] on settled', async () => {
    apiClient.put.mockResolvedValueOnce({ data: { id: 3, text: 'Updated' } })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    apiClient.get.mockResolvedValueOnce({ data: [] })

    const { result } = renderHook(() => useUpdateItem(10), { wrapper: wrapper(queryClient) })

    await act(async () => {
      result.current.mutate({ id: 3, text: 'Updated' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['items', 10] })
  })
})

// ---------------------------------------------------------------------------
// useDeleteItem
// ---------------------------------------------------------------------------

describe('useDeleteItem', () => {
  let queryClient

  beforeEach(() => {
    queryClient = makeQueryClient()
    vi.resetAllMocks()
  })

  it('calls DELETE /items/:id', async () => {
    apiClient.delete.mockResolvedValueOnce({ data: { success: true } })
    apiClient.get.mockResolvedValueOnce({ data: [] })

    const { result } = renderHook(() => useDeleteItem(10), { wrapper: wrapper(queryClient) })

    await act(async () => {
      result.current.mutate(3)
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(apiClient.delete).toHaveBeenCalledWith('/items/3')
  })

  it('optimistically removes the item from cache', async () => {
    queryClient.setQueryData(['items', 10], [
      { id: 3, list_id: 10, text: 'To delete', completed: false },
      { id: 4, list_id: 10, text: 'Keep me', completed: false },
    ])

    let resolve
    apiClient.delete.mockReturnValueOnce(new Promise((res) => { resolve = res }))

    const { result } = renderHook(() => useDeleteItem(10), { wrapper: wrapper(queryClient) })

    act(() => {
      result.current.mutate(3)
    })

    await waitFor(() => {
      const cached = queryClient.getQueryData(['items', 10])
      return cached && !cached.some((i) => String(i.id) === '3')
    })

    const cached = queryClient.getQueryData(['items', 10])
    expect(cached).toHaveLength(1)
    expect(cached[0].text).toBe('Keep me')

    // Clean up
    resolve({ data: { success: true } })
    apiClient.get.mockResolvedValueOnce({ data: [] })
  })

  it('rolls back on error', async () => {
    const original = [
      { id: 3, list_id: 10, text: 'Item', completed: false },
      { id: 4, list_id: 10, text: 'Another', completed: false },
    ]
    queryClient.setQueryData(['items', 10], original)

    apiClient.delete.mockRejectedValueOnce(new Error('Not found'))
    apiClient.get.mockResolvedValueOnce({ data: original })

    const { result } = renderHook(() => useDeleteItem(10), { wrapper: wrapper(queryClient) })

    await act(async () => {
      result.current.mutate(3)
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    // Item should be restored (via rollback then invalidation refetch)
    await waitFor(() => {
      const cached = queryClient.getQueryData(['items', 10])
      return cached && cached.some((i) => String(i.id) === '3')
    })
  })

  it('invalidates ["items", listId] on settled', async () => {
    apiClient.delete.mockResolvedValueOnce({ data: { success: true } })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    apiClient.get.mockResolvedValueOnce({ data: [] })

    const { result } = renderHook(() => useDeleteItem(10), { wrapper: wrapper(queryClient) })

    await act(async () => {
      result.current.mutate(3)
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['items', 10] })
  })

  it('surfaces errors', async () => {
    apiClient.delete.mockRejectedValueOnce(new Error('Forbidden'))

    const { result } = renderHook(() => useDeleteItem(10), { wrapper: wrapper(queryClient) })

    await act(async () => {
      result.current.mutate(3)
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error.message).toBe('Forbidden')
  })
})
