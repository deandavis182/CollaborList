import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// ---------------------------------------------------------------------------
// Mock axios module before importing api.js
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
import { apiClient, useAddItemTag, useRemoveItemTag } from '../api.js'

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
// useAddItemTag
// ---------------------------------------------------------------------------

describe('useAddItemTag', () => {
  let queryClient

  beforeEach(() => {
    queryClient = makeQueryClient()
    vi.resetAllMocks()
  })

  it('POSTs { tag_id } to /items/:itemId/tags', async () => {
    apiClient.post.mockResolvedValueOnce({ data: { id: 'item-tag-1' } })
    apiClient.get.mockResolvedValueOnce({ data: [] })

    const { result } = renderHook(() => useAddItemTag('list-10'), {
      wrapper: wrapper(queryClient),
    })

    await act(async () => {
      result.current.mutate({ itemId: 42, tag_id: 7 })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(apiClient.post).toHaveBeenCalledWith('/items/42/tags', { tag_id: 7 })
  })

  it('uses String() coercion for itemId in URL', async () => {
    apiClient.post.mockResolvedValueOnce({ data: {} })
    apiClient.get.mockResolvedValueOnce({ data: [] })

    const { result } = renderHook(() => useAddItemTag('list-10'), {
      wrapper: wrapper(queryClient),
    })

    await act(async () => {
      result.current.mutate({ itemId: 99, tag_id: 3 })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(apiClient.post).toHaveBeenCalledWith('/items/99/tags', { tag_id: 3 })
  })

  it('invalidates ["items", listId] on settled (success)', async () => {
    apiClient.post.mockResolvedValueOnce({ data: {} })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    apiClient.get.mockResolvedValueOnce({ data: [] })

    const { result } = renderHook(() => useAddItemTag('list-10'), {
      wrapper: wrapper(queryClient),
    })

    await act(async () => {
      result.current.mutate({ itemId: 42, tag_id: 7 })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['items', 'list-10'] })
  })

  it('invalidates ["items", listId] on settled even when mutation fails', async () => {
    apiClient.post.mockRejectedValueOnce(new Error('Server error'))
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    apiClient.get.mockResolvedValueOnce({ data: [] })

    const { result } = renderHook(() => useAddItemTag('list-10'), {
      wrapper: wrapper(queryClient),
    })

    await act(async () => {
      result.current.mutate({ itemId: 42, tag_id: 7 })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['items', 'list-10'] })
  })
})

// ---------------------------------------------------------------------------
// useRemoveItemTag
// ---------------------------------------------------------------------------

describe('useRemoveItemTag', () => {
  let queryClient

  beforeEach(() => {
    queryClient = makeQueryClient()
    vi.resetAllMocks()
  })

  it('DELETEs /items/:itemId/tags/:tagId', async () => {
    apiClient.delete.mockResolvedValueOnce({ data: { success: true } })
    apiClient.get.mockResolvedValueOnce({ data: [] })

    const { result } = renderHook(() => useRemoveItemTag('list-10'), {
      wrapper: wrapper(queryClient),
    })

    await act(async () => {
      result.current.mutate({ itemId: 42, tagId: 7 })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(apiClient.delete).toHaveBeenCalledWith('/items/42/tags/7')
  })

  it('uses String() coercion for both itemId and tagId in URL', async () => {
    apiClient.delete.mockResolvedValueOnce({ data: {} })
    apiClient.get.mockResolvedValueOnce({ data: [] })

    const { result } = renderHook(() => useRemoveItemTag('list-10'), {
      wrapper: wrapper(queryClient),
    })

    await act(async () => {
      result.current.mutate({ itemId: 5, tagId: 3 })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(apiClient.delete).toHaveBeenCalledWith('/items/5/tags/3')
  })

  it('invalidates ["items", listId] on settled (success)', async () => {
    apiClient.delete.mockResolvedValueOnce({ data: {} })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    apiClient.get.mockResolvedValueOnce({ data: [] })

    const { result } = renderHook(() => useRemoveItemTag('list-10'), {
      wrapper: wrapper(queryClient),
    })

    await act(async () => {
      result.current.mutate({ itemId: 42, tagId: 7 })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['items', 'list-10'] })
  })

  it('invalidates ["items", listId] on settled even when mutation fails', async () => {
    apiClient.delete.mockRejectedValueOnce(new Error('Not found'))
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    apiClient.get.mockResolvedValueOnce({ data: [] })

    const { result } = renderHook(() => useRemoveItemTag('list-10'), {
      wrapper: wrapper(queryClient),
    })

    await act(async () => {
      result.current.mutate({ itemId: 42, tagId: 7 })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['items', 'list-10'] })
  })
})
