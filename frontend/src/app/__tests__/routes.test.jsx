/**
 * routes.test.jsx — tests for the V2 router and placeholder views.
 *
 * Uses <MemoryRouter> + <AppRoutes> so no BrowserRouter/JSDOM history issues.
 * Mocks ../../lib/api so Sidebar hooks never hit the network.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// ---------------------------------------------------------------------------
// Mock api so Sidebar hooks don't hit the network
// ---------------------------------------------------------------------------
vi.mock('../../lib/api.js', () => ({
  useWorkspaces: vi.fn(() => ({ data: [], isLoading: false })),
  useCreateWorkspace: vi.fn(() => ({ mutate: vi.fn(), isPending: false, isError: false, error: null })),
  useProjects: vi.fn(() => ({ data: [], isLoading: false })),
}))

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
// Tests
// ---------------------------------------------------------------------------

describe('routes — home (/)', () => {
  beforeEach(resetStore)

  it('renders the HomeView placeholder at /', () => {
    renderAt('/')
    expect(screen.getByTestId('home-view')).toBeInTheDocument()
  })

  it('shows "Select a workspace" text inside the HomeView at /', () => {
    renderAt('/')
    // "Select a workspace" also appears in Sidebar (projects prompt), so
    // assert it appears inside the home-view specifically.
    const homeView = screen.getByTestId('home-view')
    expect(homeView).toHaveTextContent('Select a workspace')
  })

  it('renders AppLayout (main-content area) at /', () => {
    renderAt('/')
    expect(screen.getByTestId('main-content')).toBeInTheDocument()
  })
})

describe('routes — workspace (/w/:workspaceId)', () => {
  beforeEach(resetStore)

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
})

describe('routes — project (/w/:workspaceId/p/:projectId)', () => {
  beforeEach(resetStore)

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
})

describe('routes — AppLayout is always present', () => {
  beforeEach(resetStore)

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
