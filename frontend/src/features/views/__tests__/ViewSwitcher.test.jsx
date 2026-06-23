import { render, screen, fireEvent } from '@testing-library/react'
import { ViewSwitcher } from '../ViewSwitcher.jsx'

describe('ViewSwitcher', () => {
  it('renders all 4 view options', () => {
    render(<ViewSwitcher view="list" onChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'List' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Board' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Calendar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Timeline' })).toBeInTheDocument()
  })

  it('clicking Board calls onChange("board")', () => {
    const onChange = vi.fn()
    render(<ViewSwitcher view="list" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Board' }))
    expect(onChange).toHaveBeenCalledWith('board')
  })

  it('active option reflects the view prop — List active', () => {
    render(<ViewSwitcher view="list" onChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Board' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('active option reflects the view prop — Calendar active', () => {
    render(<ViewSwitcher view="calendar" onChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'Calendar' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('has data-testid="view-switcher"', () => {
    render(<ViewSwitcher view="list" onChange={() => {}} />)
    expect(screen.getByTestId('view-switcher')).toBeInTheDocument()
  })

  it('has aria-label="Switch view" on the root group element', () => {
    render(<ViewSwitcher view="list" onChange={() => {}} />)
    expect(screen.getByRole('group', { name: 'Switch view' })).toBeInTheDocument()
  })

  it('clicking Timeline calls onChange("timeline")', () => {
    const onChange = vi.fn()
    render(<ViewSwitcher view="list" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Timeline' }))
    expect(onChange).toHaveBeenCalledWith('timeline')
  })
})
