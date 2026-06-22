import { render, screen } from '@testing-library/react'
import { Card } from '../Card.jsx'

describe('Card', () => {
  test('renders children', () => {
    render(<Card>Card content</Card>)
    expect(screen.getByText('Card content')).toBeInTheDocument()
  })

  test('renders as a div by default', () => {
    const { container } = render(<Card>Content</Card>)
    expect(container.firstChild.tagName).toBe('DIV')
  })

  test('renders as a custom element via `as` prop', () => {
    const { container } = render(<Card as="section">Content</Card>)
    expect(container.firstChild.tagName).toBe('SECTION')
  })

  test('applies bg-surface class', () => {
    const { container } = render(<Card>Content</Card>)
    expect(container.firstChild.className).toContain('bg-surface')
  })

  test('applies rounded-lg class', () => {
    const { container } = render(<Card>Content</Card>)
    expect(container.firstChild.className).toContain('rounded-lg')
  })

  test('applies border class for subtle outline', () => {
    const { container } = render(<Card>Content</Card>)
    expect(container.firstChild.className).toContain('border')
  })

  test('applies border-l-2 for left accent', () => {
    const { container } = render(<Card>Content</Card>)
    expect(container.firstChild.className).toContain('border-l-2')
  })

  test('left border color is set via inline style without color-mix (cross-browser)', () => {
    const { container } = render(<Card>Content</Card>)
    const style = container.firstChild.getAttribute('style') || ''
    // Must reference the primary-40 token (rgba fallback, no color-mix)
    expect(style).toContain('--color-primary-40')
    // Confirm color-mix is NOT used (older Safari/Firefox compatibility)
    expect(style).not.toContain('color-mix')
  })

  test('merges additional className', () => {
    const { container } = render(<Card className="p-4">Content</Card>)
    expect(container.firstChild.className).toContain('p-4')
  })

  test('passes through additional props', () => {
    render(<Card data-testid="my-card">Content</Card>)
    expect(screen.getByTestId('my-card')).toBeInTheDocument()
  })
})
