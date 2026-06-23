import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// ---------------------------------------------------------------------------
// Mock api before importing the component
// ---------------------------------------------------------------------------

const mutateMock = vi.fn()

vi.mock('../../../lib/api.js', () => ({
  useProjectLists:      vi.fn(),
  useCreateList:        vi.fn(),
  useRenameList:        vi.fn(),
  useDeleteList:        vi.fn(),
  useProjectItems:      vi.fn(),
  useProjects:          vi.fn(),
  useWorkspaceMembers:  vi.fn(),
}))

// ---------------------------------------------------------------------------
// Mock ViewContainer — expose items count so we can assert roll-up feeds it
// ---------------------------------------------------------------------------
vi.mock('../../views/ViewContainer.jsx', () => ({
  ViewContainer: (props) => (
    <div
      data-testid="view-container"
      data-items-count={props.items ? props.items.length : 0}
      data-scope-key={props.scopeKey}
    >
      view-container-mock
    </div>
  ),
}))

import {
  useProjectLists,
  useCreateList,
  useRenameList,
  useDeleteList,
  useProjectItems,
  useProjects,
  useWorkspaceMembers,
} from '../../../lib/api.js'
import { ProjectView } from '../ProjectView.jsx'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

/**
 * Render ProjectView at a URL with :projectId param available.
 */
