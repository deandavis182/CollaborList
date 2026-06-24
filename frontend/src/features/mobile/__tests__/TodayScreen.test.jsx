import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
vi.mock('../../../lib/api.js', () => ({ useMyTasks: vi.fn() }))
vi.mock('../../../lib/auth.js', () => ({ getUser: () => ({ email: 'devin@example.com' }) }))
import { useMyTasks } from '../../../lib/api.js'
import { TodayScreen } from '../TodayScreen.jsx'

describe('TodayScreen', () => {
  beforeEach(() => {
    useMyTasks.mockReturnValue({ data: [
      { id: 1, text: 'Overdue thing', list_id: 2, list_name: 'Venue', workspace_id: 9, status: 'To do', completed: false, due_date: '2020-01-01' },
      { id: 2, text: 'Someday thing', list_id: 3, list_name: 'Ideas', workspace_id: 9, status: 'To do', completed: false, due_date: null },
    ], isLoading: false })
  })
  it('renders the greeting, focus card, and a section per non-empty bucket', () => {
    render(<TodayScreen />)
    expect(screen.getByTestId('today-screen')).toBeInTheDocument()
    expect(screen.getByTestId('focus-card')).toBeInTheDocument()
    expect(screen.getAllByText(/overdue/i).length).toBeGreaterThan(0)
    expect(screen.getByText('Overdue thing')).toBeInTheDocument()
    expect(screen.getByText('Someday thing')).toBeInTheDocument()
  })
})
