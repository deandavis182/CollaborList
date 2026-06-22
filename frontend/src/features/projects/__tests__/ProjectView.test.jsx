import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// ---------------------------------------------------------------------------
// Mock api before importing the component
// ---------------------------------------------------------------------------
vi.mock('../../../lib/api.js', () => ({
  useProjectLists: vi.fn(),
}))

import { useProjectLists } from '../../../lib/api.js'
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

  it('includes a note that item editing is in the current app', () => {
    useProjectLists.mockReturnValue({ data: [], isLoading: false })

    renderAt('proj-1')

    // There should be a link or text pointing to the current app
    const link = screen.getByRole('link', { name: /current app/i })
    expect(link).toBeInTheDocument()
  })
})
