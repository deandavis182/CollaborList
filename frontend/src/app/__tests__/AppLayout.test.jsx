import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
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
}))

import { useStore } from '../../lib/store.js'
import { AppLayout } from '../AppLayout.jsx'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

function Wrapper({ children }) {
  return (
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter>{children}</MemoryRouter>
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

describe('AppLayout — detail sheet', () => {
  beforeEach(resetStore)

  it('does not show a dialog when detailItemId is null', () => {
    render(<AppLayout><span /></AppLayout>, { wrapper: Wrapper })

    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('shows a dialog when detailItemId is set', () => {
    useStore.setState({ detailItemId: 'item-123' })

    render(<AppLayout><span /></AppLayout>, { wrapper: Wrapper })

    // Sheet renders a role="dialog" element
    expect(screen.queryAllByRole('dialog').length).toBeGreaterThan(0)
  })
})
