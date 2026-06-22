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

  test('left border color is set via inline style using primary color', () => {
    const { container } = render(<Card>Content</Card>)
    const style = container.firstChild.getAttribute('style') || ''
    // should reference the primary color token
    expect(style).toContain('--color-primary')
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
