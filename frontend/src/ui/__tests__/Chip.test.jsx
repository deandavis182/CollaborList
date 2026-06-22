import { render, screen, fireEvent } from '@testing-library/react'
import { Chip } from '../Chip.jsx'

describe('Chip', () => {
  test('renders label text', () => {
    render(<Chip>React</Chip>)
    expect(screen.getByText('React')).toBeInTheDocument()
  })

  test('does not render remove button when onRemove is not provided', () => {
    render(<Chip>Tag</Chip>)
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument()
  })

  test('renders remove button when onRemove is provided', () => {
    render(<Chip onRemove={() => {}}>Tag</Chip>)
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument()
  })

  test('calls onRemove when × button is clicked', () => {
    const onRemove = vi.fn()
    render(<Chip onRemove={onRemove}>Tag</Chip>)
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(onRemove).toHaveBeenCalledTimes(1)
  })

  test('applies neutral color class by default', () => {
    const { container } = render(<Chip>Neutral</Chip>)
    expect(container.firstChild.className).toContain('bg-surface-2')
  })

  test('applies primary color class', () => {
    const { container } = render(<Chip color="primary">Primary</Chip>)
    expect(container.firstChild.className).toContain('bg-primary/10')
  })

  test('applies danger color class', () => {
    const { container } = render(<Chip color="danger">Danger</Chip>)
    expect(container.firstChild.className).toContain('bg-danger/10')
  })

  test('applies success color class', () => {
    const { container } = render(<Chip color="success">Done</Chip>)
    expect(container.firstChild.className).toContain('bg-success/10')
  })

  test('applies warning color class', () => {
    const { container } = render(<Chip color="warning">Warn</Chip>)
    expect(container.firstChild.className).toContain('bg-warning/10')
  })

  test('applies accent color class', () => {
    const { container } = render(<Chip color="accent">Accent</Chip>)
    expect(container.firstChild.className).toContain('bg-accent/10')
  })

  test('merges additional className', () => {
    const { container } = render(<Chip className="my-class">Tag</Chip>)
    expect(container.firstChild.className).toContain('my-class')
  })
})
