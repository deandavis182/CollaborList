import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// ---------------------------------------------------------------------------
// Mock api + store before importing the component
// ---------------------------------------------------------------------------
vi.mock('../../../lib/api.js', () => ({
  useTags: vi.fn(),
  useCreateTag: vi.fn(),
  useDeleteTag: vi.fn(),
}))

vi.mock('../../../lib/store.js', () => ({
  useStore: vi.fn(),
}))

import { useTags, useCreateTag, useDeleteTag } from '../../../lib/api.js'
import { useStore } from '../../../lib/store.js'
import { TagManager } from '../TagManager.jsx'

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

const WORKSPACE_ID = 'ws-1'

const SAMPLE_TAGS = [
  { id: 'tag-1', name: 'Urgent', color: '#ef4444' },
  { id: 'tag-2', name: 'Feature', color: '#3b82f6' },
  { id: 'tag-3', name: 'Bug', color: null },
]

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('TagManager', () => {
  let mockCreate
  let mockDelete

  beforeEach(() => {
    mockCreate = vi.fn()
    mockDelete = vi.fn()

    useTags.mockReturnValue({ data: SAMPLE_TAGS, isLoading: false })
    useCreateTag.mockReturnValue({ mutate: mockCreate, isPending: false })
    useDeleteTag.mockReturnValue({ mutate: mockDelete })
    useStore.mockImplementation((selector) =>
      selector({ currentWorkspaceId: WORKSPACE_ID })
    )
  })

  // ── Rendering ─────────────────────────────────────────────────────────────

  it('renders all tags as chips', () => {
    render(<TagManager workspaceId={WORKSPACE_ID} />, { wrapper: Wrapper })

    expect(screen.getByText('Urgent')).toBeInTheDocument()
    expect(screen.getByText('Feature')).toBeInTheDocument()
    expect(screen.getByText('Bug')).toBeInTheDocument()
  })

  it('shows a loading state while tags are fetching', () => {
    useTags.mockReturnValue({ data: undefined, isLoading: true })

    render(<TagManager workspaceId={WORKSPACE_ID} />, { wrapper: Wrapper })

    expect(screen.getByText(/loading tags/i)).toBeInTheDocument()
  })

  it('shows an empty state when there are no tags', () => {
    useTags.mockReturnValue({ data: [], isLoading: false })

    render(<TagManager workspaceId={WORKSPACE_ID} />, { wrapper: Wrapper })

    expect(screen.getByText(/no tags yet/i)).toBeInTheDocument()
  })

  it('renders a create form with a name input', () => {
    render(<TagManager workspaceId={WORKSPACE_ID} />, { wrapper: Wrapper })

    expect(screen.getByLabelText(/name/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add tag/i })).toBeInTheDocument()
  })

  // ── Create ────────────────────────────────────────────────────────────────

  it('calls useCreateTag mutate with { name } when form is submitted without a color', () => {
    render(<TagManager workspaceId={WORKSPACE_ID} />, { wrapper: Wrapper })

    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: 'My Tag' },
    })
    fireEvent.click(screen.getByRole('button', { name: /add tag/i }))

    expect(mockCreate).toHaveBeenCalledWith(
      { name: 'My Tag' },
      expect.any(Object)
    )
  })

  it('calls useCreateTag mutate with { name, color } when a color is selected', () => {
    render(<TagManager workspaceId={WORKSPACE_ID} />, { wrapper: Wrapper })

    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: 'Colored Tag' },
    })

    // Click the first color swatch
    const swatches = screen.getAllByRole('button', { name: /select color/i })
    fireEvent.click(swatches[0])

    fireEvent.click(screen.getByRole('button', { name: /add tag/i }))

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Colored Tag',
        color: expect.any(String),
      }),
      expect.any(Object)
    )
  })

  it('shows a validation error when name is empty on submit', () => {
    render(<TagManager workspaceId={WORKSPACE_ID} />, { wrapper: Wrapper })

    fireEvent.click(screen.getByRole('button', { name: /add tag/i }))

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('clears the name field after successful creation', () => {
    mockCreate.mockImplementation((_vars, options) => {
      options?.onSuccess?.()
    })

    render(<TagManager workspaceId={WORKSPACE_ID} />, { wrapper: Wrapper })

    const input = screen.getByLabelText(/name/i)
    fireEvent.change(input, { target: { value: 'New Tag' } })
    fireEvent.click(screen.getByRole('button', { name: /add tag/i }))

    expect(input.value).toBe('')
  })

  // ── Delete ────────────────────────────────────────────────────────────────

  it('calls useDeleteTag mutate with the tag id when remove is clicked', () => {
    render(<TagManager workspaceId={WORKSPACE_ID} />, { wrapper: Wrapper })

    // "Remove" aria-label buttons are rendered inside Chips
    const removeButtons = screen.getAllByRole('button', { name: /remove/i })
    // There should be one per tag
    expect(removeButtons).toHaveLength(SAMPLE_TAGS.length)

    fireEvent.click(removeButtons[0])

    expect(mockDelete).toHaveBeenCalledWith('tag-1')
  })

  it('calls useDeleteTag with the correct tag id for each chip', () => {
    render(<TagManager workspaceId={WORKSPACE_ID} />, { wrapper: Wrapper })

    const removeButtons = screen.getAllByRole('button', { name: /remove/i })

    fireEvent.click(removeButtons[1]) // "Feature"
    expect(mockDelete).toHaveBeenCalledWith('tag-2')

    fireEvent.click(removeButtons[2]) // "Bug"
    expect(mockDelete).toHaveBeenCalledWith('tag-3')
  })

  // ── Store fallback ────────────────────────────────────────────────────────

  it('falls back to store currentWorkspaceId when workspaceId prop is omitted', () => {
    useStore.mockImplementation((selector) =>
      selector({ currentWorkspaceId: 'ws-store' })
    )

    render(<TagManager />, { wrapper: Wrapper })

    // useTags should have been called (mock verifies it renders without crash)
    expect(useTags).toHaveBeenCalledWith('ws-store')
  })
})
