import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// ---------------------------------------------------------------------------
// Mock api — must happen before imports below
// ---------------------------------------------------------------------------
vi.mock('../../../lib/api.js', () => ({
  useMyTasks: vi.fn(),
}))

import { useMyTasks } from '../../../lib/api.js'
import { MyTasksView } from '../MyTasksView.jsx'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

function renderView() {
  return render(
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter>
        <MyTasksView />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

// Fixed "today" — 2025-06-15. The tests feed ISO strings so Date constructor
// parses them in UTC; we just check bucket presence, not exact date rendering.
const YESTERDAY = '2025-06-14T00:00:00.000Z'
const TODAY_ISO = '2025-06-15T00:00:00.000Z'
const TOMORROW  = '2025-06-16T00:00:00.000Z'

function makeTask(overrides) {
  return {
    id: 1,
    text: 'Sample task',
    status: 'To do',
    completed: false,
    due_date: null,
    list_id: 'list-1',
    list_name: 'My List',
    project_id: 'proj-1',
    project_name: 'My Project',
    workspace_id: 'ws-1',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests — loading state
// ---------------------------------------------------------------------------

describe('MyTasksView — loading state', () => {
  beforeEach(() => {
    useMyTasks.mockReturnValue({ data: [], isLoading: true })
  })

  it('renders the view container', () => {
    renderView()
    expect(screen.getByTestId('my-tasks-view')).toBeInTheDocument()
  })

  it('shows loading indicator', () => {
    renderView()
    expect(screen.getByTestId('mytasks-loading')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Tests — empty state
// ---------------------------------------------------------------------------

describe('MyTasksView — empty state', () => {
  beforeEach(() => {
    useMyTasks.mockReturnValue({ data: [], isLoading: false })
  })

  it('shows empty message when no tasks', () => {
    renderView()
    expect(screen.getByTestId('mytasks-empty')).toBeInTheDocument()
    expect(screen.getByTestId('mytasks-empty')).toHaveTextContent(
      'No tasks assigned to you'
    )
  })
})

// ---------------------------------------------------------------------------
// Tests — sections rendered per bucket
// ---------------------------------------------------------------------------

describe('MyTasksView — section headings', () => {
  it('renders Overdue section heading when overdue tasks exist', () => {
    // A past incomplete task that lands in overdue when today is 2025-06-15
    // We use a clearly past date so it's always overdue
    useMyTasks.mockReturnValue({
      data: [makeTask({ id: 1, due_date: '2020-01-01T00:00:00.000Z', completed: false })],
      isLoading: false,
    })
    renderView()
    expect(screen.getByText(/overdue/i)).toBeInTheDocument()
  })

  it('renders Upcoming section heading when future tasks exist', () => {
    // A clearly future date
    useMyTasks.mockReturnValue({
      data: [makeTask({ id: 2, due_date: '2099-12-31T00:00:00.000Z' })],
      isLoading: false,
    })
    renderView()
    expect(screen.getByText(/upcoming/i)).toBeInTheDocument()
  })

  it('renders No due date section heading when tasks have no due date', () => {
    useMyTasks.mockReturnValue({
      data: [makeTask({ id: 3, due_date: null })],
      isLoading: false,
    })
    renderView()
    expect(screen.getByText(/no due date/i)).toBeInTheDocument()
  })

  it('does NOT render Overdue heading when there are no overdue tasks', () => {
    useMyTasks.mockReturnValue({
      data: [makeTask({ id: 4, due_date: null })],
      isLoading: false,
    })
    renderView()
    expect(screen.queryByText(/overdue/i)).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Tests — task row content
// ---------------------------------------------------------------------------

describe('MyTasksView — task row content', () => {
  it('renders the task text', () => {
    useMyTasks.mockReturnValue({
      data: [makeTask({ id: 10, text: 'Write the docs', due_date: null })],
      isLoading: false,
    })
    renderView()
    expect(screen.getByText('Write the docs')).toBeInTheDocument()
  })

  it('renders project_name › list_name context when project is present', () => {
    useMyTasks.mockReturnValue({
      data: [makeTask({
        id: 11,
        text: 'My task',
        project_name: 'Alpha Project',
        list_name: 'Sprint 1',
        due_date: null,
      })],
      isLoading: false,
    })
    renderView()
    expect(screen.getByText('Alpha Project › Sprint 1')).toBeInTheDocument()
  })

  it('renders only list_name context when project_name is null', () => {
    useMyTasks.mockReturnValue({
      data: [makeTask({
        id: 12,
        text: 'My task',
        project_name: null,
        list_name: 'Backlog',
        due_date: null,
      })],
      isLoading: false,
    })
    renderView()
    expect(screen.getByText('Backlog')).toBeInTheDocument()
  })

  it('renders a status Chip with the task status', () => {
    useMyTasks.mockReturnValue({
      data: [makeTask({ id: 13, text: 'Chip test', status: 'Doing', due_date: null })],
      isLoading: false,
    })
    renderView()
    expect(screen.getByText('Doing')).toBeInTheDocument()
  })

  it('uses data-testid="mytask-{id}" with String() coercion', () => {
    useMyTasks.mockReturnValue({
      data: [makeTask({ id: 42, due_date: null })],
      isLoading: false,
    })
    renderView()
    expect(screen.getByTestId('mytask-42')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Tests — deep-link href
// ---------------------------------------------------------------------------

describe('MyTasksView — deep-link href', () => {
  it('builds /w/p/l href when workspace_id + project_id + list_id are present', () => {
    useMyTasks.mockReturnValue({
      data: [makeTask({
        id: 20,
        workspace_id: 'ws-1',
        project_id: 'proj-2',
        list_id: 'list-3',
        due_date: null,
      })],
      isLoading: false,
    })
    renderView()
    const link = screen.getByTestId('mytask-20')
    expect(link).toHaveAttribute('href', '/w/ws-1/p/proj-2/l/list-3')
  })

  it('uses href="#" when workspace_id is missing', () => {
    useMyTasks.mockReturnValue({
      data: [makeTask({
        id: 21,
        workspace_id: null,
        project_id: 'proj-2',
        list_id: 'list-3',
        due_date: null,
      })],
      isLoading: false,
    })
    renderView()
    const link = screen.getByTestId('mytask-21')
    expect(link).toHaveAttribute('href', '#')
  })

  it('uses href="#" when project_id is missing', () => {
    useMyTasks.mockReturnValue({
      data: [makeTask({
        id: 22,
        workspace_id: 'ws-1',
        project_id: null,
        list_id: 'list-3',
        due_date: null,
      })],
      isLoading: false,
    })
    renderView()
    const link = screen.getByTestId('mytask-22')
    expect(link).toHaveAttribute('href', '#')
  })

  it('uses href="#" when list_id is missing', () => {
    useMyTasks.mockReturnValue({
      data: [makeTask({
        id: 23,
        workspace_id: 'ws-1',
        project_id: 'proj-2',
        list_id: null,
        due_date: null,
      })],
      isLoading: false,
    })
    renderView()
    const link = screen.getByTestId('mytask-23')
    expect(link).toHaveAttribute('href', '#')
  })
})

// ---------------------------------------------------------------------------
// Tests — heading always present
// ---------------------------------------------------------------------------

describe('MyTasksView — page heading', () => {
  it('always renders "My Tasks" heading', () => {
    useMyTasks.mockReturnValue({ data: [], isLoading: false })
    renderView()
    expect(screen.getByText('My Tasks')).toBeInTheDocument()
  })
})
