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
  useVapidKey,
  usePushSubscribe,
  usePushUnsubscribe,
  useNotificationPrefs,
  useUpdateNotificationPrefs,
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
// useVapidKey
// ---------------------------------------------------------------------------

describe('useVapidKey', () => {
  let queryClient

  beforeEach(() => {
    queryClient = makeQueryClient()
    vi.resetAllMocks()
  })

  it('GETs /push/vapid-public-key and returns publicKey', async () => {
    apiClient.get.mockResolvedValueOnce({ data: { publicKey: 'BFakeVapidKey123' } })

    const { result } = renderHook(() => useVapidKey(), {
      wrapper: wrapper(queryClient),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(apiClient.get).toHaveBeenCalledWith('/push/vapid-public-key')
    expect(result.current.data).toBe('BFakeVapidKey123')
  })

  it('uses key ["vapidKey"]', async () => {
    apiClient.get.mockResolvedValueOnce({ data: { publicKey: 'BFakeVapidKey123' } })

    const { result } = renderHook(() => useVapidKey(), {
      wrapper: wrapper(queryClient),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    // Verify the cached value is accessible via the correct key
    expect(queryClient.getQueryData(['vapidKey'])).toBe('BFakeVapidKey123')
  })
})

// ---------------------------------------------------------------------------
// usePushSubscribe
// ---------------------------------------------------------------------------

describe('usePushSubscribe', () => {
  let queryClient

  beforeEach(() => {
    queryClient = makeQueryClient()
    vi.resetAllMocks()
  })

  it('POSTs to /push/subscribe with { subscription }', async () => {
    const subscription = { endpoint: 'https://push.example.com/sub', keys: { p256dh: 'abc', auth: 'def' } }
    apiClient.post.mockResolvedValueOnce({ data: { ok: true } })

    const { result } = renderHook(() => usePushSubscribe(), {
      wrapper: wrapper(queryClient),
    })

    await act(async () => {
      result.current.mutate(subscription)
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(apiClient.post).toHaveBeenCalledWith('/push/subscribe', { subscription })
  })
})

// ---------------------------------------------------------------------------
// usePushUnsubscribe
// ---------------------------------------------------------------------------

describe('usePushUnsubscribe', () => {
  let queryClient

  beforeEach(() => {
    queryClient = makeQueryClient()
    vi.resetAllMocks()
  })

  it('POSTs to /push/unsubscribe with { endpoint }', async () => {
    const endpoint = 'https://push.example.com/sub'
    apiClient.post.mockResolvedValueOnce({ data: { ok: true } })

    const { result } = renderHook(() => usePushUnsubscribe(), {
      wrapper: wrapper(queryClient),
    })

    await act(async () => {
      result.current.mutate(endpoint)
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(apiClient.post).toHaveBeenCalledWith('/push/unsubscribe', { endpoint })
  })
})

// ---------------------------------------------------------------------------
// useNotificationPrefs
// ---------------------------------------------------------------------------

describe('useNotificationPrefs', () => {
  let queryClient

  beforeEach(() => {
    queryClient = makeQueryClient()
    vi.resetAllMocks()
  })

  it('GETs /notification-prefs', async () => {
    const prefs = { item_assigned: true, due_date_reminder: false }
    apiClient.get.mockResolvedValueOnce({ data: prefs })

    const { result } = renderHook(() => useNotificationPrefs(), {
      wrapper: wrapper(queryClient),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(apiClient.get).toHaveBeenCalledWith('/notification-prefs')
    expect(result.current.data).toEqual(prefs)
  })

  it('uses key ["notificationPrefs"]', async () => {
    const prefs = { item_assigned: true }
    apiClient.get.mockResolvedValueOnce({ data: prefs })

    const { result } = renderHook(() => useNotificationPrefs(), {
      wrapper: wrapper(queryClient),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(queryClient.getQueryData(['notificationPrefs'])).toEqual(prefs)
  })
})

// ---------------------------------------------------------------------------
// useUpdateNotificationPrefs
// ---------------------------------------------------------------------------

describe('useUpdateNotificationPrefs', () => {
  let queryClient

  beforeEach(() => {
    queryClient = makeQueryClient()
    vi.resetAllMocks()
  })

  it('PUTs to /notification-prefs with partial prefs', async () => {
    const partial = { item_assigned: false }
    const updated = { item_assigned: false, due_date_reminder: true }
    apiClient.put.mockResolvedValueOnce({ data: updated })

    const { result } = renderHook(() => useUpdateNotificationPrefs(), {
      wrapper: wrapper(queryClient),
    })

    await act(async () => {
      result.current.mutate(partial)
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(apiClient.put).toHaveBeenCalledWith('/notification-prefs', partial)
  })

  it('sets ["notificationPrefs"] cache with returned data on success', async () => {
    const updated = { item_assigned: false, due_date_reminder: true }
    apiClient.put.mockResolvedValueOnce({ data: updated })

    const { result } = renderHook(() => useUpdateNotificationPrefs(), {
      wrapper: wrapper(queryClient),
    })

    await act(async () => {
      result.current.mutate({ item_assigned: false })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(queryClient.getQueryData(['notificationPrefs'])).toEqual(updated)
  })
})
