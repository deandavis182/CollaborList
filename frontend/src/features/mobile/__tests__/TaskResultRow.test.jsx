import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import { TaskResultRow } from '../TaskResultRow.jsx'

const task = { id: 3, text: 'Book DJ', list_id: 2, list_name: 'Vendors', status: 'Doing', due_date: '2026-07-01', assignee_id: null, completed: false }

it('shows the title and the list-context pill when enabled', () => {
  render(<TaskResultRow task={task} showListContext onOpen={() => {}} />)
  expect(screen.getByText('Book DJ')).toBeInTheDocument()
  expect(screen.getByText('Vendors')).toBeInTheDocument()
})

it('calls onOpen when tapped', () => {
  const onOpen = vi.fn()
  render(<TaskResultRow task={task} onOpen={onOpen} />)
  fireEvent.click(screen.getByTestId('result-row-3'))
  expect(onOpen).toHaveBeenCalled()
})
