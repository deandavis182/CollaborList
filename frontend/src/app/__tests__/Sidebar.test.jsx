import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// ---------------------------------------------------------------------------
// Mock api hooks before importing the component.
// useWorkspaces and useCreateWorkspace are used by WorkspaceSwitcher (rendered
// inside Sidebar). useProjects is used directly by Sidebar.
// useWorkspaceActivity is used by Sidebar to show the unread dot.
// ---------------------------------------------------------------------------
vi.mock('../../lib/api.js', () => ({
  useWorkspaces: vi.fn(),
  useCreateWorkspace: vi.fn(),
  useProjects: vi.fn(),
  useCreateProject: vi.fn(),
  useWorkspaceActivity: vi.fn(),
  useProjectLists: vi.fn(),
  useCreateList: vi.fn(),
}))

import {
  useWorkspaces,
  useCreateWorkspace,
  useProjects,
  useCreateProject,
  useWorkspaceActivity,
  useProjectLists,
  useCreateList,
} from '../../lib/api.js'
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
    useWorkspaceActivity.mockReturnValue({ data: { items: [], unread: 0 } })
    useProjectLists.mockReturnValue({ data: [], isLoading: false })
    useCreateList.mockReturnValue({ mutate: vi.fn() })
    useCreateWorkspace.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    })
    useCreateProject.mockReturnValue({
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

describe('Sidebar — My Tasks nav link', () => {
  beforeEach(() => {
    resetStore()
    useWorkspaces.mockReturnValue({ data: [], isLoading: false })
    useProjects.mockReturnValue({ data: [], isLoading: false })
    useWorkspaceActivity.mockReturnValue({ data: { items: [], unread: 0 } })
    useProjectLists.mockReturnValue({ data: [], isLoading: false })
    useCreateList.mockReturnValue({ mutate: vi.fn() })
    useCreateWorkspace.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    })
    useCreateProject.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    })
  })

  it('renders the My Tasks nav link', () => {
    render(<Sidebar />, { wrapper: Wrapper })
    expect(screen.getByTestId('nav-my-tasks')).toBeInTheDocument()
  })

  it('My Tasks link points to /my-tasks', () => {
    render(<Sidebar />, { wrapper: Wrapper })
    const link = screen.getByTestId('nav-my-tasks')
    expect(link).toHaveAttribute('href', '/my-tasks')
  })

  it('My Tasks link has text "My Tasks"', () => {
    render(<Sidebar />, { wrapper: Wrapper })
    expect(screen.getByTestId('nav-my-tasks')).toHaveTextContent('My Tasks')
  })
})

describe('Sidebar — projects', () => {
  beforeEach(() => {
    resetStore()
    useStore.setState({ currentWorkspaceId: 5 })
    useWorkspaceActivity.mockReturnValue({ data: { items: [], unread: 0 } })
    useProjectLists.mockReturnValue({ data: [], isLoading: false })
    useCreateList.mockReturnValue({ mutate: vi.fn() })
    useCreateWorkspace.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    })
    useCreateProject.mockReturnValue({
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

    fireEvent.click(screen.getByTestId('project-item-proj-99'))

    expect(useStore.getState().currentProjectId).toBe('proj-99')
  })
})

// ---------------------------------------------------------------------------
// Sidebar — Activity nav link + unread dot
// ---------------------------------------------------------------------------

