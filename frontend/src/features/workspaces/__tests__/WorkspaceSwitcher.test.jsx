import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// ---------------------------------------------------------------------------
// Mock api and store before importing the component
// ---------------------------------------------------------------------------
vi.mock('../../../lib/api.js', () => ({
  useWorkspaces: vi.fn(),
  useCreateWorkspace: vi.fn(),
}))

import { useWorkspaces, useCreateWorkspace } from '../../../lib/api.js'
import { useStore } from '../../../lib/store.js'
import { WorkspaceSwitcher } from '../WorkspaceSwitcher.jsx'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

function Wrapper({ children }) {
  return (
    <QueryClientProvider client={makeQC()}>
      {children}
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
describe('WorkspaceSwitcher', () => {
  beforeEach(() => {
    resetStore()
    useCreateWorkspace.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    })
  })

  it('renders all workspace names from useWorkspaces', () => {
    useWorkspaces.mockReturnValue({
      data: [
        { id: 1, name: 'Design Team', role: 'owner' },
        { id: 2, name: 'Engineering', role: 'member' },
      ],
      isLoading: false,
    })

    render(<WorkspaceSwitcher />, { wrapper: Wrapper })

    expect(screen.getByText('Design Team')).toBeInTheDocument()
    expect(screen.getByText('Engineering')).toBeInTheDocument()
  })

  it('marks the active workspace (from store) with aria-current', () => {
    useStore.setState({ currentWorkspaceId: 1 })
    useWorkspaces.mockReturnValue({
      data: [
        { id: 1, name: 'Active WS', role: 'owner' },
        { id: 2, name: 'Other WS', role: 'member' },
      ],
      isLoading: false,
    })

    render(<WorkspaceSwitcher />, { wrapper: Wrapper })

    expect(screen.getByTestId('workspace-item-1')).toHaveAttribute('aria-current', 'page')
    expect(screen.getByTestId('workspace-item-2')).not.toHaveAttribute('aria-current')
  })

  it('clicking a workspace calls setCurrentWorkspace with that id', () => {
    useWorkspaces.mockReturnValue({
      data: [{ id: 42, name: 'My Workspace', role: 'owner' }],
      isLoading: false,
    })

    render(<WorkspaceSwitcher />, { wrapper: Wrapper })

    fireEvent.click(screen.getByTestId('workspace-item-42'))

    expect(useStore.getState().currentWorkspaceId).toBe(42)
  })

  it('shows loading state while workspaces are loading', () => {
    useWorkspaces.mockReturnValue({ data: [], isLoading: true })

    render(<WorkspaceSwitcher />, { wrapper: Wrapper })

    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('shows empty state when there are no workspaces', () => {
    useWorkspaces.mockReturnValue({ data: [], isLoading: false })

    render(<WorkspaceSwitcher />, { wrapper: Wrapper })

    expect(screen.getByText(/no workspaces/i)).toBeInTheDocument()
  })

  it('renders a "+ New workspace" action button', () => {
    useWorkspaces.mockReturnValue({ data: [], isLoading: false })

    render(<WorkspaceSwitcher />, { wrapper: Wrapper })

    expect(screen.getByRole('button', { name: /new workspace/i })).toBeInTheDocument()
  })

  it('clicking "+ New workspace" opens the create dialog', () => {
    useWorkspaces.mockReturnValue({ data: [], isLoading: false })

    render(<WorkspaceSwitcher />, { wrapper: Wrapper })

    fireEvent.click(screen.getByRole('button', { name: /new workspace/i }))

    // The CreateWorkspaceDialog should now be open (rendered as a dialog role)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
