import { render, screen, fireEvent } from '@testing-library/react'
import { Toast } from '../Toast.jsx'

describe('Toast', () => {
  test('renders the message text', () => {
    render(<Toast message="Item saved successfully" variant="success" onDismiss={() => {}} />)
    expect(screen.getByText('Item saved successfully')).toBeInTheDocument()
  })

  test('has role=status for assistive tech', () => {
    render(<Toast message="Hello" variant="info" onDismiss={() => {}} />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  test('has aria-live=polite', () => {
    render(<Toast message="Hello" variant="info" onDismiss={() => {}} />)
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
  })

  test('has aria-atomic=true', () => {
    render(<Toast message="Hello" variant="info" onDismiss={() => {}} />)
    expect(screen.getByRole('status')).toHaveAttribute('aria-atomic', 'true')
  })

  test('renders dismiss button', () => {
    render(<Toast message="Done" variant="success" onDismiss={() => {}} />)
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument()
  })

  test('calls onDismiss when dismiss button clicked', () => {
    const onDismiss = vi.fn()
    render(<Toast message="Done" variant="info" onDismiss={onDismiss} />)
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  test('info variant has data-variant=info', () => {
    render(<Toast message="FYI" variant="info" onDismiss={() => {}} />)
    expect(screen.getByRole('status')).toHaveAttribute('data-variant', 'info')
  })

  test('success variant has data-variant=success', () => {
    render(<Toast message="Done!" variant="success" onDismiss={() => {}} />)
    expect(screen.getByRole('status')).toHaveAttribute('data-variant', 'success')
  })

  test('error variant has data-variant=error', () => {
    render(<Toast message="Something went wrong" variant="error" onDismiss={() => {}} />)
    expect(screen.getByRole('status')).toHaveAttribute('data-variant', 'error')
  })

  test('error variant applies danger border class', () => {
    render(<Toast message="Error occurred" variant="error" onDismiss={() => {}} />)
    const toast = screen.getByRole('status')
    expect(toast.className).toContain('border-danger')
  })

  test('defaults to info variant when variant is omitted', () => {
    render(<Toast message="Default" onDismiss={() => {}} />)
    expect(screen.getByRole('status')).toHaveAttribute('data-variant', 'info')
  })
})
