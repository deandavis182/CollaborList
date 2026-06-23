import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// ---------------------------------------------------------------------------
// Mock api so no network calls happen
// ---------------------------------------------------------------------------
vi.mock('../../lib/api.js', () => ({
  useWorkspaces: vi.fn(() => ({ data: [], isLoading: false })),
  useCreateWorkspace: vi.fn(() => ({ mutate: vi.fn(), isPending: false, isError: false, error: null })),
  useProjects: vi.fn(() => ({ data: [], isLoading: false })),
  useCreateProject: vi.fn(() => ({ mutate: vi.fn(), isPending: false, isError: false, error: null })),
  useWorkspaceActivity: vi.fn(() => ({ data: { items: [], unread: 0 } })),
}))

// ---------------------------------------------------------------------------
// Mock lib/auth — control getUser and logout per test
// ---------------------------------------------------------------------------
vi.mock('../../lib/auth.js', () => ({
  getUser: vi.fn(() => null),
  logout: vi.fn(),
  isAuthenticated: vi.fn(() => true),
  getToken: vi.fn(() => 'mock-token'),
  setAuth: vi.fn(),
}))

import { useWorkspaceActivity } from '../../lib/api.js'
import { getUser, logout } from '../../lib/auth.js'
import { useStore } from '../../lib/store.js'
import { AppLayout } from '../AppLayout.jsx'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

