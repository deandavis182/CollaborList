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

  test('calls onClose when Escape is pressed while open', () => {
    const onClose = vi.fn()
    render(
      <Sheet open={true} onClose={onClose} title="Details">
        Content
      </Sheet>
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  test('does not call onClose when Escape is pressed while closed', () => {
    const onClose = vi.fn()
    render(
      <Sheet open={false} onClose={onClose} title="Details">
        Content
      </Sheet>
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })

  test('moves focus to the close button when opened', () => {
    render(
      <Sheet open={true} onClose={() => {}} title="Details">
        Content
      </Sheet>
    )
    const closeBtn = screen.getByRole('button', { name: 'Close' })
    expect(document.activeElement).toBe(closeBtn)
  })

  test('sheet panel has data-testid="sheet-panel" when open', () => {
    render(
      <Sheet open={true} onClose={() => {}} title="Details">
        Content
      </Sheet>
    )
    expect(screen.getByTestId('sheet-panel')).toBeInTheDocument()
  })

  test('removes Escape listener when sheet closes (no leak)', () => {
    const onClose = vi.fn()
    const { rerender } = render(
      <Sheet open={true} onClose={onClose} title="Details">
        Content
      </Sheet>
    )
    // Close the sheet
    rerender(
      <Sheet open={false} onClose={onClose} title="Details">
        Content
      </Sheet>
    )
    // Escape now should not fire onClose
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('bottom variant renders a grab handle and bottom-anchored panel', () => {
    render(<Sheet variant="bottom" open onClose={() => {}} title="Detail"><p>body</p></Sheet>)
    expect(screen.getByTestId('sheet-grab')).toBeInTheDocument()
    const panel = screen.getByTestId('sheet-panel')
    expect(panel.className).toMatch(/rounded-t-4xl/)
    expect(panel.className).toMatch(/bottom-0/)
  })
})
