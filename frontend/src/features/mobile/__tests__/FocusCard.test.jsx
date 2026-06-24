import { render, screen } from '@testing-library/react'
import { FocusCard } from '../FocusCard.jsx'

it('renders percent, headline and subline', () => {
  render(<FocusCard percent={75} headline="4 tasks need you today" subline="1 overdue · 3 due today" />)
  expect(screen.getByText('75')).toBeInTheDocument()
  expect(screen.getByText('4 tasks need you today')).toBeInTheDocument()
  expect(screen.getByText('1 overdue · 3 due today')).toBeInTheDocument()
})
