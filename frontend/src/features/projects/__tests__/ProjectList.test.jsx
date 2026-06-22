import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// ---------------------------------------------------------------------------
// Mock api and store before importing the component
// ---------------------------------------------------------------------------
vi.mock('../../../lib/api.js', () => ({
  useProjects: vi.fn(),
  useCreateProject: vi.fn(),
}))

import { useProjects, useCreateProject } from '../../../lib/api.js'
import { useStore } from '../../../lib/store.js'
import { ProjectList } from '../ProjectList.jsx'

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
describe('ProjectList', () => {
  beforeEach(() => {
    resetStore()
    useCreateProject.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    })
  })

  it('shows "Select a workspace" when no workspace is selected', () => {
    useProjects.mockReturnValue({ data: [], isLoading: false })
    useStore.setState({ currentWorkspaceId: null })

    render(<ProjectList />, { wrapper: Wrapper })

    expect(screen.getByText('Select a workspace')).toBeInTheDocument()
  })

  it('shows loading state while projects are loading', () => {
    useProjects.mockReturnValue({ data: [], isLoading: true })
    useStore.setState({ currentWorkspaceId: 5 })

    render(<ProjectList />, { wrapper: Wrapper })

    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('shows empty state when there are no projects', () => {
    useProjects.mockReturnValue({ data: [], isLoading: false })
    useStore.setState({ currentWorkspaceId: 5 })

    render(<ProjectList />, { wrapper: Wrapper })

    expect(screen.getByText('No projects')).toBeInTheDocument()
  })

  it('renders all project names', () => {
    useProjects.mockReturnValue({
      data: [
        { id: 'p1', name: 'Alpha Project' },
        { id: 'p2', name: 'Beta Project' },
      ],
      isLoading: false,
    })
    useStore.setState({ currentWorkspaceId: 5 })

    render(<ProjectList />, { wrapper: Wrapper })

    expect(screen.getByText('Alpha Project')).toBeInTheDocument()
    expect(screen.getByText('Beta Project')).toBeInTheDocument()
  })

  it('marks the active project with aria-current="page"', () => {
    useProjects.mockReturnValue({
      data: [
        { id: 'p1', name: 'Alpha' },
        { id: 'p2', name: 'Beta' },
      ],
      isLoading: false,
    })
    useStore.setState({ currentWorkspaceId: 5, currentProjectId: 'p1' })

    render(<ProjectList />, { wrapper: Wrapper })

    expect(screen.getByTestId('project-item-p1')).toHaveAttribute('aria-current', 'page')
    expect(screen.getByTestId('project-item-p2')).not.toHaveAttribute('aria-current')
  })

  it('inactive project does not have aria-current', () => {
    useProjects.mockReturnValue({
      data: [{ id: 'p1', name: 'Alpha' }],
      isLoading: false,
    })
    useStore.setState({ currentWorkspaceId: 5, currentProjectId: null })

    render(<ProjectList />, { wrapper: Wrapper })

    expect(screen.getByTestId('project-item-p1')).not.toHaveAttribute('aria-current')
  })

  it('clicking a project calls setCurrentProject via the store', () => {
    useProjects.mockReturnValue({
      data: [{ id: 'proj-42', name: 'My Project' }],
      isLoading: false,
    })
    useStore.setState({ currentWorkspaceId: 5 })

    render(<ProjectList />, { wrapper: Wrapper })

    fireEvent.click(screen.getByTestId('project-item-proj-42'))

    expect(useStore.getState().currentProjectId).toBe('proj-42')
  })

  it('project items link to /w/:workspaceId/p/:projectId', () => {
    useProjects.mockReturnValue({
      data: [{ id: 'p99', name: 'Linked Project' }],
      isLoading: false,
    })
    useStore.setState({ currentWorkspaceId: 7 })

    render(<ProjectList />, { wrapper: Wrapper })

    const link = screen.getByTestId('project-item-p99')
    expect(link).toHaveAttribute('href', '/w/7/p/p99')
  })

  it('renders a "+ New project" button', () => {
    useProjects.mockReturnValue({ data: [], isLoading: false })
    useStore.setState({ currentWorkspaceId: 5 })

    render(<ProjectList />, { wrapper: Wrapper })

    expect(screen.getByRole('button', { name: /new project/i })).toBeInTheDocument()
  })

  it('clicking "+ New project" opens the create dialog', () => {
    useProjects.mockReturnValue({ data: [], isLoading: false })
    useStore.setState({ currentWorkspaceId: 5 })

    render(<ProjectList />, { wrapper: Wrapper })

    fireEvent.click(screen.getByRole('button', { name: /new project/i }))

    // CreateProjectDialog renders a dialog role when open
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
