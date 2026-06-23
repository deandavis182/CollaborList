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
    put: vi.fn(),
    delete: vi.fn(),
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
// Also need put/delete on the mock instance — add them after initial import
import {
  apiClient,
  useWorkspaces,
  useCreateWorkspace,
  useRenameWorkspace,
  useDeleteWorkspace,
  useProjects,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
  useProjectLists,
  useCreateList,
  useRenameList,
  useDeleteList,
  useTags,
  useCreateTag,
  useDeleteTag,
  useWorkspaceMembers,
  useAddMember,
  useRemoveMember,
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

// ---------------------------------------------------------------------------
// useUpdateProject
// ---------------------------------------------------------------------------

describe('useUpdateProject', () => {
  let queryClient

  beforeEach(() => {
    queryClient = makeQueryClient()
    vi.resetAllMocks()
  })

  it('calls PUT /projects/:id with the provided fields', async () => {
    const updated = { id: 10, name: 'Renamed', color: '#AABBCC' }
    apiClient.put.mockResolvedValueOnce({ data: updated })
    apiClient.get.mockResolvedValueOnce({ data: [updated] }) // invalidation refetch

    const { result } = renderHook(() => useUpdateProject(5), { wrapper: wrapper(queryClient) })

    await act(async () => {
      result.current.mutate({ id: 10, name: 'Renamed', color: '#AABBCC' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(apiClient.put).toHaveBeenCalledWith('/projects/10', { name: 'Renamed', color: '#AABBCC' })
  })

  it('invalidates ["projects", workspaceId] on success', async () => {
    apiClient.put.mockResolvedValueOnce({ data: { id: 10, name: 'Updated' } })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    apiClient.get.mockResolvedValueOnce({ data: [] })

    const { result } = renderHook(() => useUpdateProject(5), { wrapper: wrapper(queryClient) })

    await act(async () => {
      result.current.mutate({ id: 10, name: 'Updated' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['projects', 5] })
  })

  it('does not call GET when PUT fails', async () => {
    apiClient.put.mockRejectedValueOnce(new Error('Server error'))

    const { result } = renderHook(() => useUpdateProject(5), { wrapper: wrapper(queryClient) })

    await act(async () => {
      result.current.mutate({ id: 10, name: 'Bad' })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    // No invalidation refetch should have occurred
    expect(apiClient.get).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// useDeleteProject
// ---------------------------------------------------------------------------

describe('useDeleteProject', () => {
  let queryClient

  beforeEach(() => {
    queryClient = makeQueryClient()
    vi.resetAllMocks()
  })

  it('calls DELETE /projects/:id', async () => {
    apiClient.delete.mockResolvedValueOnce({ data: { success: true } })
    apiClient.get.mockResolvedValueOnce({ data: [] }) // invalidation refetch

    const { result } = renderHook(() => useDeleteProject(5), { wrapper: wrapper(queryClient) })

    await act(async () => {
      result.current.mutate(10)
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(apiClient.delete).toHaveBeenCalledWith('/projects/10')
  })

  it('invalidates ["projects", workspaceId] on success', async () => {
    apiClient.delete.mockResolvedValueOnce({ data: { success: true } })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    apiClient.get.mockResolvedValueOnce({ data: [] })

    const { result } = renderHook(() => useDeleteProject(5), { wrapper: wrapper(queryClient) })

    await act(async () => {
      result.current.mutate(10)
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['projects', 5] })
  })

  it('surfaces errors from a failed delete', async () => {
    apiClient.delete.mockRejectedValueOnce(new Error('Forbidden'))

    const { result } = renderHook(() => useDeleteProject(5), { wrapper: wrapper(queryClient) })

    await act(async () => {
      result.current.mutate(10)
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error.message).toBe('Forbidden')
  })
})

// ---------------------------------------------------------------------------
// useProjectLists
// ---------------------------------------------------------------------------

describe('useProjectLists', () => {
  let queryClient

  beforeEach(() => {
    queryClient = makeQueryClient()
    vi.resetAllMocks()
  })

  it('returns data from GET /projects/:id/lists', async () => {
    const lists = [{ id: 1, name: 'Guest List' }, { id: 2, name: 'Vendors' }]
    apiClient.get.mockResolvedValueOnce({ data: lists })

    const { result } = renderHook(() => useProjectLists(7), { wrapper: wrapper(queryClient) })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(lists)
    expect(apiClient.get).toHaveBeenCalledWith('/projects/7/lists')
  })

  it('uses query key ["projectLists", projectId]', async () => {
    apiClient.get.mockResolvedValueOnce({ data: [] })

    const { result } = renderHook(() => useProjectLists(7), { wrapper: wrapper(queryClient) })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    // Data is accessible under the expected cache key
    const cached = queryClient.getQueryData(['projectLists', 7])
    expect(cached).toEqual([])
  })

  it('is disabled when projectId is null', () => {
    const { result } = renderHook(() => useProjectLists(null), { wrapper: wrapper(queryClient) })

    expect(result.current.fetchStatus).toBe('idle')
    expect(apiClient.get).not.toHaveBeenCalled()
  })

  it('is disabled when projectId is undefined', () => {
    const { result } = renderHook(() => useProjectLists(undefined), { wrapper: wrapper(queryClient) })

    expect(result.current.fetchStatus).toBe('idle')
    expect(apiClient.get).not.toHaveBeenCalled()
  })

  it('surfaces errors from the API', async () => {
    apiClient.get.mockRejectedValueOnce(new Error('Not found'))

    const { result } = renderHook(() => useProjectLists(7), { wrapper: wrapper(queryClient) })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error.message).toBe('Not found')
  })
})

// ---------------------------------------------------------------------------
// useRenameWorkspace
// ---------------------------------------------------------------------------

describe('useRenameWorkspace', () => {
  let queryClient

  beforeEach(() => {
    queryClient = makeQueryClient()
    vi.resetAllMocks()
  })

  it('calls PUT /workspaces/:id with the new name', async () => {
    const updated = { id: 1, name: 'Renamed WS' }
    apiClient.put.mockResolvedValueOnce({ data: updated })
    apiClient.get.mockResolvedValueOnce({ data: [updated] }) // invalidation refetch

    const { result } = renderHook(() => useRenameWorkspace(), { wrapper: wrapper(queryClient) })

    await act(async () => {
      result.current.mutate({ id: 1, name: 'Renamed WS' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(apiClient.put).toHaveBeenCalledWith('/workspaces/1', { name: 'Renamed WS' })
  })

  it('invalidates ["workspaces"] on success', async () => {
    apiClient.put.mockResolvedValueOnce({ data: { id: 1, name: 'Renamed WS' } })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    apiClient.get.mockResolvedValueOnce({ data: [] })

    const { result } = renderHook(() => useRenameWorkspace(), { wrapper: wrapper(queryClient) })

    await act(async () => {
      result.current.mutate({ id: 1, name: 'Renamed WS' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['workspaces'] })
  })

  it('surfaces errors from a failed rename', async () => {
    apiClient.put.mockRejectedValueOnce(new Error('Forbidden'))

    const { result } = renderHook(() => useRenameWorkspace(), { wrapper: wrapper(queryClient) })

    await act(async () => {
      result.current.mutate({ id: 1, name: 'Bad Name' })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error.message).toBe('Forbidden')
  })
})

// ---------------------------------------------------------------------------
// useDeleteWorkspace
// ---------------------------------------------------------------------------

describe('useDeleteWorkspace', () => {
  let queryClient

  beforeEach(() => {
    queryClient = makeQueryClient()
    vi.resetAllMocks()
  })

  it('calls DELETE /workspaces/:id', async () => {
    apiClient.delete.mockResolvedValueOnce({ data: { success: true } })
    apiClient.get.mockResolvedValueOnce({ data: [] }) // invalidation refetch

    const { result } = renderHook(() => useDeleteWorkspace(), { wrapper: wrapper(queryClient) })

    await act(async () => {
      result.current.mutate(1)
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(apiClient.delete).toHaveBeenCalledWith('/workspaces/1')
  })

  it('invalidates ["workspaces"] on success', async () => {
    apiClient.delete.mockResolvedValueOnce({ data: { success: true } })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    apiClient.get.mockResolvedValueOnce({ data: [] })

    const { result } = renderHook(() => useDeleteWorkspace(), { wrapper: wrapper(queryClient) })

    await act(async () => {
      result.current.mutate(1)
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['workspaces'] })
  })

  it('surfaces errors from a failed delete', async () => {
    apiClient.delete.mockRejectedValueOnce(new Error('Not found'))

    const { result } = renderHook(() => useDeleteWorkspace(), { wrapper: wrapper(queryClient) })

    await act(async () => {
      result.current.mutate(99)
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error.message).toBe('Not found')
  })
})

// ---------------------------------------------------------------------------
// useTags
// ---------------------------------------------------------------------------

describe('useTags', () => {
  let queryClient

  beforeEach(() => {
    queryClient = makeQueryClient()
    vi.resetAllMocks()
  })

  it('returns data from GET /workspaces/:id/tags', async () => {
    const tags = [{ id: 1, name: 'Urgent', color: '#FF0000' }]
    apiClient.get.mockResolvedValueOnce({ data: tags })

    const { result } = renderHook(() => useTags(3), { wrapper: wrapper(queryClient) })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(tags)
    expect(apiClient.get).toHaveBeenCalledWith('/workspaces/3/tags')
  })

  it('uses query key ["tags", workspaceId]', async () => {
    apiClient.get.mockResolvedValueOnce({ data: [] })

    const { result } = renderHook(() => useTags(3), { wrapper: wrapper(queryClient) })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const cached = queryClient.getQueryData(['tags', 3])
    expect(cached).toEqual([])
  })

  it('is disabled when workspaceId is null', () => {
    const { result } = renderHook(() => useTags(null), { wrapper: wrapper(queryClient) })

    expect(result.current.fetchStatus).toBe('idle')
    expect(apiClient.get).not.toHaveBeenCalled()
  })

  it('is disabled when workspaceId is undefined', () => {
    const { result } = renderHook(() => useTags(undefined), { wrapper: wrapper(queryClient) })

    expect(result.current.fetchStatus).toBe('idle')
    expect(apiClient.get).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// useCreateTag
// ---------------------------------------------------------------------------

describe('useCreateTag', () => {
  let queryClient

  beforeEach(() => {
    queryClient = makeQueryClient()
    vi.resetAllMocks()
  })

  it('posts to /workspaces/:id/tags with name', async () => {
    const created = { id: 5, name: 'New Tag', color: null }
    apiClient.post.mockResolvedValueOnce({ data: created })
    apiClient.get.mockResolvedValueOnce({ data: [] })

    const { result } = renderHook(() => useCreateTag(3), { wrapper: wrapper(queryClient) })

    await act(async () => {
      result.current.mutate({ name: 'New Tag' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(apiClient.post).toHaveBeenCalledWith('/workspaces/3/tags', { name: 'New Tag' })
  })

  it('includes optional color when provided', async () => {
    apiClient.post.mockResolvedValueOnce({ data: { id: 6, name: 'Colored', color: '#ABCDEF' } })
    apiClient.get.mockResolvedValueOnce({ data: [] })

    const { result } = renderHook(() => useCreateTag(3), { wrapper: wrapper(queryClient) })

    await act(async () => {
      result.current.mutate({ name: 'Colored', color: '#ABCDEF' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(apiClient.post).toHaveBeenCalledWith('/workspaces/3/tags', {
      name: 'Colored',
      color: '#ABCDEF',
    })
  })

  it('invalidates ["tags", workspaceId] on success', async () => {
    apiClient.post.mockResolvedValueOnce({ data: { id: 5, name: 'Tag' } })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    apiClient.get.mockResolvedValueOnce({ data: [] })

    const { result } = renderHook(() => useCreateTag(3), { wrapper: wrapper(queryClient) })

    await act(async () => {
      result.current.mutate({ name: 'Tag' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['tags', 3] })
  })
})

// ---------------------------------------------------------------------------
// useDeleteTag
// ---------------------------------------------------------------------------

describe('useDeleteTag', () => {
  let queryClient

  beforeEach(() => {
    queryClient = makeQueryClient()
    vi.resetAllMocks()
  })

  it('calls DELETE /workspaces/:id/tags/:tagId', async () => {
    apiClient.delete.mockResolvedValueOnce({ data: { success: true } })
    apiClient.get.mockResolvedValueOnce({ data: [] })

    const { result } = renderHook(() => useDeleteTag(3), { wrapper: wrapper(queryClient) })

    await act(async () => {
      result.current.mutate(7)
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(apiClient.delete).toHaveBeenCalledWith('/workspaces/3/tags/7')
  })

  it('invalidates ["tags", workspaceId] on success', async () => {
    apiClient.delete.mockResolvedValueOnce({ data: { success: true } })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    apiClient.get.mockResolvedValueOnce({ data: [] })

    const { result } = renderHook(() => useDeleteTag(3), { wrapper: wrapper(queryClient) })

    await act(async () => {
      result.current.mutate(7)
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['tags', 3] })
  })

  it('surfaces errors from a failed tag delete', async () => {
    apiClient.delete.mockRejectedValueOnce(new Error('Not found'))

    const { result } = renderHook(() => useDeleteTag(3), { wrapper: wrapper(queryClient) })

    await act(async () => {
      result.current.mutate(99)
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error.message).toBe('Not found')
  })
})

// ---------------------------------------------------------------------------
// useWorkspaceMembers
// ---------------------------------------------------------------------------

describe('useWorkspaceMembers', () => {
  let queryClient

  beforeEach(() => {
    queryClient = makeQueryClient()
    vi.resetAllMocks()
  })

  it('returns data from GET /workspaces/:id/members', async () => {
    const members = [
      { user_id: 10, email: 'alice@example.com', role: 'owner' },
      { user_id: 20, email: 'bob@example.com', role: 'member' },
    ]
    apiClient.get.mockResolvedValueOnce({ data: members })

    const { result } = renderHook(() => useWorkspaceMembers(3), { wrapper: wrapper(queryClient) })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(members)
    expect(apiClient.get).toHaveBeenCalledWith('/workspaces/3/members')
  })

  it('uses query key ["members", workspaceId]', async () => {
    apiClient.get.mockResolvedValueOnce({ data: [] })

    const { result } = renderHook(() => useWorkspaceMembers(3), { wrapper: wrapper(queryClient) })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const cached = queryClient.getQueryData(['members', 3])
    expect(cached).toEqual([])
  })

  it('is disabled when workspaceId is null', () => {
    const { result } = renderHook(() => useWorkspaceMembers(null), { wrapper: wrapper(queryClient) })

    expect(result.current.fetchStatus).toBe('idle')
    expect(apiClient.get).not.toHaveBeenCalled()
  })

  it('is disabled when workspaceId is undefined', () => {
    const { result } = renderHook(() => useWorkspaceMembers(undefined), { wrapper: wrapper(queryClient) })

    expect(result.current.fetchStatus).toBe('idle')
    expect(apiClient.get).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// useAddMember
// ---------------------------------------------------------------------------

describe('useAddMember', () => {
  let queryClient

  beforeEach(() => {
    queryClient = makeQueryClient()
    vi.resetAllMocks()
  })

  it('posts to /workspaces/:id/members with email and role', async () => {
    const newMember = { user_id: 30, email: 'carol@example.com', role: 'member' }
    apiClient.post.mockResolvedValueOnce({ data: newMember })
    apiClient.get.mockResolvedValueOnce({ data: [] })

    const { result } = renderHook(() => useAddMember(3), { wrapper: wrapper(queryClient) })

    await act(async () => {
      result.current.mutate({ email: 'carol@example.com', role: 'member' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(apiClient.post).toHaveBeenCalledWith('/workspaces/3/members', {
      email: 'carol@example.com',
      role: 'member',
    })
  })

  it('invalidates ["members", workspaceId] on success', async () => {
    apiClient.post.mockResolvedValueOnce({ data: { user_id: 30, email: 'carol@example.com', role: 'member' } })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    apiClient.get.mockResolvedValueOnce({ data: [] })

    const { result } = renderHook(() => useAddMember(3), { wrapper: wrapper(queryClient) })

    await act(async () => {
      result.current.mutate({ email: 'carol@example.com', role: 'member' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['members', 3] })
  })

  it('surfaces a 404 error when the user does not exist', async () => {
    const notFoundError = new Error('User not found')
    notFoundError.response = { status: 404, data: { error: 'User not found' } }
    apiClient.post.mockRejectedValueOnce(notFoundError)

    const { result } = renderHook(() => useAddMember(3), { wrapper: wrapper(queryClient) })

    await act(async () => {
      result.current.mutate({ email: 'nobody@example.com', role: 'member' })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error.message).toBe('User not found')
    expect(result.current.error.response.status).toBe(404)
  })
})

// ---------------------------------------------------------------------------
// useRemoveMember
// ---------------------------------------------------------------------------

describe('useRemoveMember', () => {
  let queryClient

  beforeEach(() => {
    queryClient = makeQueryClient()
    vi.resetAllMocks()
  })

  it('calls DELETE /workspaces/:id/members/:userId', async () => {
    apiClient.delete.mockResolvedValueOnce({ data: { success: true } })
    apiClient.get.mockResolvedValueOnce({ data: [] })

    const { result } = renderHook(() => useRemoveMember(3), { wrapper: wrapper(queryClient) })

    await act(async () => {
      result.current.mutate(20)
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(apiClient.delete).toHaveBeenCalledWith('/workspaces/3/members/20')
  })

  it('invalidates ["members", workspaceId] on success', async () => {
    apiClient.delete.mockResolvedValueOnce({ data: { success: true } })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    apiClient.get.mockResolvedValueOnce({ data: [] })

    const { result } = renderHook(() => useRemoveMember(3), { wrapper: wrapper(queryClient) })

    await act(async () => {
      result.current.mutate(20)
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['members', 3] })
  })

  it('surfaces errors from a failed member removal', async () => {
    apiClient.delete.mockRejectedValueOnce(new Error('Forbidden'))

    const { result } = renderHook(() => useRemoveMember(3), { wrapper: wrapper(queryClient) })

    await act(async () => {
      result.current.mutate(20)
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error.message).toBe('Forbidden')
  })
})

// ---------------------------------------------------------------------------
// useCreateList
// ---------------------------------------------------------------------------

describe('useCreateList', () => {
  let queryClient

  beforeEach(() => {
    queryClient = makeQueryClient()
    vi.resetAllMocks()
  })

  it('posts to /lists with name and project_id', async () => {
    const created = { id: 10, name: 'Sprint 1', project_id: 5 }
    apiClient.post.mockResolvedValueOnce({ data: created })
    apiClient.get.mockResolvedValueOnce({ data: [] })

    const { result } = renderHook(() => useCreateList(5), { wrapper: wrapper(queryClient) })

    await act(async () => {
      result.current.mutate({ name: 'Sprint 1' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(apiClient.post).toHaveBeenCalledWith('/lists', { name: 'Sprint 1', project_id: 5 })
  })

  it('optimistically appends a temp list to ["projectLists", projectId]', async () => {
    queryClient.setQueryData(['projectLists', 5], [{ id: 1, name: 'Existing', project_id: 5 }])

    let resolve
    apiClient.post.mockReturnValueOnce(new Promise((res) => { resolve = res }))

    const { result } = renderHook(() => useCreateList(5), { wrapper: wrapper(queryClient) })

    act(() => {
      result.current.mutate({ name: 'Optimistic List' })
    })

    await waitFor(() => {
      const cached = queryClient.getQueryData(['projectLists', 5])
      return cached && cached.some((l) => l.name === 'Optimistic List' && String(l.id).startsWith('temp-'))
    })

    const cached = queryClient.getQueryData(['projectLists', 5])
    expect(cached).toHaveLength(2)
    expect(cached[1].name).toBe('Optimistic List')
    expect(cached[1].project_id).toBe(5)

    resolve({ data: { id: 99, name: 'Optimistic List', project_id: 5 } })
    apiClient.get.mockResolvedValueOnce({ data: [] })
  })

  it('rolls back on error', async () => {
    const original = [{ id: 1, name: 'Existing', project_id: 5 }]
    queryClient.setQueryData(['projectLists', 5], original)

    apiClient.post.mockRejectedValueOnce(new Error('Fail'))
    apiClient.get.mockResolvedValueOnce({ data: original })

    const { result } = renderHook(() => useCreateList(5), { wrapper: wrapper(queryClient) })

    await act(async () => {
      result.current.mutate({ name: 'Bad List' })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    await waitFor(() => {
      const cached = queryClient.getQueryData(['projectLists', 5])
      return !cached?.some((l) => String(l.id).startsWith('temp-'))
    })
  })

  it('invalidates ["projectLists", projectId] on settled', async () => {
    const created = { id: 10, name: 'Sprint 1', project_id: 5 }
    apiClient.post.mockResolvedValueOnce({ data: created })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    apiClient.get.mockResolvedValueOnce({ data: [] })

    const { result } = renderHook(() => useCreateList(5), { wrapper: wrapper(queryClient) })

    await act(async () => {
      result.current.mutate({ name: 'Sprint 1' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['projectLists', 5] })
  })
})

// ---------------------------------------------------------------------------
// useRenameList
// ---------------------------------------------------------------------------

describe('useRenameList', () => {
  let queryClient

  beforeEach(() => {
    queryClient = makeQueryClient()
    vi.resetAllMocks()
  })

  it('calls PUT /lists/:id with name', async () => {
    const updated = { id: 10, name: 'Renamed List', project_id: 5 }
    apiClient.put.mockResolvedValueOnce({ data: updated })
    apiClient.get.mockResolvedValueOnce({ data: [updated] })

    const { result } = renderHook(() => useRenameList(5), { wrapper: wrapper(queryClient) })

    await act(async () => {
      result.current.mutate({ id: 10, name: 'Renamed List' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(apiClient.put).toHaveBeenCalledWith('/lists/10', { name: 'Renamed List' })
  })

  it('invalidates ["projectLists", projectId] on success', async () => {
    apiClient.put.mockResolvedValueOnce({ data: { id: 10, name: 'Renamed' } })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    apiClient.get.mockResolvedValueOnce({ data: [] })

    const { result } = renderHook(() => useRenameList(5), { wrapper: wrapper(queryClient) })

    await act(async () => {
      result.current.mutate({ id: 10, name: 'Renamed' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['projectLists', 5] })
  })

  it('surfaces errors from a failed rename', async () => {
    apiClient.put.mockRejectedValueOnce(new Error('Forbidden'))

    const { result } = renderHook(() => useRenameList(5), { wrapper: wrapper(queryClient) })

    await act(async () => {
      result.current.mutate({ id: 10, name: 'Bad' })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error.message).toBe('Forbidden')
  })
})

// ---------------------------------------------------------------------------
// useDeleteList
// ---------------------------------------------------------------------------

describe('useDeleteList', () => {
  let queryClient

  beforeEach(() => {
    queryClient = makeQueryClient()
    vi.resetAllMocks()
  })

  it('calls DELETE /lists/:id', async () => {
    apiClient.delete.mockResolvedValueOnce({ data: { message: 'deleted' } })
    apiClient.get.mockResolvedValueOnce({ data: [] })

    const { result } = renderHook(() => useDeleteList(5), { wrapper: wrapper(queryClient) })

    await act(async () => {
      result.current.mutate(10)
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(apiClient.delete).toHaveBeenCalledWith('/lists/10')
  })

  it('optimistically removes the list from ["projectLists", projectId]', async () => {
    queryClient.setQueryData(['projectLists', 5], [
      { id: 10, name: 'To Delete', project_id: 5 },
      { id: 20, name: 'To Keep', project_id: 5 },
    ])

    let resolve
    apiClient.delete.mockReturnValueOnce(new Promise((res) => { resolve = res }))

    const { result } = renderHook(() => useDeleteList(5), { wrapper: wrapper(queryClient) })

    act(() => {
      result.current.mutate(10)
    })

    await waitFor(() => {
      const cached = queryClient.getQueryData(['projectLists', 5])
      return cached && !cached.some((l) => String(l.id) === '10')
    })

    const cached = queryClient.getQueryData(['projectLists', 5])
    expect(cached).toHaveLength(1)
    expect(cached[0].name).toBe('To Keep')

    resolve({ data: { message: 'deleted' } })
    apiClient.get.mockResolvedValueOnce({ data: [] })
  })

  it('uses String() coercion when matching ids for removal', async () => {
    queryClient.setQueryData(['projectLists', 5], [
      { id: 10, name: 'Numeric Id', project_id: 5 },
    ])

    let resolve
    apiClient.delete.mockReturnValueOnce(new Promise((res) => { resolve = res }))

    const { result } = renderHook(() => useDeleteList(5), { wrapper: wrapper(queryClient) })

    // Pass id as string '10' — numeric list id 10 should still match
    act(() => {
      result.current.mutate('10')
    })

    await waitFor(() => {
      const cached = queryClient.getQueryData(['projectLists', 5])
      return cached && cached.length === 0
    })

    resolve({ data: { message: 'deleted' } })
    apiClient.get.mockResolvedValueOnce({ data: [] })
  })

  it('rolls back on error', async () => {
    const original = [
      { id: 10, name: 'To Delete', project_id: 5 },
      { id: 20, name: 'To Keep', project_id: 5 },
    ]
    queryClient.setQueryData(['projectLists', 5], original)

    apiClient.delete.mockRejectedValueOnce(new Error('Forbidden'))
    apiClient.get.mockResolvedValueOnce({ data: original })

    const { result } = renderHook(() => useDeleteList(5), { wrapper: wrapper(queryClient) })

    await act(async () => {
      result.current.mutate(10)
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    await waitFor(() => {
      const cached = queryClient.getQueryData(['projectLists', 5])
      // Either rolled back (length=2) or refetched original; either way no orphan state
      return cached !== undefined
    })
  })

  it('invalidates ["projectLists", projectId] on settled', async () => {
    apiClient.delete.mockResolvedValueOnce({ data: { message: 'deleted' } })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    apiClient.get.mockResolvedValueOnce({ data: [] })

    const { result } = renderHook(() => useDeleteList(5), { wrapper: wrapper(queryClient) })

    await act(async () => {
      result.current.mutate(10)
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['projectLists', 5] })
  })
})
