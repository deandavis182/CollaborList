import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
vi.mock('react-router-dom', () => ({ useParams: () => ({ workspaceId: '9' }) }))
const markRead = vi.fn()
vi.mock('../../../lib/api.js', () => ({
  useWorkspaceActivity: () => ({ data: { items: [{ id: 1, actor_email: 'a@x.com', verb: 'completed', created_at: '2026-06-24T00:00:00Z' }], unread: 1 } }),
  useMarkActivityRead: () => ({ mutate: markRead }),
}))
import { useStore } from '../../../lib/store.js'
import { ActivityScreen } from '../ActivityScreen.jsx'

it('renders the activity title and a timeline entry', () => {
  useStore.setState({ presence: { 1: { userId: 1, email: 'a@x.com' } } })
  render(<ActivityScreen />)
  expect(screen.getByTestId('activity-screen')).toBeInTheDocument()
  expect(screen.getByText(/teammate/i)).toBeInTheDocument()
  expect(screen.getByText(/a@x\.com/)).toBeInTheDocument()
  expect(markRead).toHaveBeenCalledTimes(1)
})
