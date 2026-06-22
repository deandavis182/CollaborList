import { render, screen } from '@testing-library/react'
import { Avatar } from '../Avatar.jsx'

describe('Avatar', () => {
  test('shows correct initials for a two-word name', () => {
    render(<Avatar name="Dean Davis" />)
    expect(screen.getByText('DD')).toBeInTheDocument()
  })

  test('shows single initial for a one-word name', () => {
    render(<Avatar name="Alice" />)
    expect(screen.getByText('A')).toBeInTheDocument()
  })

  test('uses first and last initial for multi-word names', () => {
    render(<Avatar name="John Paul Jones" />)
    expect(screen.getByText('JJ')).toBeInTheDocument()
  })

  test('shows ? when name is empty', () => {
    render(<Avatar name="" />)
    expect(screen.getByText('?')).toBeInTheDocument()
  })

  test('shows ? when name is whitespace only', () => {
    render(<Avatar name="   " />)
    expect(screen.getByText('?')).toBeInTheDocument()
  })

  test('initials are uppercase', () => {
    render(<Avatar name="alice bob" />)
    expect(screen.getByText('AB')).toBeInTheDocument()
  })

  test('renders an img element when src is provided', () => {
    render(<Avatar name="Dean Davis" src="https://example.com/avatar.png" />)
    const img = screen.getByRole('img')
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('src', 'https://example.com/avatar.png')
    expect(img).toHaveAttribute('alt', 'Dean Davis')
  })

  test('has aria-label equal to the name', () => {
    render(<Avatar name="Jane Smith" />)
    expect(screen.getByLabelText('Jane Smith')).toBeInTheDocument()
  })

  test('applies a deterministic background-color style from the name', () => {
    const { container: c1 } = render(<Avatar name="Alice" />)
    const { container: c2 } = render(<Avatar name="Alice" />)
    const bg1 = c1.firstChild.style.backgroundColor
    const bg2 = c2.firstChild.style.backgroundColor
    // jsdom normalises hsl() → rgb(), so just verify it's a non-empty colour string
    expect(bg1).toBeTruthy()
    expect(bg1).toBe(bg2)
  })

  test('two different names produce different background colors', () => {
    const { container: c1 } = render(<Avatar name="Alice" />)
    const { container: c2 } = render(<Avatar name="Bob" />)
    // Very unlikely to collide
    const bg1 = c1.firstChild.style.backgroundColor
    const bg2 = c2.firstChild.style.backgroundColor
    expect(bg1).not.toBe(bg2)
  })

  test('applies md size class by default', () => {
    const { container } = render(<Avatar name="Test" />)
    expect(container.firstChild.className).toContain('w-10')
  })

  test('applies sm size class', () => {
    const { container } = render(<Avatar name="Test" size="sm" />)
    expect(container.firstChild.className).toContain('w-8')
  })

  test('applies lg size class', () => {
    const { container } = render(<Avatar name="Test" size="lg" />)
    expect(container.firstChild.className).toContain('w-14')
  })

  test('applies rounded-full class', () => {
    const { container } = render(<Avatar name="Test" />)
    expect(container.firstChild.className).toContain('rounded-full')
  })

  test('merges additional className', () => {
    const { container } = render(<Avatar name="Test" className="border-2" />)
    expect(container.firstChild.className).toContain('border-2')
  })
})
