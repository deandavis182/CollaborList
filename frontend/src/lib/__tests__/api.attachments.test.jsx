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
  useAttachments,
  useUploadAttachment,
  useDeleteAttachment,
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
// useAttachments
// ---------------------------------------------------------------------------

describe('useAttachments', () => {
  let queryClient

  beforeEach(() => {
    queryClient = makeQueryClient()
    vi.resetAllMocks()
  })

  it('GETs /items/:itemId/attachments', async () => {
    apiClient.get.mockResolvedValueOnce({ data: [] })

    const { result } = renderHook(() => useAttachments(10), {
      wrapper: wrapper(queryClient),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(apiClient.get).toHaveBeenCalledWith('/items/10/attachments')
  })

  it('uses key ["attachments", itemId]', async () => {
    const attachments = [{ id: 'att-1', filename: 'photo.jpg', mime_type: 'image/jpeg' }]
    apiClient.get.mockResolvedValueOnce({ data: attachments })

    const { result } = renderHook(() => useAttachments(10), {
      wrapper: wrapper(queryClient),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(attachments)
  })

  it('is disabled when itemId is falsy', () => {
    const { result } = renderHook(() => useAttachments(null), {
      wrapper: wrapper(queryClient),
    })

    expect(result.current.fetchStatus).toBe('idle')
    expect(apiClient.get).not.toHaveBeenCalled()
  })

  it('is disabled when itemId is 0', () => {
    const { result } = renderHook(() => useAttachments(0), {
      wrapper: wrapper(queryClient),
    })

    expect(result.current.fetchStatus).toBe('idle')
  })
})

// ---------------------------------------------------------------------------
// useUploadAttachment
// ---------------------------------------------------------------------------

describe('useUploadAttachment', () => {
  let queryClient

  beforeEach(() => {
    queryClient = makeQueryClient()
    vi.resetAllMocks()
  })

  it('POSTs to /items/:itemId/attachments with a FormData instance', async () => {
    apiClient.post.mockResolvedValueOnce({ data: { id: 'att-1', filename: 'photo.jpg' } })
    apiClient.get.mockResolvedValueOnce({ data: [] })

    const { result } = renderHook(() => useUploadAttachment(10), {
      wrapper: wrapper(queryClient),
    })

    const file = new File(['content'], 'photo.jpg', { type: 'image/jpeg' })

    await act(async () => {
      result.current.mutate(file)
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(apiClient.post).toHaveBeenCalledWith(
      '/items/10/attachments',
      expect.any(FormData)
    )
  })

  it('appends the file under the "file" key in FormData', async () => {
    let capturedFd
    apiClient.post.mockImplementationOnce((url, fd) => {
      capturedFd = fd
      return Promise.resolve({ data: { id: 'att-1' } })
    })
    apiClient.get.mockResolvedValueOnce({ data: [] })

    const { result } = renderHook(() => useUploadAttachment(10), {
      wrapper: wrapper(queryClient),
    })

    const file = new File(['content'], 'photo.jpg', { type: 'image/jpeg' })

    await act(async () => {
      result.current.mutate(file)
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(capturedFd).toBeInstanceOf(FormData)
    expect(capturedFd.get('file')).toBe(file)
  })

  it('invalidates ["attachments", itemId] on settled (success)', async () => {
    apiClient.post.mockResolvedValueOnce({ data: { id: 'att-1' } })
    apiClient.get.mockResolvedValueOnce({ data: [] })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useUploadAttachment(10), {
      wrapper: wrapper(queryClient),
    })

    const file = new File(['content'], 'photo.jpg', { type: 'image/jpeg' })

    await act(async () => {
      result.current.mutate(file)
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['attachments', 10] })
  })

  it('invalidates ["attachments", itemId] on settled even when mutation fails', async () => {
    apiClient.post.mockRejectedValueOnce(new Error('Upload failed'))
    apiClient.get.mockResolvedValueOnce({ data: [] })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useUploadAttachment(10), {
      wrapper: wrapper(queryClient),
    })

    const file = new File(['content'], 'photo.jpg', { type: 'image/jpeg' })

    await act(async () => {
      result.current.mutate(file)
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['attachments', 10] })
  })
})

// ---------------------------------------------------------------------------
// useDeleteAttachment
// ---------------------------------------------------------------------------

describe('useDeleteAttachment', () => {
  let queryClient

  beforeEach(() => {
    queryClient = makeQueryClient()
    vi.resetAllMocks()
  })

  it('DELETEs /attachments/:attachmentId', async () => {
    apiClient.delete.mockResolvedValueOnce({ data: { success: true } })
    apiClient.get.mockResolvedValueOnce({ data: [] })

    const { result } = renderHook(() => useDeleteAttachment(10), {
      wrapper: wrapper(queryClient),
    })

    await act(async () => {
      result.current.mutate('att-1')
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(apiClient.delete).toHaveBeenCalledWith('/attachments/att-1')
  })

  it('invalidates ["attachments", itemId] on settled (success)', async () => {
    apiClient.delete.mockResolvedValueOnce({ data: {} })
    apiClient.get.mockResolvedValueOnce({ data: [] })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useDeleteAttachment(10), {
      wrapper: wrapper(queryClient),
    })

    await act(async () => {
      result.current.mutate('att-1')
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['attachments', 10] })
  })

  it('invalidates ["attachments", itemId] on settled even when mutation fails', async () => {
    apiClient.delete.mockRejectedValueOnce(new Error('Not found'))
    apiClient.get.mockResolvedValueOnce({ data: [] })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useDeleteAttachment(10), {
      wrapper: wrapper(queryClient),
    })

    await act(async () => {
      result.current.mutate('att-1')
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['attachments', 10] })
  })
})
