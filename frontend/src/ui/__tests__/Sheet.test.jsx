import { render, screen, fireEvent } from '@testing-library/react'
import { Sheet } from '../Sheet.jsx'

describe('Sheet', () => {
  test('renders nothing when open is false', () => {
    const { container } = render(
      <Sheet open={false} onClose={() => {}} title="Details">
        <p>Content</p>
      </Sheet>
    )
    expect(container.firstChild).toBeNull()
  })

  test('renders children when open is true', () => {
    render(
      <Sheet open={true} onClose={() => {}} title="Details">
        <p>Sheet content</p>
      </Sheet>
    )
    expect(screen.getByText('Sheet content')).toBeInTheDocument()
  })

  test('renders title when open', () => {
    render(
      <Sheet open={true} onClose={() => {}} title="My Sheet" />
    )
    expect(screen.getByText('My Sheet')).toBeInTheDocument()
  })

  test('renders a dialog with aria-modal', () => {
    render(
      <Sheet open={true} onClose={() => {}} title="Details">
        Content
      </Sheet>
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  test('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    render(
      <Sheet open={true} onClose={onClose} title="Details">
        Content
      </Sheet>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  test('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn()
    render(
      <Sheet open={true} onClose={onClose} title="Details">
        Content
      </Sheet>
    )
    fireEvent.click(screen.getByTestId('sheet-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  test('does not call onClose when panel content is clicked', () => {
    const onClose = vi.fn()
    render(
      <Sheet open={true} onClose={onClose} title="Details">
        <p>Inner content</p>
      </Sheet>
    )
    fireEvent.click(screen.getByText('Inner content'))
    expect(onClose).not.toHaveBeenCalled()
  })

  test('drawer variant applies right-side panel class', () => {
    render(
      <Sheet open={true} onClose={() => {}} title="Drawer" variant="drawer">
        Content
      </Sheet>
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog.className).toContain('right-0')
  })

  test('fullscreen variant applies fixed inset-0 class', () => {
    render(
      <Sheet open={true} onClose={() => {}} title="Full" variant="fullscreen">
        Content
      </Sheet>
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog.className).toContain('inset-0')
  })
})
