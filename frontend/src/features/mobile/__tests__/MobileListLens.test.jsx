import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
const mutate = vi.fn()
vi.mock('../../../lib/api.js', () => ({ useUpdateItem: () => ({ mutate }) }))
import { MobileListLens } from '../MobileListLens.jsx'

const items = [
  { id: 1, text: 'First', status: 'To do', completed: false, position: 1000, assignee_id: null },
  { id: 2, text: 'Second', status: 'To do', completed: false, position: 2000, assignee_id: null },
  { id: 3, text: 'Third', status: 'To do', completed: false, position: 3000, assignee_id: null },
]

describe('MobileListLens', () => {
  beforeEach(() => mutate.mockClear())
  it('renders a row per item with a drag handle', () => {
    render(<MobileListLens listId="2" items={items} members={[]} onOpen={() => {}} />)
    expect(screen.getByTestId('lens-row-1')).toBeInTheDocument()
    expect(screen.getAllByTestId(/reorder-handle-/)).toHaveLength(3)
  })
  it('toggling the checkbox updates completed', () => {
    render(<MobileListLens listId="2" items={items} members={[]} onOpen={() => {}} />)
    fireEvent.click(screen.getByTestId('lens-check-1'))
    expect(mutate).toHaveBeenCalledWith({ id: 1, completed: true })
  })
  it('dragging row 1 down past one row commits a new position', () => {
    render(<MobileListLens listId="2" items={items} members={[]} onOpen={() => {}} />)
    const handle = screen.getByTestId('reorder-handle-1')
    fireEvent.pointerDown(handle, { clientY: 0, pointerId: 1 })
    fireEvent.pointerMove(handle, { clientY: 70, pointerId: 1 }) // ROW_H = 56 → target index 1
    fireEvent.pointerUp(handle, { clientY: 70, pointerId: 1 })
    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }))
    const arg = mutate.mock.calls.find((c) => c[0].id === 1 && 'position' in c[0])[0]
    expect(arg.position).toBeGreaterThan(1000) // moved between old #2 and #3
  })
})
