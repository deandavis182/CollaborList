import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
vi.mock('../../../lib/api.js', () => ({ useMyTasks: vi.fn(), useAccessibleItems: vi.fn(), useLists: vi.fn() }))
vi.mock('../../../lib/auth.js', () => ({ getUser: () => ({ email: 'me@example.com' }) }))
const navigate = vi.fn()
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }))
import { useMyTasks, useAccessibleItems, useLists } from '../../../lib/api.js'
import { useStore } from '../../../lib/store.js'
import { ListsScreen } from '../ListsScreen.jsx'

describe('ListsScreen', () => {
  beforeEach(() => {
    navigate.mockClear()
    useStore.setState({ searchQuery: '', detailItemId: null, detailContext: null, toast: null, currentWorkspaceId: null })
    useMyTasks.mockReturnValue({ data: [
      { id: 1, text: 'A', list_id: 2, list_name: 'Venue', project_name: 'Wedding', workspace_id: 9, project_id: 4, completed: false, status: 'To do', due_date: null },
      { id: 2, text: 'B', list_id: 2, list_name: 'Venue', project_name: 'Wedding', workspace_id: 9, project_id: 4, completed: true, status: 'Done', due_date: null },
    ], isLoading: false })
    useAccessibleItems.mockReturnValue({ data: [
      { id: 1, text: 'A', list_id: 2, list_name: 'Venue', project_name: 'Wedding', workspace_id: 9, project_id: 4, completed: false, status: 'To do', due_date: null, assignee_email: 'me@example.com' },
      { id: 99, text: 'Spouse task', list_id: 2, list_name: 'Venue', project_name: 'Wedding', workspace_id: 9, project_id: 4, completed: false, status: 'To do', due_date: null, assignee_email: 'spouse@example.com' },
    ], isLoading: false })
    useLists.mockReturnValue({ data: [{ id: 2, name: 'Venue', project_name: 'Wedding', project_id: 4, workspace_id: 9, total_items: 2, completed_items: 1 }] })
  })

  it('shows a list card with open/total progress', () => {
    render(<ListsScreen />)
    expect(screen.getByTestId('lists-screen')).toBeInTheDocument()
    expect(screen.getByText('Venue')).toBeInTheDocument()
    expect(screen.getByTestId('list-card-2')).toBeInTheDocument()
    // open = total_items - completed_items = 2 - 1 = 1
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('clicking a list card navigates to its workspace/project/list route', () => {
    render(<ListsScreen />)
    fireEvent.click(screen.getByTestId('list-card-2'))
    expect(navigate).toHaveBeenCalledWith('/w/9/p/4/l/2')
  })

  it('shows empty state when useLists returns no lists', () => {
    useLists.mockReturnValue({ data: [] })
    render(<ListsScreen />)
    expect(screen.getByTestId('lists-empty')).toBeInTheDocument()
    expect(screen.getByText('No lists yet. Create one from a project.')).toBeInTheDocument()
  })

  it('switches to search results when the query matches (scope: mine)', () => {
    render(<ListsScreen />)
    fireEvent.change(screen.getByTestId('mobile-search-input'), { target: { value: 'A' } })
    expect(screen.getByText(/result/i)).toBeInTheDocument()
    expect(screen.getByTestId('result-row-1')).toBeInTheDocument()
  })

  it('shows the no-match message when the query matches nothing', () => {
    render(<ListsScreen />)
    fireEvent.change(screen.getByTestId('mobile-search-input'), { target: { value: 'zzzzz' } })
    expect(screen.getByText('No tasks match your search')).toBeInTheDocument()
  })

  it('does not show another user\'s task by default (scope: mine)', () => {
    render(<ListsScreen />)
    fireEvent.change(screen.getByTestId('mobile-search-input'), { target: { value: 'Spouse' } })
    expect(screen.queryByTestId('result-row-99')).not.toBeInTheDocument()
    expect(screen.getByText('No tasks match your search')).toBeInTheDocument()
  })

  it('shows another user\'s task after switching to Everyone', () => {
    render(<ListsScreen />)
    fireEvent.change(screen.getByTestId('mobile-search-input'), { target: { value: 'Spouse' } })
    fireEvent.click(screen.getByRole('button', { name: 'Everyone' }))
    expect(screen.getByTestId('result-row-99')).toBeInTheDocument()
  })
})
