import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
const mutate = vi.fn()
vi.mock('../../../lib/api.js', () => ({
  useListItems: () => ({ data: [{ id: 5, list_id: 2, text: 'Order cake', status: 'Doing', completed: false, assignee_id: null, due_date: '2026-07-01', notes: '', list_name: 'Catering', project_name: 'Wedding' }] }),
  useUpdateItem: () => ({ mutate }),
  useWorkspaceMembers: () => ({ data: [] }),
}))
vi.mock('../../comments/CommentThread.jsx', () => ({ CommentThread: () => <div data-testid="comment-thread" /> }))
import { useStore } from '../../../lib/store.js'
import { MobileItemSheet } from '../MobileItemSheet.jsx'

describe('MobileItemSheet', () => {
  beforeEach(() => { mutate.mockClear(); useStore.setState({ detailItemId: 5, detailContext: { listId: 2, workspaceId: 9 } }) })
  it('shows the item title, status control and comments', () => {
    render(<MobileItemSheet />)
    expect(screen.getByText('Order cake')).toBeInTheDocument()
    expect(screen.getByTestId('comment-thread')).toBeInTheDocument()
  })
  it('toggling the checkbox marks the item complete', () => {
    render(<MobileItemSheet />)
    fireEvent.click(screen.getByLabelText(/mark complete/i))
    expect(mutate).toHaveBeenCalledWith({ id: 5, completed: true })
  })
  it('renders nothing when no item is open', () => {
    useStore.setState({ detailItemId: null, detailContext: null })
    const { container } = render(<MobileItemSheet />)
    expect(container).toBeEmptyDOMElement()
  })
})
