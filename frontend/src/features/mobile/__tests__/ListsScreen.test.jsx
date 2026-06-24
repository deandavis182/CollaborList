import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
vi.mock('../../../lib/api.js', () => ({ useMyTasks: vi.fn(), useWorkspaceMembers: vi.fn(), useLists: vi.fn() }))
const navigate = vi.fn()
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }))
import { useMyTasks, useWorkspaceMembers, useLists } from '../../../lib/api.js'
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
    useWorkspaceMembers.mockReturnValue({ data: [] })
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

  it('switches to search results when the query matches', () => {
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

  it('matches tasks by assignee email', () => {
    useStore.setState({ searchQuery: 'bridesmaid' })
    useMyTasks.mockReturnValue({ data: [{ id: 7, text: 'Pick shoes', list_id: 2, list_name: 'Venue', workspace_id: 9, project_id: 4, assignee_id: 11, completed: false, status: 'To do', due_date: null }], isLoading: false })
    useWorkspaceMembers.mockReturnValue({ data: [{ user_id: 11, email: 'bridesmaid@example.com' }] })
    render(<ListsScreen />)
    expect(screen.getByTestId('result-row-7')).toBeInTheDocument()
  })
})