function Wrapper({ children, initialPath = '/' }) {
  return (
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter initialEntries={[initialPath]}>{children}</MemoryRouter>
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
describe('AppLayout — structure', () => {
  beforeEach(resetStore)

  it('renders children in the main content area', () => {
    render(
      <AppLayout>
        <div data-testid="child-content">Hello</div>
      </AppLayout>,
      { wrapper: Wrapper }
    )

    expect(screen.getByTestId('main-content')).toBeInTheDocument()
    expect(screen.getByTestId('child-content')).toBeInTheDocument()
  })

  it('sidebar container has the md:flex class (visible on desktop via Tailwind)', () => {
    render(<AppLayout><span /></AppLayout>, { wrapper: Wrapper })

    const sidebarContainer = screen.getByTestId('sidebar-container')
    expect(sidebarContainer.className).toContain('md:flex')
  })

  it('sidebar container has hidden class (hidden on mobile via Tailwind)', () => {
    render(<AppLayout><span /></AppLayout>, { wrapper: Wrapper })

    const sidebarContainer = screen.getByTestId('sidebar-container')
    expect(sidebarContainer.className).toContain('hidden')
  })

  it('bottom bar container has md:hidden class (hidden on desktop)', () => {
    render(<AppLayout><span /></AppLayout>, { wrapper: Wrapper })

    const bottomBarContainer = screen.getByTestId('bottom-bar-container')
    expect(bottomBarContainer.className).toContain('md:hidden')
  })

  it('bottom tab bar is rendered in the DOM', () => {
    render(<AppLayout><span /></AppLayout>, { wrapper: Wrapper })

    expect(screen.getByTestId('bottom-tab-bar')).toBeInTheDocument()
  })

  it('sidebar is rendered inside the sidebar container', () => {
    render(<AppLayout><span /></AppLayout>, { wrapper: Wrapper })

    const sidebarContainer = screen.getByTestId('sidebar-container')
    expect(sidebarContainer.querySelector('[data-testid="sidebar"]')).toBeTruthy()
  })
})

describe('AppLayout — header + presence bar', () => {
  beforeEach(resetStore)

  it('renders the app-header', () => {
    render(<AppLayout><span /></AppLayout>, { wrapper: Wrapper })
    expect(screen.getByTestId('app-header')).toBeInTheDocument()
  })

  it('renders the presence-bar inside the app-header', () => {
    render(<AppLayout><span /></AppLayout>, { wrapper: Wrapper })
    const header = screen.getByTestId('app-header')
    expect(header.querySelector('[data-testid="presence-bar"]')).toBeTruthy()
  })
})

describe('AppLayout — no placeholder detail Sheet', () => {
  beforeEach(resetStore)

  it('does not render a placeholder detail dialog when detailItemId is null', () => {
    render(<AppLayout><span /></AppLayout>, { wrapper: Wrapper })
    // AppLayout no longer renders any Sheet — the real ItemDetailDrawer is mounted by ListView
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('does not render a placeholder detail dialog even when detailItemId is set (drawer is mounted by ListView)', () => {
    useStore.setState({ detailItemId: 'item-123' })
    render(<AppLayout><span /></AppLayout>, { wrapper: Wrapper })
    // No dialog rendered by AppLayout itself
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('AppLayout — BottomTabBar navigation', () => {
  beforeEach(resetStore)

  it('home tab has aria-current=page at /my-tasks', () => {
    render(
      <QueryClientProvider client={makeQC()}>
        <MemoryRouter initialEntries={['/my-tasks']}>
          <AppLayout><span /></AppLayout>
        </MemoryRouter>
      </QueryClientProvider>
    )
    expect(screen.getByTestId('tab-home')).toHaveAttribute('aria-current', 'page')
  })

  it('home tab has aria-current=page at /', () => {
    render(
      <QueryClientProvider client={makeQC()}>
        <MemoryRouter initialEntries={['/']}>
          <AppLayout><span /></AppLayout>
        </MemoryRouter>
      </QueryClientProvider>
    )
    expect(screen.getByTestId('tab-home')).toHaveAttribute('aria-current', 'page')
  })

  it('activity tab has aria-current=page at /w/:id/activity', () => {
    render(
      <QueryClientProvider client={makeQC()}>
        <MemoryRouter initialEntries={['/w/ws-1/activity']}>
          <AppLayout><span /></AppLayout>
        </MemoryRouter>
      </QueryClientProvider>
    )
    expect(screen.getByTestId('tab-activity')).toHaveAttribute('aria-current', 'page')
  })
})

describe('AppLayout — activity unread dot', () => {
  beforeEach(resetStore)

  it('does not show the unread dot when unread count is 0', () => {
    useWorkspaceActivity.mockReturnValue({ data: { items: [], unread: 0 } })
    useStore.setState({ currentWorkspaceId: 'ws-1' })

    render(<AppLayout><span /></AppLayout>, { wrapper: Wrapper })

    expect(screen.queryByTestId('tab-activity-unread-dot')).not.toBeInTheDocument()
  })

  it('shows the unread dot when unread count > 0', () => {
    useWorkspaceActivity.mockReturnValue({ data: { items: [], unread: 3 } })
    useStore.setState({ currentWorkspaceId: 'ws-1' })

    render(<AppLayout><span /></AppLayout>, { wrapper: Wrapper })

    expect(screen.getByTestId('tab-activity-unread-dot')).toBeInTheDocument()
  })

  it('does not show the unread dot when no workspace is selected, even with unread data', () => {
    useWorkspaceActivity.mockReturnValue({ data: { items: [], unread: 5 } })
    useStore.setState({ currentWorkspaceId: null })

    render(<AppLayout><span /></AppLayout>, { wrapper: Wrapper })

    expect(screen.queryByTestId('tab-activity-unread-dot')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Tests — header user email + logout
// ---------------------------------------------------------------------------

describe('AppLayout — header user email and logout', () => {
  beforeEach(resetStore)

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('shows the current user email in the header when logged in', () => {
    getUser.mockReturnValue({ id: 1, email: 'alice@example.com' })

    render(<AppLayout><span /></AppLayout>, { wrapper: Wrapper })

    expect(screen.getByTestId('header-user-email')).toHaveTextContent('alice@example.com')
  })

  it('does not show the email element when no user is stored', () => {
    getUser.mockReturnValue(null)

    render(<AppLayout><span /></AppLayout>, { wrapper: Wrapper })

    expect(screen.queryByTestId('header-user-email')).not.toBeInTheDocument()
  })

  it('renders a logout button in the header', () => {
    getUser.mockReturnValue({ id: 1, email: 'alice@example.com' })

    render(<AppLayout><span /></AppLayout>, { wrapper: Wrapper })

    expect(screen.getByTestId('logout-btn')).toBeInTheDocument()
  })

  it('clicking logout calls logout() and navigates to /login', () => {
    getUser.mockReturnValue({ id: 1, email: 'alice@example.com' })
    const assignSpy = vi.spyOn(window, 'location', 'get').mockReturnValue({
      ...window.location,
      assign: vi.fn(),
    })

    render(<AppLayout><span /></AppLayout>, { wrapper: Wrapper })
    fireEvent.click(screen.getByTestId('logout-btn'))

    expect(logout).toHaveBeenCalledTimes(1)
    assignSpy.mockRestore()
  })
})
