import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
const mutate = vi.fn()
vi.mock('../../../lib/api.js', () => ({ useUpdateItem: () => ({ mutate }) }))
import { TaskCard } from '../SwipeableTaskCard.jsx'

const task = { id: 5, text: 'Call florist', list_id: 2, list_name: 'Venue', workspace_id: 9, status: 'To do', completed: false, due_date: '2026-06-24' }

describe('SwipeableTaskCard', () => {
  beforeEach(() => mutate.mockClear())
  it('renders the title and a list chip', () => {
    render(<TaskCard task={task} onOpen={() => {}} />)
    expect(screen.getByText('Call florist')).toBeInTheDocument()
    expect(screen.getByText('Venue')).toBeInTheDocument()
  })
  it('a tap (no movement) calls onOpen', () => {
    const onOpen = vi.fn()
    render(<TaskCard task={task} onOpen={onOpen} />)
    const fg = screen.getByTestId('swipe-fg-5')
    fireEvent.pointerDown(fg, { clientX: 10, clientY: 10, pointerId: 1 })
    fireEvent.pointerUp(fg, { clientX: 11, clientY: 10, pointerId: 1 })
    expect(onOpen).toHaveBeenCalled()
  })
  it('a right swipe past threshold marks complete', () => {
    vi.useFakeTimers()
    render(<TaskCard task={task} onOpen={() => {}} />)
    const fg = screen.getByTestId('swipe-fg-5')
    fireEvent.pointerDown(fg, { clientX: 10, clientY: 10, pointerId: 1 })
    fireEvent.pointerMove(fg, { clientX: 120, clientY: 12, pointerId: 1 })
    fireEvent.pointerUp(fg, { clientX: 120, clientY: 12, pointerId: 1 })
    vi.advanceTimersByTime(260)
    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ id: 5, completed: true }))
    vi.useRealTimers()
  })
})
