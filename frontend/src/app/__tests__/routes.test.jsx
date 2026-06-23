/**
 * routes.test.jsx — tests for the V2 router and real views.
 *
 * Uses <MemoryRouter> + <AppRoutes> so no BrowserRouter/JSDOM history issues.
 * Mocks ../../lib/api so all hooks never hit the network.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// ---------------------------------------------------------------------------
// Mock api so all hooks don't hit the network
// ---------------------------------------------------------------------------
vi.mock('../../lib/api.js', () => ({
  apiClient: { post: vi.fn() },
  useWorkspaces: vi.fn(() => ({ data: [], isLoading: false })),
  useCreateWorkspace: vi.fn(() => ({ mutate: vi.fn(), isPending: false, isError: false, error: null })),
  useProjects: vi.fn(() => ({ data: [], isLoading: false })),
  useCreateProject: vi.fn(() => ({ mutate: vi.fn(), isPending: false, isError: false, error: null })),
  useProjectLists: vi.fn(() => ({ data: [], isLoading: false })),
  useCreateList: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useRenameList: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useDeleteList: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useUpdateProject: vi.fn(() => ({ mutate: vi.fn(), isPending: false, isError: false, error: null })),
  useDeleteProject: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useTags: vi.fn(() => ({ data: [], isLoading: false })),
  useCreateTag: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useDeleteTag: vi.fn(() => ({ mutate: vi.fn() })),
  useWorkspaceMembers: vi.fn(() => ({ data: [], isLoading: false })),
  useAddMember: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useRemoveMember: vi.fn(() => ({ mutate: vi.fn() })),
  useMyTasks: vi.fn(() => ({ data: [], isLoading: false })),
  useWorkspaceActivity: vi.fn(() => ({ data: { items: [], unread: 0 }, isLoading: false })),
  useMarkActivityRead: vi.fn(() => ({ mutate: vi.fn() })),
  useListItems: vi.fn(() => ({ data: [], isLoading: false })),
  useCreateItem: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useUpdateItem: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useUpdateAnyItem: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useItemComments: vi.fn(() => ({ data: [], isLoading: false })),
  useCreateComment: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useDeleteComment: vi.fn(() => ({ mutate: vi.fn() })),
  useAddItemTag: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useRemoveItemTag: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useProjectItems: vi.fn(() => ({ data: [], isLoading: false })),
}))

// ---------------------------------------------------------------------------
// Mock lib/auth so LoginView doesn't touch localStorage / navigate in tests
// ---------------------------------------------------------------------------
vi.mock('../../lib/auth.js', () => ({
  setAuth: vi.fn(),
  getToken: vi.fn(() => null),
  getUser: vi.fn(() => null),
  logout: vi.fn(),
  isAuthenticated: vi.fn(() => false),
}))

import { useWorkspaces, useProjects } from '../../lib/api.js'
import { useStore } from '../../lib/store.js'
import { AppRoutes } from '../routes.jsx'
import { Providers } from '../providers.jsx'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

/**
 * Render the full V2 route tree at a given URL path.
 * Wraps with <Providers> (QueryClient + theme) and <MemoryRouter>.
 */
function renderAt(path) {
  return render(
    <QueryClientProvider client={makeQC()}>
      <Providers>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
        </MemoryRouter>
      </Providers>
    </QueryClientProvider>
  )
}

function resetStore() {
  useStore.setState({
    currentWorkspaceId: null,
    currentProjectId: null,
    detailItemId: null,
    presence: {},
    theme: 'light',
  })
}

// ---------------------------------------------------------------------------
// Tests — Index route (/) — now renders MyTasksView
// ---------------------------------------------------------------------------

describe('routes — index (/)', () => {
  beforeEach(() => {
    resetStore()
    useWorkspaces.mockReturnValue({ data: [], isLoading: false })
  })

  it('renders MyTasksView at / (index route is now My Tasks)', () => {
    renderAt('/')
    expect(screen.getByTestId('my-tasks-view')).toBeInTheDocument()
  })

  it('renders AppLayout (main-content area) at /', () => {
    renderAt('/')
    expect(screen.getByTestId('main-content')).toBeInTheDocument()
  })

  it('shows "My Tasks" heading at /', () => {
    renderAt('/')
    expect(screen.getByTestId('my-tasks-view')).toHaveTextContent('My Tasks')
  })
})

// ---------------------------------------------------------------------------
// Tests — WorkspaceView
// ---------------------------------------------------------------------------