function renderAt(projectId) {
  return render(
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter initialEntries={[`/w/ws-1/p/${projectId}`]}>
        <Routes>
          <Route path="/w/:workspaceId/p/:projectId" element={<ProjectView />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('ProjectView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default stubs for mutation hooks — tests override as needed
    mutateMock.mockReset()
    useCreateList.mockReturnValue({ mutate: mutateMock })
    useRenameList.mockReturnValue({ mutate: mutateMock })
    useDeleteList.mockReturnValue({ mutate: mutateMock })
    // Default stubs for new roll-up hooks
    useProjectItems.mockReturnValue({ data: [], isLoading: false })
    useProjects.mockReturnValue({ data: [] })
    useWorkspaceMembers.mockReturnValue({ data: [] })
  })

  it('renders the project-view container', () => {
    useProjectLists.mockReturnValue({ data: [], isLoading: false })

    renderAt('proj-1')

    expect(screen.getByTestId('project-view')).toBeInTheDocument()
  })

  it('shows loading state while lists are loading', () => {
    useProjectLists.mockReturnValue({ data: [], isLoading: true })

    renderAt('proj-1')

    expect(screen.getByTestId('project-view-loading')).toBeInTheDocument()
  })

  it('shows empty state when there are no lists', () => {
    useProjectLists.mockReturnValue({ data: [], isLoading: false })

    renderAt('proj-1')

    expect(screen.getByTestId('project-view-empty')).toBeInTheDocument()
  })

  it('renders list cards for each list in the project', () => {
    useProjectLists.mockReturnValue({
      data: [
        { id: 'l1', name: 'Guest List' },
        { id: 'l2', name: 'Vendor List' },
      ],
      isLoading: false,
    })

    renderAt('proj-1')

    expect(screen.getByText('Guest List')).toBeInTheDocument()
    expect(screen.getByText('Vendor List')).toBeInTheDocument()
  })

  it('renders a Card for each list (data-testid=list-card-{id})', () => {
    useProjectLists.mockReturnValue({
      data: [
        { id: 'l1', name: 'Guest List' },
        { id: 'l2', name: 'Vendor List' },
      ],
      isLoading: false,
    })

    renderAt('proj-1')

    expect(screen.getByTestId('list-card-l1')).toBeInTheDocument()
    expect(screen.getByTestId('list-card-l2')).toBeInTheDocument()
  })

  it('shows item_count when provided', () => {
    useProjectLists.mockReturnValue({
      data: [{ id: 'l1', name: 'Guest List', item_count: 42 }],
      isLoading: false,
    })

    renderAt('proj-1')

    expect(screen.getByText('42 items')).toBeInTheDocument()
  })

  it('shows singular "item" for item_count of 1', () => {
    useProjectLists.mockReturnValue({
      data: [{ id: 'l1', name: 'Solo List', item_count: 1 }],
      isLoading: false,
    })

    renderAt('proj-1')

    expect(screen.getByText('1 item')).toBeInTheDocument()
  })

  it('does not render item_count when undefined', () => {
    useProjectLists.mockReturnValue({
      data: [{ id: 'l1', name: 'No Count List' }],
      isLoading: false,
    })

    renderAt('proj-1')

    // Should not show any "items" text
    expect(screen.queryByText(/\d+ items?/)).not.toBeInTheDocument()
  })

  it('calls useProjectLists with the projectId from params', () => {
    useProjectLists.mockReturnValue({ data: [], isLoading: false })

    renderAt('my-project-id')

    expect(useProjectLists).toHaveBeenCalledWith('my-project-id')
  })

  it('does NOT include the "coming in Phase 3" note (items are now editable in this shell)', () => {
    useProjectLists.mockReturnValue({ data: [], isLoading: false })

    renderAt('proj-1')

    expect(screen.queryByText(/coming in Phase 3/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /current app/i })).not.toBeInTheDocument()
  })

  it('renders each list card as a link to the list route', () => {
    useProjectLists.mockReturnValue({
      data: [
        { id: 'l1', name: 'Guest List' },
        { id: 'l2', name: 'Vendor List' },
      ],
      isLoading: false,
    })

    renderAt('proj-1')

    // Each Card should be wrapped in a Link → <a href="/w/ws-1/p/proj-1/l/{id}">
    const links = screen.getAllByRole('link')
    const hrefs = links.map((l) => l.getAttribute('href'))
    expect(hrefs).toContain('/w/ws-1/p/proj-1/l/l1')
    expect(hrefs).toContain('/w/ws-1/p/proj-1/l/l2')
  })

  // ---------------------------------------------------------------------------
  // New list creation
  // ---------------------------------------------------------------------------

  it('renders the new-list input and button', () => {
    useProjectLists.mockReturnValue({ data: [], isLoading: false })

    renderAt('proj-1')

    expect(screen.getByTestId('new-list-input')).toBeInTheDocument()
    expect(screen.getByTestId('new-list-button')).toBeInTheDocument()
  })

  it('submitting the new-list form calls useCreateList.mutate with the name', () => {
    useProjectLists.mockReturnValue({ data: [], isLoading: false })

    const createMutate = vi.fn()
    useCreateList.mockReturnValue({ mutate: createMutate })

    renderAt('proj-1')

    const input = screen.getByTestId('new-list-input')
    fireEvent.change(input, { target: { value: 'My New List' } })
    fireEvent.submit(input.closest('form'))

    expect(createMutate).toHaveBeenCalledWith({ name: 'My New List' })
  })

  it('clears the input after submitting a new list name', () => {
    useProjectLists.mockReturnValue({ data: [], isLoading: false })

    const createMutate = vi.fn()
    useCreateList.mockReturnValue({ mutate: createMutate })

    renderAt('proj-1')

    const input = screen.getByTestId('new-list-input')
    fireEvent.change(input, { target: { value: 'Sprint 1' } })
    fireEvent.submit(input.closest('form'))

    expect(input.value).toBe('')
  })

  it('does not call mutate when the name is empty or whitespace', () => {
    useProjectLists.mockReturnValue({ data: [], isLoading: false })

    const createMutate = vi.fn()
    useCreateList.mockReturnValue({ mutate: createMutate })

    renderAt('proj-1')

    const input = screen.getByTestId('new-list-input')
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.submit(input.closest('form'))

    expect(createMutate).not.toHaveBeenCalled()
  })

  // ---------------------------------------------------------------------------
  // Empty state CTA
  // ---------------------------------------------------------------------------

  it('empty state includes the new-list create control', () => {
    useProjectLists.mockReturnValue({ data: [], isLoading: false })

    renderAt('proj-1')

    expect(screen.getByTestId('project-view-empty')).toBeInTheDocument()
    // The new-list input is always visible (not hidden in empty state)
    expect(screen.getByTestId('new-list-input')).toBeInTheDocument()
  })

  it('empty state shows a friendly CTA message', () => {
    useProjectLists.mockReturnValue({ data: [], isLoading: false })

    renderAt('proj-1')

    expect(screen.getByTestId('project-view-empty')).toHaveTextContent(/No lists yet/i)
  })

  // ---------------------------------------------------------------------------
  // Per-list Delete control
  // ---------------------------------------------------------------------------

  it('renders a delete control for each list card', () => {
    useProjectLists.mockReturnValue({
      data: [
        { id: 'l1', name: 'Guest List' },
        { id: 'l2', name: 'Vendor List' },
      ],
      isLoading: false,
    })

    renderAt('proj-1')

    expect(screen.getByTestId('delete-list-l1')).toBeInTheDocument()
    expect(screen.getByTestId('delete-list-l2')).toBeInTheDocument()
  })

  it('clicking delete once shows a confirm state (two-step delete)', () => {
    useProjectLists.mockReturnValue({
      data: [{ id: 'l1', name: 'Guest List' }],
      isLoading: false,
    })

    const deleteMutate = vi.fn()
    useDeleteList.mockReturnValue({ mutate: deleteMutate })

    renderAt('proj-1')

    const deleteBtn = screen.getByTestId('delete-list-l1')
    fireEvent.click(deleteBtn)

    // After first click, should NOT have called mutate yet (two-step confirmation)
    expect(deleteMutate).not.toHaveBeenCalled()
    // A confirm state should appear
    expect(deleteBtn).toHaveTextContent(/Confirm/i)
  })

  it('clicking confirm on delete calls useDeleteList.mutate with the list id', () => {
    useProjectLists.mockReturnValue({
      data: [{ id: 'l1', name: 'Guest List' }],
      isLoading: false,
    })

    const deleteMutate = vi.fn()
    useDeleteList.mockReturnValue({ mutate: deleteMutate })

    renderAt('proj-1')

    const deleteBtn = screen.getByTestId('delete-list-l1')
    fireEvent.click(deleteBtn) // first click: show confirm
    fireEvent.click(deleteBtn) // second click: confirm delete

    expect(deleteMutate).toHaveBeenCalledWith('l1')
  })

  // ---------------------------------------------------------------------------
  // Navigation tests — genuine route-level assertions
  // ---------------------------------------------------------------------------

  it('clicking a list card link navigates to the list route', () => {
    useProjectLists.mockReturnValue({
      data: [{ id: 'l1', name: 'Guest List' }],
      isLoading: false,
    })

    // Render with a second route that acts as the sentinel for /l/:listId
    render(
      <QueryClientProvider client={makeQC()}>
        <MemoryRouter initialEntries={['/w/ws-1/p/proj-1']}>
          <Routes>
            <Route path="/w/:workspaceId/p/:projectId" element={<ProjectView />} />
            <Route
              path="/w/:workspaceId/p/:projectId/l/:listId"
              element={<div data-testid="list-route-sentinel" />}
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    // Project view should be visible before the click
    expect(screen.getByTestId('project-view')).toBeInTheDocument()

    // Click the link wrapping the list card
    const link = screen.getByRole('link', { name: /guest list/i })
    fireEvent.click(link)

    // Router should have navigated to the list route — sentinel replaces ProjectView
    expect(screen.getByTestId('list-route-sentinel')).toBeInTheDocument()
    expect(screen.queryByTestId('project-view')).not.toBeInTheDocument()
  })

  it('delete button click does not trigger link navigation and calls mutate', () => {
    useProjectLists.mockReturnValue({
      data: [{ id: 'l1', name: 'Guest List' }],
      isLoading: false,
    })

    const deleteMutate = vi.fn()
    useDeleteList.mockReturnValue({ mutate: deleteMutate })

    // Same two-route setup so we can detect if navigation happened
    render(
      <QueryClientProvider client={makeQC()}>
        <MemoryRouter initialEntries={['/w/ws-1/p/proj-1']}>
          <Routes>
            <Route path="/w/:workspaceId/p/:projectId" element={<ProjectView />} />
            <Route
              path="/w/:workspaceId/p/:projectId/l/:listId"
              element={<div data-testid="list-route-sentinel" />}
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    const deleteBtn = screen.getByTestId('delete-list-l1')
    fireEvent.click(deleteBtn) // first click: enter confirm state

    // No navigation — ProjectView still in the document
    expect(screen.getByTestId('project-view')).toBeInTheDocument()
    expect(screen.queryByTestId('list-route-sentinel')).not.toBeInTheDocument()

    // mutate was NOT yet called (two-step confirmation)
    expect(deleteMutate).not.toHaveBeenCalled()

    fireEvent.click(deleteBtn) // second click: confirm delete
    expect(deleteMutate).toHaveBeenCalledWith('l1')

    // Still no navigation after confirmation either
    expect(screen.getByTestId('project-view')).toBeInTheDocument()
    expect(screen.queryByTestId('list-route-sentinel')).not.toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // Per-list Rename control
  // ---------------------------------------------------------------------------

  it('renders a rename control for each list card', () => {
    useProjectLists.mockReturnValue({
      data: [{ id: 'l1', name: 'Guest List' }],
      isLoading: false,
    })

    renderAt('proj-1')

    expect(screen.getByTestId('rename-list-l1')).toBeInTheDocument()
  })

  it('clicking rename reveals an inline input with the current name', () => {
    useProjectLists.mockReturnValue({
      data: [{ id: 'l1', name: 'Guest List' }],
      isLoading: false,
    })

    renderAt('proj-1')

    fireEvent.click(screen.getByTestId('rename-list-l1'))

    const renameInput = screen.getByTestId('rename-input-l1')
    expect(renameInput).toBeInTheDocument()
    expect(renameInput.value).toBe('Guest List')
  })

  it('pressing Enter on the rename input commits via useRenameList.mutate', () => {
    useProjectLists.mockReturnValue({
      data: [{ id: 'l1', name: 'Guest List' }],
      isLoading: false,
    })

    const renameMutate = vi.fn()
    useRenameList.mockReturnValue({ mutate: renameMutate })

    renderAt('proj-1')

    fireEvent.click(screen.getByTestId('rename-list-l1'))

    const renameInput = screen.getByTestId('rename-input-l1')
    fireEvent.change(renameInput, { target: { value: 'VIP Guests' } })
    fireEvent.keyDown(renameInput, { key: 'Enter' })

    expect(renameMutate).toHaveBeenCalledWith({ id: 'l1', name: 'VIP Guests' })
  })

  // ---------------------------------------------------------------------------
  // Mode toggle — Lists | All items (roll-up)
  // ---------------------------------------------------------------------------

  it('renders a mode toggle with data-testid="project-mode"', () => {
    useProjectLists.mockReturnValue({ data: [], isLoading: false })

    renderAt('proj-1')

    expect(screen.getByTestId('project-mode')).toBeInTheDocument()
  })

  it('defaults to Lists mode showing the list management UI', () => {
    useProjectLists.mockReturnValue({ data: [], isLoading: false })

    renderAt('proj-1')

    // New-list control visible = Lists mode
    expect(screen.getByTestId('new-list-input')).toBeInTheDocument()
    // ViewContainer should NOT be mounted in Lists mode
    expect(screen.queryByTestId('view-container')).not.toBeInTheDocument()
  })

  it('switching to "All items" renders ViewContainer (roll-up) instead of list cards', () => {
    useProjectLists.mockReturnValue({ data: [], isLoading: false })
    useProjectItems.mockReturnValue({ data: [
      { id: 10, list_id: 'l1', text: 'Alpha', completed: false },
    ], isLoading: false })

    renderAt('proj-1')

    fireEvent.click(screen.getByRole('button', { name: /all items/i }))

    expect(screen.getByTestId('view-container')).toBeInTheDocument()
    // Lists UI should be hidden
    expect(screen.queryByTestId('new-list-input')).not.toBeInTheDocument()
  })

  it('roll-up feeds useProjectItems data into ViewContainer', () => {
    useProjectLists.mockReturnValue({ data: [], isLoading: false })
    const projectItems = [
      { id: 10, list_id: 'l1', text: 'Alpha', completed: false },
      { id: 11, list_id: 'l2', text: 'Beta',  completed: true  },
    ]
    useProjectItems.mockReturnValue({ data: projectItems, isLoading: false })

    renderAt('proj-1')

    fireEvent.click(screen.getByRole('button', { name: /all items/i }))

    const vc = screen.getByTestId('view-container')
    expect(vc.getAttribute('data-items-count')).toBe('2')
  })

  it('roll-up ViewContainer receives a scopeKey prefixed with "project:"', () => {
    useProjectLists.mockReturnValue({ data: [], isLoading: false })
    useProjectItems.mockReturnValue({ data: [], isLoading: false })

    renderAt('proj-1')

    fireEvent.click(screen.getByRole('button', { name: /all items/i }))

    const vc = screen.getByTestId('view-container')
    expect(vc.getAttribute('data-scope-key')).toBe('project:proj-1')
  })

  it('switching back to "Lists" from roll-up hides ViewContainer and shows list UI', () => {
    useProjectLists.mockReturnValue({ data: [{ id: 'l1', name: 'Guest List' }], isLoading: false })
    useProjectItems.mockReturnValue({ data: [], isLoading: false })

    renderAt('proj-1')

    // Go to roll-up
    fireEvent.click(screen.getByRole('button', { name: /all items/i }))
    expect(screen.getByTestId('view-container')).toBeInTheDocument()

    // Go back to Lists
    fireEvent.click(screen.getByRole('button', { name: /^lists$/i }))
    expect(screen.queryByTestId('view-container')).not.toBeInTheDocument()
    expect(screen.getByTestId('new-list-input')).toBeInTheDocument()
  })
})
