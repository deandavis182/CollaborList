import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// ---------------------------------------------------------------------------
// Mock api hooks before importing the component
// ---------------------------------------------------------------------------
vi.mock('../../../lib/api.js', () => ({
  useCreateProject: vi.fn(),
}))

import { useCreateProject } from '../../../lib/api.js'
import { CreateProjectDialog } from '../CreateProjectDialog.jsx'

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
describe('CreateProjectDialog', () => {
  let mockMutate

  beforeEach(() => {
    mockMutate = vi.fn()
    useCreateProject.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      isError: false,
      error: null,
    })
  })

  it('renders nothing when open is false', () => {
    render(
      <CreateProjectDialog open={false} onClose={vi.fn()} workspaceId={1} />,
      { wrapper: Wrapper }
    )

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders a dialog when open is true', () => {
    render(
      <CreateProjectDialog open={true} onClose={vi.fn()} workspaceId={1} />,
      { wrapper: Wrapper }
    )

    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('renders a name input field', () => {
    render(
      <CreateProjectDialog open={true} onClose={vi.fn()} workspaceId={1} />,
      { wrapper: Wrapper }
    )

    expect(screen.getByLabelText(/project name/i)).toBeInTheDocument()
  })

  it('calls mutate with { name } on submit', () => {
    render(
      <CreateProjectDialog open={true} onClose={vi.fn()} workspaceId={1} />,
      { wrapper: Wrapper }
    )

    const input = screen.getByLabelText(/project name/i)
    fireEvent.change(input, { target: { value: 'Summer Wedding' } })

    const submitBtn = screen.getByRole('button', { name: /create/i })
    fireEvent.click(submitBtn)

    expect(mockMutate).toHaveBeenCalledWith(
      { name: 'Summer Wedding' },
      expect.any(Object)
    )
  })

  it('does not submit when the name is empty', () => {
    render(
      <CreateProjectDialog open={true} onClose={vi.fn()} workspaceId={1} />,
      { wrapper: Wrapper }
    )

    fireEvent.click(screen.getByRole('button', { name: /create/i }))

    expect(mockMutate).not.toHaveBeenCalled()
  })

  it('trims whitespace-only names and does not submit', () => {
    render(
      <CreateProjectDialog open={true} onClose={vi.fn()} workspaceId={1} />,
      { wrapper: Wrapper }
    )

    const input = screen.getByLabelText(/project name/i)
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: /create/i }))

    expect(mockMutate).not.toHaveBeenCalled()
  })

  it('closes on successful creation', () => {
    const onClose = vi.fn()
    mockMutate.mockImplementation((_vars, options) => {
      options?.onSuccess?.()
    })

    render(
      <CreateProjectDialog open={true} onClose={onClose} workspaceId={1} />,
      { wrapper: Wrapper }
    )

    const input = screen.getByLabelText(/project name/i)
    fireEvent.change(input, { target: { value: 'New Project' } })
    fireEvent.click(screen.getByRole('button', { name: /create/i }))

    expect(onClose).toHaveBeenCalled()
  })

  it('shows an error message when mutation fails', () => {
    useCreateProject.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      isError: true,
      error: { message: 'Something went wrong' },
    })

    render(
      <CreateProjectDialog open={true} onClose={vi.fn()} workspaceId={1} />,
      { wrapper: Wrapper }
    )

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong')
  })

  it('calls onClose when the sheet close button is clicked', () => {
    const onClose = vi.fn()
    render(
      <CreateProjectDialog open={true} onClose={onClose} workspaceId={1} />,
      { wrapper: Wrapper }
    )

    fireEvent.click(screen.getByRole('button', { name: /close/i }))

    expect(onClose).toHaveBeenCalled()
  })

  it('shows validation error when name is empty and submit is clicked', () => {
    render(
      <CreateProjectDialog open={true} onClose={vi.fn()} workspaceId={1} />,
      { wrapper: Wrapper }
    )

    fireEvent.click(screen.getByRole('button', { name: /create/i }))

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(/required/i)
  })
})
