import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from '../Button.jsx'

describe('Button', () => {
  test('renders children', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
  })

  test('calls onClick when clicked', () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Go</Button>)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  test('does NOT call onClick when disabled', () => {
    const onClick = vi.fn()
    render(<Button disabled onClick={onClick}>Go</Button>)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })

  test('is disabled attribute when disabled prop passed', () => {
    render(<Button disabled>Go</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  test('applies primary variant class by default', () => {
    render(<Button>Primary</Button>)
    const btn = screen.getByRole('button')
    expect(btn.className).toContain('bg-primary')
  })

  test('applies danger variant class', () => {
    render(<Button variant="danger">Delete</Button>)
    const btn = screen.getByRole('button')
    expect(btn.className).toContain('bg-danger')
  })

  test('applies secondary variant class', () => {
    render(<Button variant="secondary">Cancel</Button>)
    const btn = screen.getByRole('button')
    expect(btn.className).toContain('bg-surface-2')
  })

  test('applies ghost variant class', () => {
    render(<Button variant="ghost">Ghost</Button>)
    const btn = screen.getByRole('button')
    expect(btn.className).toContain('bg-transparent')
  })

  test('sm size applies smaller padding class', () => {
    render(<Button size="sm">Small</Button>)
    expect(screen.getByRole('button').className).toContain('px-3')
  })

  test('md size applies standard padding class', () => {
    render(<Button size="md">Medium</Button>)
    expect(screen.getByRole('button').className).toContain('px-4')
  })

  test('defaults to type="button"', () => {
    render(<Button>Btn</Button>)
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
  })

  test('respects type="submit"', () => {
    render(<Button type="submit">Submit</Button>)
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit')
  })

  test('merges additional className', () => {
    render(<Button className="my-custom">Btn</Button>)
    expect(screen.getByRole('button').className).toContain('my-custom')
  })
})