describe('routes — workspace (/w/:workspaceId)', () => {
  beforeEach(() => {
    resetStore()
    useWorkspaces.mockReturnValue({ data: [], isLoading: false })
    useProjects.mockReturnValue({ data: [], isLoading: false })
  })

  it('renders WorkspaceView at /w/abc', () => {
    renderAt('/w/abc')
    expect(screen.getByTestId('workspace-view')).toBeInTheDocument()
  })

  it('displays the workspaceId param from the URL', () => {
    renderAt('/w/abc')
    expect(screen.getByTestId('workspace-id-display')).toHaveTextContent('abc')
  })

  it('renders inside AppLayout at /w/abc', () => {
    renderAt('/w/abc')
    expect(screen.getByTestId('main-content')).toBeInTheDocument()
  })

  it('syncs workspaceId from the URL param into the store', async () => {
    renderAt('/w/ws-42')
    // The WorkspaceView effect sets currentWorkspaceId via store
    expect(useStore.getState().currentWorkspaceId).toBe('ws-42')
  })

  it('shows empty state when workspace has no projects', () => {
    useProjects.mockReturnValue({ data: [], isLoading: false })
    renderAt('/w/abc')
    expect(screen.getByTestId('workspace-view-empty')).toBeInTheDocument()
  })

  it('shows project links when workspace has projects', () => {
    useProjects.mockReturnValue({
      data: [
        { id: 'p1', name: 'Alpha' },
        { id: 'p2', name: 'Beta' },
      ],
      isLoading: false,
    })
    renderAt('/w/abc')
    expect(screen.getByTestId('workspace-project-link-p1')).toBeInTheDocument()
    expect(screen.getByTestId('workspace-project-link-p2')).toBeInTheDocument()
  })

  it('renders a workspace settings button', () => {
    renderAt('/w/abc')
    expect(screen.getByTestId('workspace-settings-btn')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Tests — ProjectView route
// ---------------------------------------------------------------------------

describe('routes — project (/w/:workspaceId/p/:projectId)', () => {
  beforeEach(() => {
    resetStore()
    useWorkspaces.mockReturnValue({ data: [], isLoading: false })
    useProjects.mockReturnValue({ data: [], isLoading: false })
  })

  it('renders ProjectView at /w/abc/p/xyz', () => {
    renderAt('/w/abc/p/xyz')
    expect(screen.getByTestId('project-view')).toBeInTheDocument()
  })

  it('displays workspaceId param from the URL', () => {
    renderAt('/w/abc/p/xyz')
    expect(screen.getByTestId('workspace-id-display')).toHaveTextContent('abc')
  })

  it('displays projectId param from the URL', () => {
    renderAt('/w/abc/p/xyz')
    expect(screen.getByTestId('project-id-display')).toHaveTextContent('xyz')
  })

  it('renders inside AppLayout at /w/abc/p/xyz', () => {
    renderAt('/w/abc/p/xyz')
    expect(screen.getByTestId('main-content')).toBeInTheDocument()
  })

  it('shows correct ids for a different param combination (/w/ws-1/p/proj-99)', () => {
    renderAt('/w/ws-1/p/proj-99')
    expect(screen.getByTestId('workspace-id-display')).toHaveTextContent('ws-1')
    expect(screen.getByTestId('project-id-display')).toHaveTextContent('proj-99')
  })

  it('syncs workspaceId and projectId into the store', () => {
    renderAt('/w/ws-5/p/proj-7')
    expect(useStore.getState().currentWorkspaceId).toBe('ws-5')
    expect(useStore.getState().currentProjectId).toBe('proj-7')
  })

  it('renders a project settings button', () => {
    renderAt('/w/abc/p/xyz')
    expect(screen.getByTestId('project-settings-btn')).toBeInTheDocument()
  })

  it('shows empty state when project has no lists', () => {
    renderAt('/w/abc/p/xyz')
    expect(screen.getByTestId('project-view-empty')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Tests — MyTasksView route (/my-tasks)
// ---------------------------------------------------------------------------

describe('routes — my-tasks (/my-tasks)', () => {
  beforeEach(() => {
    resetStore()
    useWorkspaces.mockReturnValue({ data: [], isLoading: false })
    useProjects.mockReturnValue({ data: [], isLoading: false })
  })

  it('renders MyTasksView at /my-tasks', () => {
    renderAt('/my-tasks')
    expect(screen.getByTestId('my-tasks-view')).toBeInTheDocument()
  })

  it('renders inside AppLayout at /my-tasks', () => {
    renderAt('/my-tasks')
    expect(screen.getByTestId('main-content')).toBeInTheDocument()
  })

  it('shows "My Tasks" heading at /my-tasks', () => {
    renderAt('/my-tasks')
    // The page h1 + the sidebar nav link both say "My Tasks"; check the view testid
    expect(screen.getByTestId('my-tasks-view')).toHaveTextContent('My Tasks')
  })

  it('shows empty state when useMyTasks returns no tasks', () => {
    renderAt('/my-tasks')
    expect(screen.getByTestId('mytasks-empty')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Tests — ActivityFeed route (/w/:workspaceId/activity)
// ---------------------------------------------------------------------------

describe('routes — activity (/w/:workspaceId/activity)', () => {
  beforeEach(() => {
    resetStore()
    useWorkspaces.mockReturnValue({ data: [], isLoading: false })
    useProjects.mockReturnValue({ data: [], isLoading: false })
  })

  it('renders ActivityFeed at /w/ws-1/activity', () => {
    renderAt('/w/ws-1/activity')
    expect(screen.getByTestId('activity-feed')).toBeInTheDocument()
  })

  it('renders ActivityFeed inside AppLayout', () => {
    renderAt('/w/ws-1/activity')
    expect(screen.getByTestId('main-content')).toBeInTheDocument()
  })

  it('shows "Activity" heading at the activity route', () => {
    renderAt('/w/ws-1/activity')
    // Use the testid to scope to ActivityFeed rather than matching the sidebar link + BottomTabBar
    const feed = screen.getByTestId('activity-feed')
    expect(feed).toHaveTextContent('Activity')
  })

  it('shows empty state when there are no activity items', () => {
    renderAt('/w/ws-1/activity')
    expect(screen.getByTestId('activity-empty')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Tests — AppLayout is always present
// ---------------------------------------------------------------------------

describe('routes — AppLayout is always present', () => {
  beforeEach(() => {
    resetStore()
    useWorkspaces.mockReturnValue({ data: [], isLoading: false })
    useProjects.mockReturnValue({ data: [], isLoading: false })
  })

  it('sidebar container renders at /', () => {
    renderAt('/')
    expect(screen.getByTestId('sidebar-container')).toBeInTheDocument()
  })

  it('sidebar container renders at a project route', () => {
    renderAt('/w/abc/p/xyz')
    expect(screen.getByTestId('sidebar-container')).toBeInTheDocument()
  })

  it('bottom tab bar renders at /', () => {
    renderAt('/')
    expect(screen.getByTestId('bottom-tab-bar')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Tests — ListView route (/w/:workspaceId/p/:projectId/l/:listId)
// ---------------------------------------------------------------------------

describe('routes — list (/w/:workspaceId/p/:projectId/l/:listId)', () => {
  beforeEach(() => {
    resetStore()
    useWorkspaces.mockReturnValue({ data: [], isLoading: false })
    useProjects.mockReturnValue({ data: [], isLoading: false })
  })

  it('renders list-view at /w/1/p/2/l/3', () => {
    renderAt('/w/1/p/2/l/3')
    expect(screen.getByTestId('list-view')).toBeInTheDocument()
  })

  it('renders inside AppLayout at the list route', () => {
    renderAt('/w/1/p/2/l/3')
    expect(screen.getByTestId('main-content')).toBeInTheDocument()
  })

  it('renders the add-item input (ViewContainer is mounted with showAddItem)', () => {
    renderAt('/w/1/p/2/l/3')
    expect(screen.getByTestId('add-item-input')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Tests — /login route (outside AppLayout)
// ---------------------------------------------------------------------------

describe('routes — login (/login)', () => {
  beforeEach(() => {
    resetStore()
  })

  it('renders login-view at /login', () => {
    renderAt('/login')
    expect(screen.getByTestId('login-view')).toBeInTheDocument()
  })

  it('does NOT render the AppLayout sidebar at /login', () => {
    renderAt('/login')
    expect(screen.queryByTestId('sidebar-container')).not.toBeInTheDocument()
  })

  it('does NOT render the main-content area at /login', () => {
    renderAt('/login')
    expect(screen.queryByTestId('main-content')).not.toBeInTheDocument()
  })

  it('renders the email and password fields at /login', () => {
    renderAt('/login')
    expect(screen.getByTestId('auth-email')).toBeInTheDocument()
    expect(screen.getByTestId('auth-password')).toBeInTheDocument()
  })
})
