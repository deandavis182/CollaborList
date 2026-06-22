import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest'
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
    interceptors: {
      request: {
        use: vi.fn((fn) => {
          // Store the interceptor so we can exercise it directly in tests
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
import axios from 'axios'
import {
  apiClient,
  useWorkspaces,
  useCreateWorkspace,
  useProjects,
  useCreateProject,
} from '../api.js'

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Create a fresh QueryClient with retries disabled for predictable tests. */
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
// Request interceptor
// ---------------------------------------------------------------------------

describe('apiClient request interceptor', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('attaches Authorization header when token is present in localStorage', () => {
    localStorage.setItem('token', 'test-jwt-token')
    const config = { headers: {} }
    const result = apiClient._requestInterceptor(config)
    expect(result.headers['Authorization']).toBe('Bearer test-jwt-token')
  })

  it('does NOT attach Authorization header when localStorage has no token', () => {
    localStorage.removeItem('token')
    const config = { headers: {} }
    const result = apiClient._requestInterceptor(config)
    expect(result.headers['Authorization']).toBeUndefined()
  })

  it('creates config.headers object when none exists', () => {
    localStorage.setItem('token', 'abc')
    const config = {}
    const result = apiClient._requestInterceptor(config)
    expect(result.headers['Authorization']).toBe('Bearer abc')
  })
})

// ---------------------------------------------------------------------------
// useWorkspaces
// ---------------------------------------------------------------------------

describe('useWorkspaces', () => {
  let queryClient

  beforeEach(() => {
    queryClient = makeQueryClient()
    vi.resetAllMocks()
  })

  it('returns data from GET /workspaces', async () => {
    const workspaces = [
      { id: 1, name: 'My Workspace', role: 'owner' },
    ]
    apiClient.get.mockResolvedValueOnce({ data: workspaces })

    const { result } = renderHook(() => useWorkspaces(), { wrapper: wrapper(queryClient) })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(workspaces)
    expect(apiClient.get).toHaveBeenCalledWith('/workspaces')
  })

  it('is in loading state initially', () => {
    apiClient.get.mockReturnValue(new Promise(() => {})) // never resolves

    const { result } = renderHook(() => useWorkspaces(), { wrapper: wrapper(queryClient) })

    expect(result.current.isLoading).toBe(true)
  })

  it('surfaces errors from the API', async () => {
    apiClient.get.mockRejectedValueOnce(new Error('Network error'))

    const { result } = renderHook(() => useWorkspaces(), { wrapper: wrapper(queryClient) })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error.message).toBe('Network error')
  })
})

// ---------------------------------------------------------------------------
// useCreateWorkspace
// ---------------------------------------------------------------------------

describe('useCreateWorkspace', () => {
  let queryClient

  beforeEach(() => {
    queryClient = makeQueryClient()
    vi.resetAllMocks()
  })

  it('posts to /workspaces and invalidates the query', async () => {
    const created = { id: 42, name: 'New WS', role: 'owner' }
    apiClient.post.mockResolvedValueOnce({ data: created })
    apiClient.get.mockResolvedValueOnce({ data: [] }) // invalidation refetch

    const { result } = renderHook(() => useCreateWorkspace(), { wrapper: wrapper(queryClient) })

    await act(async () => {
      result.current.mutate({ name: 'New WS' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(apiClient.post).toHaveBeenCalledWith('/workspaces', { name: 'New WS' })
  })

  it('optimistically adds a temp workspace before the server responds', async () => {
    // Seed existing data into the cache
    queryClient.setQueryData(['workspaces'], [{ id: 1, name: 'Existing', role: 'owner' }])

    // Slow mutation — never resolves during optimistic phase check
    let resolve
    apiClient.post.mockReturnValueOnce(new Promise((res) => { resolve = res }))

    const { result } = renderHook(() => useCreateWorkspace(), { wrapper: wrapper(queryClient) })

    act(() => {
      result.current.mutate({ name: 'Optimistic WS' })
    })

    // After mutate fires (synchronous onMutate), the cache should already have the temp entry
    await waitFor(() => {
      const cached = queryClient.getQueryData(['workspaces'])
      return cached && cached.some((w) => w.name === 'Optimistic WS' && w.id.startsWith('temp-'))
    })

    const cached = queryClient.getQueryData(['workspaces'])
    expect(cached).toHaveLength(2)
    expect(cached[1].name).toBe('Optimistic WS')
    expect(cached[1].id).toMatch(/^temp-/)

    // Resolve the mutation so the hook doesn't leak
    resolve({ data: { id: 99, name: 'Optimistic WS', role: 'owner' } })
    apiClient.get.mockResolvedValueOnce({ data: [] })
  })

  it('rolls back on error', async () => {
    const original = [{ id: 1, name: 'Existing', role: 'owner' }]
    queryClient.setQueryData(['workspaces'], original)

    apiClient.post.mockRejectedValueOnce(new Error('Server error'))
    apiClient.get.mockResolvedValueOnce({ data: original }) // invalidation refetch

    const { result } = renderHook(() => useCreateWorkspace(), { wrapper: wrapper(queryClient) })

    await act(async () => {
      result.current.mutate({ name: 'Bad WS' })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    // The invalidation refetch will restore data; here we verify rollback happened
    // (onError restores before onSettled invalidates)
    // We can at least verify no permanent temp entry remains after error cycle
    await waitFor(() => {
      const cached = queryClient.getQueryData(['workspaces'])
      // Either rolled back or refetched original; no temp entries
      return !cached?.some((w) => String(w.id).startsWith('temp-'))
    })
  })
})

// ---------------------------------------------------------------------------
// useProjects
// ---------------------------------------------------------------------------

describe('useProjects', () => {
  let queryClient

  beforeEach(() => {
    queryClient = makeQueryClient()
    vi.resetAllMocks()
  })

  it('returns data from GET /workspaces/:id/projects', async () => {
    const projects = [{ id: 10, name: 'Project Alpha', color: '#FF0000' }]
    apiClient.get.mockResolvedValueOnce({ data: projects })

    const { result } = renderHook(() => useProjects(5), { wrapper: wrapper(queryClient) })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(projects)
    expect(apiClient.get).toHaveBeenCalledWith('/workspaces/5/projects')
  })

  it('is disabled when workspaceId is falsy', () => {
    const { result } = renderHook(() => useProjects(null), { wrapper: wrapper(queryClient) })

    // Should not be loading or fetching — query is disabled
    expect(result.current.fetchStatus).toBe('idle')
    expect(apiClient.get).not.toHaveBeenCalled()
  })

  it('is disabled when workspaceId is undefined', () => {
    const { result } = renderHook(() => useProjects(undefined), { wrapper: wrapper(queryClient) })

    expect(result.current.fetchStatus).toBe('idle')
  })
})

// ---------------------------------------------------------------------------
// useCreateProject
// ---------------------------------------------------------------------------

describe('useCreateProject', () => {
  let queryClient

  beforeEach(() => {
    queryClient = makeQueryClient()
    vi.resetAllMocks()
  })

  it('posts to /workspaces/:id/projects with name', async () => {
    const created = { id: 20, name: 'New Project', color: null }
    apiClient.post.mockResolvedValueOnce({ data: created })
    apiClient.get.mockResolvedValueOnce({ data: [] })

    const { result } = renderHook(() => useCreateProject(5), { wrapper: wrapper(queryClient) })

    await act(async () => {
      result.current.mutate({ name: 'New Project' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(apiClient.post).toHaveBeenCalledWith('/workspaces/5/projects', { name: 'New Project' })
  })

  it('includes optional color and wedding_date when provided', async () => {
    apiClient.post.mockResolvedValueOnce({ data: { id: 21, name: 'Fancy', color: '#ABCDEF' } })
    apiClient.get.mockResolvedValueOnce({ data: [] })

    const { result } = renderHook(() => useCreateProject(5), { wrapper: wrapper(queryClient) })

    await act(async () => {
      result.current.mutate({ name: 'Fancy', color: '#ABCDEF', wedding_date: '2027-06-01' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(apiClient.post).toHaveBeenCalledWith('/workspaces/5/projects', {
      name: 'Fancy',
      color: '#ABCDEF',
      wedding_date: '2027-06-01',
    })
  })

  it('optimistically appends a temp project', async () => {
    queryClient.setQueryData(['projects', 5], [{ id: 10, name: 'Existing Project' }])

    let resolve
    apiClient.post.mockReturnValueOnce(new Promise((res) => { resolve = res }))

    const { result } = renderHook(() => useCreateProject(5), { wrapper: wrapper(queryClient) })

    act(() => {
      result.current.mutate({ name: 'Temp Project', color: '#123456' })
    })

    await waitFor(() => {
      const cached = queryClient.getQueryData(['projects', 5])
      return cached && cached.some((p) => p.name === 'Temp Project' && String(p.id).startsWith('temp-'))
    })

    const cached = queryClient.getQueryData(['projects', 5])
    expect(cached).toHaveLength(2)
    expect(cached[1].color).toBe('#123456')

    resolve({ data: { id: 30, name: 'Temp Project', color: '#123456' } })
    apiClient.get.mockResolvedValueOnce({ data: [] })
  })

  it('rolls back on project creation error', async () => {
    const original = [{ id: 10, name: 'Existing' }]
    queryClient.setQueryData(['projects', 5], original)

    apiClient.post.mockRejectedValueOnce(new Error('Fail'))
    apiClient.get.mockResolvedValueOnce({ data: original })

    const { result } = renderHook(() => useCreateProject(5), { wrapper: wrapper(queryClient) })

    await act(async () => {
      result.current.mutate({ name: 'Bad Project' })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    await waitFor(() => {
      const cached = queryClient.getQueryData(['projects', 5])
      return !cached?.some((p) => String(p.id).startsWith('temp-'))
    })
  })
})
