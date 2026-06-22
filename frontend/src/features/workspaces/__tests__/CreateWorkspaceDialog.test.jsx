import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// ---------------------------------------------------------------------------
// Mock api hooks before importing the component
// ---------------------------------------------------------------------------
vi.mock('../../../lib/api.js', () => ({
  useCreateWorkspace: vi.fn(),
}))

import { useCreateWorkspace } from '../../../lib/api.js'
import { CreateWorkspaceDialog } from '../CreateWorkspaceDialog.jsx'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

function Wrapper({ children }) {
  return (
    <QueryClientProvider client={makeQC()}>
      {children}
    </QueryClientProvider>
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('CreateWorkspaceDialog', () => {
  let mockMutate

  beforeEach(() => {
    mockMutate = vi.fn()
    useCreateWorkspace.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      isError: false,
      error: null,
    })
  })

  it('renders nothing when open is false', () => {
    render(<CreateWorkspaceDialog open={false} onClose={vi.fn()} />, { wrapper: Wrapper })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders a dialog when open is true', () => {
    render(<CreateWorkspaceDialog open={true} onClose={vi.fn()} />, { wrapper: Wrapper })

    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('renders a name input field', () => {
    render(<CreateWorkspaceDialog open={true} onClose={vi.fn()} />, { wrapper: Wrapper })

    expect(screen.getByLabelText(/workspace name/i)).toBeInTheDocument()
  })

  it('calls mutate with the entered name on submit', () => {
    render(<CreateWorkspaceDialog open={true} onClose={vi.fn()} />, { wrapper: Wrapper })

    const input = screen.getByLabelText(/workspace name/i)
    fireEvent.change(input, { target: { value: 'My New Workspace' } })

    const submitBtn = screen.getByRole('button', { name: /create/i })
    fireEvent.click(submitBtn)

    expect(mockMutate).toHaveBeenCalledWith(
      { name: 'My New Workspace' },
      expect.any(Object)
    )
  })

  it('does not submit when the name is empty', () => {
    render(<CreateWorkspaceDialog open={true} onClose={vi.fn()} />, { wrapper: Wrapper })

    const submitBtn = screen.getByRole('button', { name: /create/i })
    fireEvent.click(submitBtn)

    expect(mockMutate).not.toHaveBeenCalled()
  })

  it('calls onClose after successful creation', () => {
    const onClose = vi.fn()
    // Simulate mutate calling onSuccess immediately
    mockMutate.mockImplementation((_vars, options) => {
      options?.onSuccess?.()
    })

    render(<CreateWorkspaceDialog open={true} onClose={onClose} />, { wrapper: Wrapper })

    const input = screen.getByLabelText(/workspace name/i)
    fireEvent.change(input, { target: { value: 'New WS' } })
    fireEvent.click(screen.getByRole('button', { name: /create/i }))

    expect(onClose).toHaveBeenCalled()
  })

  it('shows an error message when mutation fails', () => {
    useCreateWorkspace.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      isError: true,
      error: { message: 'Something went wrong' },
    })

    render(<CreateWorkspaceDialog open={true} onClose={vi.fn()} />, { wrapper: Wrapper })

    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('calls onClose when the sheet close action is triggered', () => {
    const onClose = vi.fn()
    render(<CreateWorkspaceDialog open={true} onClose={onClose} />, { wrapper: Wrapper })

    // Sheet renders a "Close" button
    fireEvent.click(screen.getByRole('button', { name: /close/i }))

    expect(onClose).toHaveBeenCalled()
  })
})
