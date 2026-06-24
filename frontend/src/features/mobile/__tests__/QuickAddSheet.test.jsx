import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
const create = vi.fn()
vi.mock('../../../lib/api.js', () => ({
  useMyTasks: () => ({ data: [{ id: 1, list_id: 2, list_name: 'Venue', completed: false }] }),
  useCreateItem: () => ({ mutate: create }),
}))
vi.mock('../../../lib/auth.js', () => ({ getUser: () => ({ id: 99, email: 'me@example.com' }) }))
import { useStore } from '../../../lib/store.js'
import { QuickAddSheet } from '../QuickAddSheet.jsx'

describe('QuickAddSheet', () => {
  beforeEach(() => { create.mockClear(); useStore.setState({ quickAddOpen: true, showToast: vi.fn() }) })
  it('creates a task in the selected list, shows a toast, and closes', () => {
    render(<QuickAddSheet />)
    fireEvent.change(screen.getByTestId('quickadd-input'), { target: { value: 'Tjjjry cake' } })
    fireEvent.click(screen.getByTestId('quickadd-submit'))
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ text: 'Tjjjry cake', status: 'To do', assignee_id: 99 }))
    expect(useStore.getState().showToast).toHaveBeenCalledWith('Task added')
    expect(useStore.getState().quickAddOpen).toBe(false)
  })
  it('renders nothing when closed', () => {
    useStore.setState({ quickAddOpen: false })
    const { container } = render(<QuickAddSheet />)
    expect(container).toBeEmptyDOMElement()
  })
})