describe('Sidebar — Activity nav link', () => {
  const WORKSPACE_ID = 'ws-42'

  function setupBase() {
    resetStore()
    useWorkspaces.mockReturnValue({ data: [], isLoading: false })
    useProjects.mockReturnValue({ data: [], isLoading: false })
    useProjectLists.mockReturnValue({ data: [], isLoading: false })
    useCreateList.mockReturnValue({ mutate: vi.fn() })
    useCreateWorkspace.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    })
    useCreateProject.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    })
  }

  it('renders the Activity nav link', () => {
    setupBase()
    useWorkspaceActivity.mockReturnValue({ data: { items: [], unread: 0 } })

    render(<Sidebar />, { wrapper: Wrapper })
    expect(screen.getByTestId('nav-activity')).toBeInTheDocument()
  })

  it('Activity link does NOT point to a workspace activity URL when no workspace is selected', () => {
    setupBase()
    useStore.setState({ currentWorkspaceId: null })
    useWorkspaceActivity.mockReturnValue({ data: undefined })

    render(<Sidebar />, { wrapper: Wrapper })
    const link = screen.getByTestId('nav-activity')
    // When no workspace is selected the link goes to '#' (resolved by MemoryRouter as '/');
    // it should NOT contain '/activity' (which would indicate a real workspace URL)
    expect(link.getAttribute('href')).not.toContain('/activity')
  })

  it('Activity link points to /w/:id/activity when currentWorkspaceId is set', () => {
    setupBase()
    useStore.setState({ currentWorkspaceId: WORKSPACE_ID })
    useWorkspaceActivity.mockReturnValue({ data: { items: [], unread: 3 } })

    render(<Sidebar />, { wrapper: Wrapper })
    const link = screen.getByTestId('nav-activity')
    expect(link).toHaveAttribute('href', `/w/${WORKSPACE_ID}/activity`)
  })

  it('shows unread dot when unread > 0', () => {
    setupBase()
    useStore.setState({ currentWorkspaceId: WORKSPACE_ID })
    useWorkspaceActivity.mockReturnValue({ data: { items: [], unread: 3 } })

    render(<Sidebar />, { wrapper: Wrapper })
    expect(screen.getByTestId('activity-unread-dot')).toBeInTheDocument()
  })

  it('does NOT show unread dot when unread === 0', () => {
    setupBase()
    useStore.setState({ currentWorkspaceId: WORKSPACE_ID })
    useWorkspaceActivity.mockReturnValue({ data: { items: [], unread: 0 } })

    render(<Sidebar />, { wrapper: Wrapper })
    expect(screen.queryByTestId('activity-unread-dot')).not.toBeInTheDocument()
  })

  it('does NOT show unread dot when activity data is undefined', () => {
    setupBase()
    useStore.setState({ currentWorkspaceId: WORKSPACE_ID })
    useWorkspaceActivity.mockReturnValue({ data: undefined })

    render(<Sidebar />, { wrapper: Wrapper })
    expect(screen.queryByTestId('activity-unread-dot')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Sidebar — nested list tree (ProjectListTree)
// ---------------------------------------------------------------------------

describe('Sidebar — nested list tree under active project', () => {
  const WS_ID = 10
  const PROJ_ID = 'proj-A'

  function setupBase() {
    resetStore()
    useStore.setState({ currentWorkspaceId: WS_ID, currentProjectId: PROJ_ID })
    useWorkspaces.mockReturnValue({
      data: [{ id: WS_ID, name: 'My WS', role: 'owner' }],
      isLoading: false,
    })
    useWorkspaceActivity.mockReturnValue({ data: { items: [], unread: 0 } })
    useCreateWorkspace.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null })
    useCreateProject.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null })
    useCreateList.mockReturnValue({ mutate: vi.fn() })
  }

  it('renders nested list links under the active project', () => {
    useProjects.mockReturnValue({
      data: [{ id: PROJ_ID, name: 'Alpha' }],
      isLoading: false,
    })
    useProjectLists.mockReturnValue({
      data: [
        { id: 'l1', name: 'Sprint 1' },
        { id: 'l2', name: 'Backlog' },
      ],
      isLoading: false,
    })
    setupBase()

    render(<Sidebar />, { wrapper: Wrapper })

    expect(screen.getByTestId('sidebar-list-l1')).toBeInTheDocument()
    expect(screen.getByTestId('sidebar-list-l2')).toBeInTheDocument()
    expect(screen.getByText('Sprint 1')).toBeInTheDocument()
    expect(screen.getByText('Backlog')).toBeInTheDocument()
  })

  it('list links point to /w/:wsId/p/:projId/l/:listId', () => {
    useProjects.mockReturnValue({
      data: [{ id: PROJ_ID, name: 'Alpha' }],
      isLoading: false,
    })
    useProjectLists.mockReturnValue({
      data: [{ id: 'l99', name: 'My List' }],
      isLoading: false,
    })
    setupBase()

    render(<Sidebar />, { wrapper: Wrapper })

    const link = screen.getByTestId('sidebar-list-l99')
    expect(link).toHaveAttribute('href', `/w/${WS_ID}/p/${PROJ_ID}/l/l99`)
  })

  it('does NOT render list links when no project is active', () => {
    useProjects.mockReturnValue({
      data: [{ id: PROJ_ID, name: 'Alpha' }],
      isLoading: false,
    })
    useProjectLists.mockReturnValue({
      data: [{ id: 'l1', name: 'Sprint 1' }],
      isLoading: false,
    })
    setupBase()
    useStore.setState({ currentProjectId: null })

    render(<Sidebar />, { wrapper: Wrapper })

    expect(screen.queryByTestId('sidebar-list-l1')).not.toBeInTheDocument()
  })

  it('shows "No lists yet" hint when active project has no lists', () => {
    useProjects.mockReturnValue({
      data: [{ id: PROJ_ID, name: 'Alpha' }],
      isLoading: false,
    })
    useProjectLists.mockReturnValue({ data: [], isLoading: false })
    setupBase()

    render(<Sidebar />, { wrapper: Wrapper })

    expect(screen.getByTestId('no-lists-hint')).toBeInTheDocument()
    expect(screen.getByText('No lists yet')).toBeInTheDocument()
  })

  it('shows "+ New list" button and clicking it reveals the inline input', () => {
    useProjects.mockReturnValue({
      data: [{ id: PROJ_ID, name: 'Alpha' }],
      isLoading: false,
    })
    useProjectLists.mockReturnValue({ data: [], isLoading: false })
    setupBase()

    render(<Sidebar />, { wrapper: Wrapper })

    // The button starts as the "New list" trigger
    const newListBtn = screen.getByTestId('sidebar-new-list-button')
    expect(newListBtn).toBeInTheDocument()
    fireEvent.click(newListBtn)

    // After click, the inline input should appear
    expect(screen.getByTestId('sidebar-new-list-input')).toBeInTheDocument()
  })

  it('pressing Enter in the new-list input calls createList.mutate with the name', () => {
    const mutateMock = vi.fn()
    // setupBase must run first — it sets useCreateList to a generic stub;
    // we then override with our tracked mock after.
    useProjects.mockReturnValue({
      data: [{ id: PROJ_ID, name: 'Alpha' }],
      isLoading: false,
    })
    useProjectLists.mockReturnValue({ data: [], isLoading: false })
    setupBase()
    useCreateList.mockReturnValue({ mutate: mutateMock })

    render(<Sidebar />, { wrapper: Wrapper })

    fireEvent.click(screen.getByTestId('sidebar-new-list-button'))
    const input = screen.getByTestId('sidebar-new-list-input')
    fireEvent.change(input, { target: { value: 'Design Assets' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(mutateMock).toHaveBeenCalledWith({ name: 'Design Assets' })
  })

  it('active project is marked with aria-current and indented (project-item testid preserved)', () => {
    useProjects.mockReturnValue({
      data: [
        { id: PROJ_ID, name: 'Alpha' },
        { id: 'proj-B', name: 'Beta' },
      ],
      isLoading: false,
    })
    useProjectLists.mockReturnValue({ data: [], isLoading: false })
    setupBase()

    render(<Sidebar />, { wrapper: Wrapper })

    expect(screen.getByTestId(`project-item-${PROJ_ID}`)).toHaveAttribute('aria-current', 'page')
    expect(screen.getByTestId('project-item-proj-B')).not.toHaveAttribute('aria-current')
  })

  it('My Tasks + Activity nav links remain present (no regression)', () => {
    useProjects.mockReturnValue({ data: [], isLoading: false })
    useProjectLists.mockReturnValue({ data: [], isLoading: false })
    setupBase()

    render(<Sidebar />, { wrapper: Wrapper })

    expect(screen.getByTestId('nav-my-tasks')).toBeInTheDocument()
    expect(screen.getByTestId('nav-activity')).toBeInTheDocument()
  })

  it('WorkspaceSwitcher remains present (no regression)', () => {
    useProjects.mockReturnValue({ data: [], isLoading: false })
    useProjectLists.mockReturnValue({ data: [], isLoading: false })
    setupBase()

    render(<Sidebar />, { wrapper: Wrapper })

    expect(screen.getByTestId('workspace-switcher')).toBeInTheDocument()
  })
})
