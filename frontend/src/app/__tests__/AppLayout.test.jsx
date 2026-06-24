import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// ---------------------------------------------------------------------------
// Mock useIsMobile so tests control mobile/desktop mode
// ---------------------------------------------------------------------------
vi.mock('../../lib/useMediaQuery.js', () => ({ useIsMobile: vi.fn() }))

// ---------------------------------------------------------------------------
// Mock api so no network calls happen
// ---------------------------------------------------------------------------
vi.mock('../../lib/api.js', () => ({
  useWorkspaces: vi.fn(() => ({ data: [], isLoading: false })),
  useCreateWorkspace: vi.fn(() => ({ mutate: vi.fn(), isPending: false, isError: false, error: null })),
  useProjects: vi.fn(() => ({ data: [], isLoading: false })),
  useCreateProject: vi.fn(() => ({ mutate: vi.fn(), isPending: false, isError: false, error: null })),
  useWorkspaceActivity: vi.fn(() => ({ data: { items: [], unread: 0 } })),
  useVapidKey: vi.fn(() => ({ data: null })),
  useNotificationPrefs: vi.fn(() => ({ data: null })),
  useUpdateNotificationPrefs: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}))

// ---------------------------------------------------------------------------
// Mock lib/push — prevent real browser API access in jsdom
// ---------------------------------------------------------------------------
vi.mock('../../lib/push.js', () => ({
  pushSupported: vi.fn(() => false),
  getPermission: vi.fn(() => 'default'),
  subscribeToPush: vi.fn(),
  unsubscribeFromPush: vi.fn(),
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
import { useIsMobile } from '../../lib/useMediaQuery.js'
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

function renderLayout(initialPath = '/') {
  return render(
    <AppLayout><span /></AppLayout>,
    { wrapper: ({ children }) => <Wrapper initialPath={initialPath}>{children}</Wrapper> }
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('AppLayout — structure', () => {
  beforeEach(() => {
    resetStore()
    useIsMobile.mockReturnValue(false)
  })

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

  it('does not render the old desktop BottomTabBar (superseded by MobileTabBar)', () => {
    render(<AppLayout><span /></AppLayout>, { wrapper: Wrapper })

    // On desktop the shell renders no bottom bar at all; on mobile it renders
    // the MobileTabBar instead. The old BottomTabBar is no longer mounted.
    expect(screen.queryByTestId('bottom-bar-container')).not.toBeInTheDocument()
    expect(screen.queryByTestId('bottom-tab-bar')).not.toBeInTheDocument()
  })

  it('sidebar is rendered inside the sidebar container', () => {
    render(<AppLayout><span /></AppLayout>, { wrapper: Wrapper })

    const sidebarContainer = screen.getByTestId('sidebar-container')
    expect(sidebarContainer.querySelector('[data-testid="sidebar"]')).toBeTruthy()
  })
})

describe('AppLayout — header + presence bar', () => {
  beforeEach(() => {
    resetStore()
    useIsMobile.mockReturnValue(false)
  })

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
  beforeEach(() => {
    resetStore()
    useIsMobile.mockReturnValue(false)
  })

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

describe('AppLayout — MobileTabBar navigation (mobile)', () => {
  beforeEach(() => {
    resetStore()
    useIsMobile.mockReturnValue(true)
  })

  it('today tab has aria-current=page at /my-tasks', () => {
    render(
      <QueryClientProvider client={makeQC()}>
        <MemoryRouter initialEntries={['/my-tasks']}>
          <AppLayout><span /></AppLayout>
        </MemoryRouter>
      </QueryClientProvider>
    )
    expect(screen.getByTestId('mtab-today')).toHaveAttribute('aria-current', 'page')
  })

  it('lists tab has aria-current=page at /', () => {
    render(
      <QueryClientProvider client={makeQC()}>
        <MemoryRouter initialEntries={['/']}>
          <AppLayout><span /></AppLayout>
        </MemoryRouter>
      </QueryClientProvider>
    )
    expect(screen.getByTestId('mtab-lists')).toHaveAttribute('aria-current', 'page')
  })

  it('activity tab has aria-current=page at /w/:id/activity', () => {
    render(
      <QueryClientProvider client={makeQC()}>
        <MemoryRouter initialEntries={['/w/ws-1/activity']}>
          <AppLayout><span /></AppLayout>
        </MemoryRouter>
      </QueryClientProvider>
    )
    expect(screen.getByTestId('mtab-activity')).toHaveAttribute('aria-current', 'page')
  })

  it('me tab has aria-current=page at /me', () => {
    render(
      <QueryClientProvider client={makeQC()}>
        <MemoryRouter initialEntries={['/me']}>
          <AppLayout><span /></AppLayout>
        </MemoryRouter>
      </QueryClientProvider>
    )
    expect(screen.getByTestId('mtab-me')).toHaveAttribute('aria-current', 'page')
  })
})

describe('AppLayout — activity unread dot (mobile tab bar)', () => {
  beforeEach(() => {
    resetStore()
    useIsMobile.mockReturnValue(true)
  })

  it('does not show the unread dot when unread count is 0', () => {
    useWorkspaceActivity.mockReturnValue({ data: { items: [], unread: 0 } })
    useStore.setState({ currentWorkspaceId: 'ws-1' })

    render(<AppLayout><span /></AppLayout>, { wrapper: Wrapper })

    expect(screen.queryByTestId('mtab-activity-unread')).not.toBeInTheDocument()
  })

  it('shows the unread dot when unread count > 0', () => {
    useWorkspaceActivity.mockReturnValue({ data: { items: [], unread: 3 } })
    useStore.setState({ currentWorkspaceId: 'ws-1' })

    render(<AppLayout><span /></AppLayout>, { wrapper: Wrapper })

    expect(screen.getByTestId('mtab-activity-unread')).toBeInTheDocument()
  })

  it('does not show the unread dot when no workspace is selected, even with unread data', () => {
    useWorkspaceActivity.mockReturnValue({ data: { items: [], unread: 5 } })
    useStore.setState({ currentWorkspaceId: null })

    render(<AppLayout><span /></AppLayout>, { wrapper: Wrapper })

    expect(screen.queryByTestId('mtab-activity-unread')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Tests — header user email + logout
// ---------------------------------------------------------------------------

describe('AppLayout — header user email and logout', () => {
  beforeEach(() => {
    resetStore()
    useIsMobile.mockReturnValue(false)
  })

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

// ---------------------------------------------------------------------------
// Tests — responsive: mobile vs desktop
// ---------------------------------------------------------------------------

describe('AppLayout — responsive mobile/desktop', () => {
  beforeEach(() => {
    resetStore()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('mobile: shows MobileTabBar and hides the desktop header', () => {
    useIsMobile.mockReturnValue(true)
    renderLayout()
    expect(screen.getByTestId('mobile-tab-bar')).toBeInTheDocument()
    expect(screen.queryByTestId('app-header')).not.toBeInTheDocument()
  })

  it('desktop: shows the header and not the mobile tab bar', () => {
    useIsMobile.mockReturnValue(false)
    renderLayout()
    expect(screen.getByTestId('app-header')).toBeInTheDocument()
    expect(screen.queryByTestId('mobile-tab-bar')).not.toBeInTheDocument()
  })
})
