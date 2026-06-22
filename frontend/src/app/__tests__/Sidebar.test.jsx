import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// ---------------------------------------------------------------------------
// Mock api hooks before importing the component.
// useWorkspaces and useCreateWorkspace are used by WorkspaceSwitcher (rendered
// inside Sidebar). useProjects is used directly by Sidebar.
// ---------------------------------------------------------------------------
vi.mock('../../lib/api.js', () => ({
  useWorkspaces: vi.fn(),
  useCreateWorkspace: vi.fn(),
  useProjects: vi.fn(),
}))

import { useWorkspaces, useCreateWorkspace, useProjects } from '../../lib/api.js'
import { useStore } from '../../lib/store.js'
import { Sidebar } from '../Sidebar.jsx'

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
describe('Sidebar — workspaces (via WorkspaceSwitcher)', () => {
  beforeEach(() => {
    resetStore()
    useProjects.mockReturnValue({ data: [], isLoading: false })
    useCreateWorkspace.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    })
  })

  it('renders a list of workspaces', () => {
    useWorkspaces.mockReturnValue({
      data: [
        { id: 1, name: 'Design Team', role: 'owner' },
        { id: 2, name: 'Engineering', role: 'member' },
      ],
      isLoading: false,
    })

    render(<Sidebar />, { wrapper: Wrapper })

    expect(screen.getByText('Design Team')).toBeInTheDocument()
    expect(screen.getByText('Engineering')).toBeInTheDocument()
  })

  it('shows loading state while workspaces load', () => {
    useWorkspaces.mockReturnValue({ data: [], isLoading: true })

    render(<Sidebar />, { wrapper: Wrapper })

    expect(screen.getAllByText('Loading…').length).toBeGreaterThan(0)
  })

  it('shows empty state when no workspaces', () => {
    useWorkspaces.mockReturnValue({ data: [], isLoading: false })

    render(<Sidebar />, { wrapper: Wrapper })

    expect(screen.getByText('No workspaces')).toBeInTheDocument()
  })

  it('clicking a workspace calls setCurrentWorkspace via the store', () => {
    useWorkspaces.mockReturnValue({
      data: [{ id: 42, name: 'My Workspace', role: 'owner' }],
      isLoading: false,
    })

    render(<Sidebar />, { wrapper: Wrapper })

    // WorkspaceSwitcher uses data-testid="workspace-item-{id}"
    fireEvent.click(screen.getByTestId('workspace-item-42'))

    expect(useStore.getState().currentWorkspaceId).toBe(42)
  })

  it('highlights the active workspace with aria-current', () => {
    useStore.setState({ currentWorkspaceId: 7 })
    useWorkspaces.mockReturnValue({
      data: [
        { id: 7, name: 'Active WS', role: 'owner' },
        { id: 8, name: 'Other WS', role: 'member' },
      ],
      isLoading: false,
    })

    render(<Sidebar />, { wrapper: Wrapper })

    const activeBtn = screen.getByTestId('workspace-item-7')
    const inactiveBtn = screen.getByTestId('workspace-item-8')

    expect(activeBtn).toHaveAttribute('aria-current', 'page')
    expect(inactiveBtn).not.toHaveAttribute('aria-current')
  })

  it('applies the active class only to the current workspace', () => {
    useStore.setState({ currentWorkspaceId: 1 })
    useWorkspaces.mockReturnValue({
      data: [
        { id: 1, name: 'WS One', role: 'owner' },
        { id: 2, name: 'WS Two', role: 'member' },
      ],
      isLoading: false,
    })

    render(<Sidebar />, { wrapper: Wrapper })

    expect(screen.getByTestId('workspace-item-1').className).toContain('bg-primary')
    expect(screen.getByTestId('workspace-item-2').className).not.toContain('bg-primary')
  })
})

describe('Sidebar — projects', () => {
  beforeEach(() => {
    resetStore()
    useStore.setState({ currentWorkspaceId: 5 })
    useCreateWorkspace.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    })
    useWorkspaces.mockReturnValue({
      data: [{ id: 5, name: 'My WS', role: 'owner' }],
      isLoading: false,
    })
  })

  it('renders projects for the current workspace', () => {
    useProjects.mockReturnValue({
      data: [
        { id: 'p1', name: 'Alpha' },
        { id: 'p2', name: 'Beta' },
      ],
      isLoading: false,
    })

    render(<Sidebar />, { wrapper: Wrapper })

    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
  })

  it('prompts to select a workspace when none is selected', () => {
    useStore.setState({ currentWorkspaceId: null })
    useProjects.mockReturnValue({ data: [], isLoading: false })

    render(<Sidebar />, { wrapper: Wrapper })

    expect(screen.getByText('Select a workspace')).toBeInTheDocument()
  })

  it('clicking a project calls setCurrentProject via the store', () => {
    useProjects.mockReturnValue({
      data: [{ id: 'proj-99', name: 'Big Project' }],
      isLoading: false,
    })

    render(<Sidebar />, { wrapper: Wrapper })

    fireEvent.click(screen.getByTestId('project-proj-99'))

    expect(useStore.getState().currentProjectId).toBe('proj-99')
  })
})
