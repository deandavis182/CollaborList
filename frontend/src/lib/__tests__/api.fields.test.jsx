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
import {
  apiClient,
  useFieldDefs,
  useCreateFieldDef,
  useUpdateFieldDef,
  useDeleteFieldDef,
  useApplyFieldPreset,
  useSetItemField,
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
// useFieldDefs
// ---------------------------------------------------------------------------

describe('useFieldDefs', () => {
  let queryClient

  beforeEach(() => {
    queryClient = makeQueryClient()
    vi.resetAllMocks()
  })

  it('GETs /lists/:listId/field-defs', async () => {
    apiClient.get.mockResolvedValueOnce({ data: [] })

    const { result } = renderHook(() => useFieldDefs(10), {
      wrapper: wrapper(queryClient),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(apiClient.get).toHaveBeenCalledWith('/lists/10/field-defs')
  })

  it('uses key ["fieldDefs", listId]', async () => {
    apiClient.get.mockResolvedValueOnce({ data: [{ id: 1, key: 'budget' }] })

    const { result } = renderHook(() => useFieldDefs(10), {
      wrapper: wrapper(queryClient),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([{ id: 1, key: 'budget' }])
  })

  it('is disabled when listId is falsy', () => {
    const { result } = renderHook(() => useFieldDefs(null), {
      wrapper: wrapper(queryClient),
    })

    // Should not fetch — status is 'pending' and fetchStatus is 'idle'
    expect(result.current.fetchStatus).toBe('idle')
    expect(apiClient.get).not.toHaveBeenCalled()
  })

  it('is disabled when listId is 0', () => {
    const { result } = renderHook(() => useFieldDefs(0), {
      wrapper: wrapper(queryClient),
    })

    expect(result.current.fetchStatus).toBe('idle')
  })
})

// ---------------------------------------------------------------------------
// useCreateFieldDef
// ---------------------------------------------------------------------------

describe('useCreateFieldDef', () => {
  let queryClient

  beforeEach(() => {
    queryClient = makeQueryClient()
    vi.resetAllMocks()
  })

  it('POSTs to /lists/:listId/field-defs with correct body', async () => {
    apiClient.post.mockResolvedValueOnce({ data: { id: 1, key: 'budget', type: 'number' } })
    apiClient.get.mockResolvedValueOnce({ data: [] })

    const { result } = renderHook(() => useCreateFieldDef(10), {
      wrapper: wrapper(queryClient),
    })

    await act(async () => {
      result.current.mutate({ key: 'budget', type: 'number', label: 'Budget', config: {}, position: 0 })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(apiClient.post).toHaveBeenCalledWith('/lists/10/field-defs', {
      key: 'budget',
      type: 'number',
      label: 'Budget',
      config: {},
      position: 0,
    })
  })

  it('invalidates ["fieldDefs", listId] on settled (success)', async () => {
    apiClient.post.mockResolvedValueOnce({ data: { id: 1 } })
    apiClient.get.mockResolvedValueOnce({ data: [] })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useCreateFieldDef(10), {
      wrapper: wrapper(queryClient),
    })

    await act(async () => {
      result.current.mutate({ key: 'budget', type: 'number', label: 'Budget', config: {}, position: 0 })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['fieldDefs', 10] })
  })

  it('invalidates ["fieldDefs", listId] on settled even when mutation fails', async () => {
    apiClient.post.mockRejectedValueOnce(new Error('Server error'))
    apiClient.get.mockResolvedValueOnce({ data: [] })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useCreateFieldDef(10), {
      wrapper: wrapper(queryClient),
    })

    await act(async () => {
      result.current.mutate({ key: 'budget', type: 'number', label: 'Budget', config: {}, position: 0 })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['fieldDefs', 10] })
  })
})

// ---------------------------------------------------------------------------
// useUpdateFieldDef
// ---------------------------------------------------------------------------

describe('useUpdateFieldDef', () => {
  let queryClient

  beforeEach(() => {
    queryClient = makeQueryClient()
    vi.resetAllMocks()
  })

  it('PUTs to /field-defs/:id with remaining fields', async () => {
    apiClient.put.mockResolvedValueOnce({ data: { id: 5, label: 'Updated' } })
    apiClient.get.mockResolvedValueOnce({ data: [] })

    const { result } = renderHook(() => useUpdateFieldDef(10), {
      wrapper: wrapper(queryClient),
    })

    await act(async () => {
      result.current.mutate({ id: 5, label: 'Updated', position: 1 })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(apiClient.put).toHaveBeenCalledWith('/field-defs/5', { label: 'Updated', position: 1 })
  })

  it('invalidates ["fieldDefs", listId] on settled', async () => {
    apiClient.put.mockResolvedValueOnce({ data: { id: 5 } })
    apiClient.get.mockResolvedValueOnce({ data: [] })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useUpdateFieldDef(10), {
      wrapper: wrapper(queryClient),
    })

    await act(async () => {
      result.current.mutate({ id: 5, label: 'Updated' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['fieldDefs', 10] })
  })

  it('invalidates ["fieldDefs", listId] on settled even when mutation fails', async () => {
    apiClient.put.mockRejectedValueOnce(new Error('Not found'))
    apiClient.get.mockResolvedValueOnce({ data: [] })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useUpdateFieldDef(10), {
      wrapper: wrapper(queryClient),
    })

    await act(async () => {
      result.current.mutate({ id: 5, label: 'Updated' })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['fieldDefs', 10] })
  })
})

// ---------------------------------------------------------------------------
// useDeleteFieldDef
// ---------------------------------------------------------------------------

describe('useDeleteFieldDef', () => {
  let queryClient

  beforeEach(() => {
    queryClient = makeQueryClient()
    vi.resetAllMocks()
  })

  it('DELETEs /field-defs/:id', async () => {
    apiClient.delete.mockResolvedValueOnce({ data: { success: true } })
    apiClient.get.mockResolvedValueOnce({ data: [] })

    const { result } = renderHook(() => useDeleteFieldDef(10), {
      wrapper: wrapper(queryClient),
    })

    await act(async () => {
      result.current.mutate(5)
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(apiClient.delete).toHaveBeenCalledWith('/field-defs/5')
  })

  it('invalidates ["fieldDefs", listId] on settled', async () => {
    apiClient.delete.mockResolvedValueOnce({ data: {} })
    apiClient.get.mockResolvedValueOnce({ data: [] })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useDeleteFieldDef(10), {
      wrapper: wrapper(queryClient),
    })

    await act(async () => {
      result.current.mutate(5)
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['fieldDefs', 10] })
  })

  it('invalidates ["fieldDefs", listId] on settled even when mutation fails', async () => {
    apiClient.delete.mockRejectedValueOnce(new Error('Not found'))
    apiClient.get.mockResolvedValueOnce({ data: [] })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useDeleteFieldDef(10), {
      wrapper: wrapper(queryClient),
    })

    await act(async () => {
      result.current.mutate(5)
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['fieldDefs', 10] })
  })
})

// ---------------------------------------------------------------------------
// useApplyFieldPreset
// ---------------------------------------------------------------------------

describe('useApplyFieldPreset', () => {
  let queryClient

  beforeEach(() => {
    queryClient = makeQueryClient()
    vi.resetAllMocks()
  })

  it('POSTs to /lists/:listId/field-presets with { preset }', async () => {
    apiClient.post.mockResolvedValueOnce({ data: [] })
    apiClient.get.mockResolvedValueOnce({ data: [] })

    const { result } = renderHook(() => useApplyFieldPreset(10), {
      wrapper: wrapper(queryClient),
    })

    await act(async () => {
      result.current.mutate('wedding')
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(apiClient.post).toHaveBeenCalledWith('/lists/10/field-presets', { preset: 'wedding' })
  })

  it('invalidates ["fieldDefs", listId] on settled', async () => {
    apiClient.post.mockResolvedValueOnce({ data: [] })
    apiClient.get.mockResolvedValueOnce({ data: [] })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useApplyFieldPreset(10), {
      wrapper: wrapper(queryClient),
    })

    await act(async () => {
      result.current.mutate('wedding')
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['fieldDefs', 10] })
  })

  it('invalidates ["fieldDefs", listId] on settled even when mutation fails', async () => {
    apiClient.post.mockRejectedValueOnce(new Error('Invalid preset'))
    apiClient.get.mockResolvedValueOnce({ data: [] })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useApplyFieldPreset(10), {
      wrapper: wrapper(queryClient),
    })

    await act(async () => {
      result.current.mutate('invalid-preset')
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['fieldDefs', 10] })
  })
})

// ---------------------------------------------------------------------------
// useSetItemField
// ---------------------------------------------------------------------------

describe('useSetItemField', () => {
  let queryClient

  beforeEach(() => {
    queryClient = makeQueryClient()
    vi.resetAllMocks()
  })

  it('PUTs to /items/:itemId/fields with { key, type, value }', async () => {
    apiClient.put.mockResolvedValueOnce({ data: { id: 42, fields: { budget: 5000 } } })
    apiClient.get.mockResolvedValueOnce({ data: [] })

    const { result } = renderHook(() => useSetItemField(10), {
      wrapper: wrapper(queryClient),
    })

    await act(async () => {
      result.current.mutate({ itemId: 42, key: 'budget', type: 'number', value: 5000 })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(apiClient.put).toHaveBeenCalledWith('/items/42/fields', {
      key: 'budget',
      type: 'number',
      value: 5000,
    })
  })

  it('uses String() coercion for itemId in URL', async () => {
    apiClient.put.mockResolvedValueOnce({ data: {} })
    apiClient.get.mockResolvedValueOnce({ data: [] })

    const { result } = renderHook(() => useSetItemField(10), {
      wrapper: wrapper(queryClient),
    })

    await act(async () => {
      result.current.mutate({ itemId: 99, key: 'status', type: 'select', value: 'active' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(apiClient.put).toHaveBeenCalledWith('/items/99/fields', expect.any(Object))
  })

  it('invalidates ["items", listId] on settled', async () => {
    apiClient.put.mockResolvedValueOnce({ data: {} })
    apiClient.get.mockResolvedValueOnce({ data: [] })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useSetItemField(10), {
      wrapper: wrapper(queryClient),
    })

    await act(async () => {
      result.current.mutate({ itemId: 42, key: 'budget', type: 'number', value: 1000 })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['items', 10] })
  })

  it('invalidates ["projectItems"] on settled', async () => {
    apiClient.put.mockResolvedValueOnce({ data: {} })
    apiClient.get.mockResolvedValueOnce({ data: [] })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useSetItemField(10), {
      wrapper: wrapper(queryClient),
    })

    await act(async () => {
      result.current.mutate({ itemId: 42, key: 'budget', type: 'number', value: 1000 })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['projectItems'] })
  })

  it('invalidates ["items", listId] and ["projectItems"] on settled even when mutation fails', async () => {
    apiClient.put.mockRejectedValueOnce(new Error('Server error'))
    apiClient.get.mockResolvedValueOnce({ data: [] })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useSetItemField(10), {
      wrapper: wrapper(queryClient),
    })

    await act(async () => {
      result.current.mutate({ itemId: 42, key: 'budget', type: 'number', value: 1000 })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['items', 10] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['projectItems'] })
  })
})
