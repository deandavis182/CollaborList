import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// ---------------------------------------------------------------------------
// Mock ../../lib/api before importing the component
// ---------------------------------------------------------------------------
vi.mock('../../../lib/api.js', () => ({
  useCreateComment: vi.fn(),
  useWorkspaceMembers: vi.fn(),
  useItemComments: vi.fn(),
  useDeleteComment: vi.fn(),
}))

import { useCreateComment, useWorkspaceMembers } from '../../../lib/api.js'
import { CommentComposer } from '../CommentComposer.jsx'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

function Wrapper({ children }) {
  return (
    <QueryClientProvider client={makeQC()}>{children}</QueryClientProvider>
  )
}

const MEMBERS = [
  { user_id: 1, email: 'alice@example.com' },
  { user_id: 2, email: 'bob@example.com' },
  { user_id: 3, email: 'charlie@work.com' },
]

function setupMocks({ mutateSpy = vi.fn(), members = MEMBERS, onError } = {}) {
  const createCommentHook = { mutate: mutateSpy, isPending: false }
  if (onError) {
    createCommentHook.isError = true
  }
  useCreateComment.mockReturnValue(createCommentHook)
  useWorkspaceMembers.mockReturnValue({ data: members })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('CommentComposer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  // -------------------------------------------------------------------------
  // 1. Renders with correct testid
  // -------------------------------------------------------------------------
  it('renders with data-testid="comment-composer"', () => {
    setupMocks()

    render(<CommentComposer itemId={5} workspaceId="ws-1" />, { wrapper: Wrapper })

    expect(screen.getByTestId('comment-composer')).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // 2. Submitting with body text calls createComment.mutate and clears textarea on success
  // -------------------------------------------------------------------------
  it('clicking Send with non-empty body calls createComment.mutate({ body }) and clears textarea on success', () => {
    // Simulate a successful mutate by immediately invoking the onSuccess callback
    const mutateSpy = vi.fn().mockImplementation((_vars, opts) => {
      if (opts?.onSuccess) opts.onSuccess()
    })
    setupMocks({ mutateSpy })

    render(<CommentComposer itemId={5} workspaceId="ws-1" />, { wrapper: Wrapper })

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'Hello world' } })

    fireEvent.click(screen.getByRole('button', { name: /comment|send/i }))

    expect(mutateSpy).toHaveBeenCalledWith(
      { body: 'Hello world' },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) })
    )
    // Textarea must be cleared only after a successful post (via onSuccess)
    expect(textarea.value).toBe('')
  })

  // -------------------------------------------------------------------------
  // 3. Empty / whitespace does not call mutate
  // -------------------------------------------------------------------------
  it('clicking Send with empty body does nothing', () => {
    const mutateSpy = vi.fn()
    setupMocks({ mutateSpy })

    render(<CommentComposer itemId={5} workspaceId="ws-1" />, { wrapper: Wrapper })

    fireEvent.click(screen.getByRole('button', { name: /comment|send/i }))

    expect(mutateSpy).not.toHaveBeenCalled()
  })

  it('clicking Send with whitespace-only body does nothing', () => {
    const mutateSpy = vi.fn()
    setupMocks({ mutateSpy })

    render(<CommentComposer itemId={5} workspaceId="ws-1" />, { wrapper: Wrapper })

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: '   ' } })

    fireEvent.click(screen.getByRole('button', { name: /comment|send/i }))

    expect(mutateSpy).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // 4. Enter (without Shift) submits
  // -------------------------------------------------------------------------
  it('pressing Enter without Shift submits the comment', () => {
    const mutateSpy = vi.fn()
    setupMocks({ mutateSpy })

    render(<CommentComposer itemId={5} workspaceId="ws-1" />, { wrapper: Wrapper })

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'Enter submit' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })

    expect(mutateSpy).toHaveBeenCalledWith(
      { body: 'Enter submit' },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) })
    )
  })

  it('pressing Shift+Enter does NOT submit', () => {
    const mutateSpy = vi.fn()
    setupMocks({ mutateSpy })

    render(<CommentComposer itemId={5} workspaceId="ws-1" />, { wrapper: Wrapper })

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'Multiline\n' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })

    expect(mutateSpy).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // 5. @mention: typing @ shows the menu with members
  // -------------------------------------------------------------------------
  it('typing @ in textarea shows the mention menu with all members', () => {
    setupMocks()

    render(<CommentComposer itemId={5} workspaceId="ws-1" />, { wrapper: Wrapper })

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: '@' } })

    expect(screen.getByTestId('mention-menu')).toBeInTheDocument()
    // All 3 members should appear
    expect(screen.getByTestId('mention-option-1')).toBeInTheDocument()
    expect(screen.getByTestId('mention-option-2')).toBeInTheDocument()
    expect(screen.getByTestId('mention-option-3')).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // 6. @mention: typing @al filters to matching members (case-insensitive)
  // -------------------------------------------------------------------------
  it('typing @al filters members to those matching "al" in email', () => {
    setupMocks()

    render(<CommentComposer itemId={5} workspaceId="ws-1" />, { wrapper: Wrapper })

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: '@al' } })

    expect(screen.getByTestId('mention-menu')).toBeInTheDocument()
    // alice@example.com contains "al"
    expect(screen.getByTestId('mention-option-1')).toBeInTheDocument()
    // bob@example.com and charlie@work.com do not contain "al"
    expect(screen.queryByTestId('mention-option-2')).not.toBeInTheDocument()
    expect(screen.queryByTestId('mention-option-3')).not.toBeInTheDocument()
  })

  it('filtering is case-insensitive', () => {
    setupMocks()

    render(<CommentComposer itemId={5} workspaceId="ws-1" />, { wrapper: Wrapper })

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: '@AL' } })

    expect(screen.getByTestId('mention-menu')).toBeInTheDocument()
    expect(screen.getByTestId('mention-option-1')).toBeInTheDocument()
    expect(screen.queryByTestId('mention-option-2')).not.toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // 7. Selecting a mention inserts @local-part + space and closes menu
  // -------------------------------------------------------------------------
  it('clicking a mention option inserts @local-part followed by space and closes menu', () => {
    setupMocks()

    render(<CommentComposer itemId={5} workspaceId="ws-1" />, { wrapper: Wrapper })

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'Hey @ali' } })

    const option = screen.getByTestId('mention-option-1')
    fireEvent.mouseDown(option) // mouseDown before blur
    fireEvent.click(option)

    // The @ali fragment should be replaced with @alice
    expect(textarea.value).toBe('Hey @alice ')
    // Menu should be closed
    expect(screen.queryByTestId('mention-menu')).not.toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // 8. Escape closes the mention menu without inserting
  // -------------------------------------------------------------------------
  it('pressing Escape closes the mention menu without inserting', () => {
    setupMocks()

    render(<CommentComposer itemId={5} workspaceId="ws-1" />, { wrapper: Wrapper })

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: '@al' } })

    expect(screen.getByTestId('mention-menu')).toBeInTheDocument()

    fireEvent.keyDown(textarea, { key: 'Escape' })

    expect(screen.queryByTestId('mention-menu')).not.toBeInTheDocument()
    // Value should be unchanged
    expect(textarea.value).toBe('@al')
  })

  // -------------------------------------------------------------------------
  // 9. Menu closes when @ fragment is removed
  // -------------------------------------------------------------------------
  it('menu disappears when text before caret no longer matches @fragment', () => {
    setupMocks()

    render(<CommentComposer itemId={5} workspaceId="ws-1" />, { wrapper: Wrapper })

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: '@al' } })

    expect(screen.getByTestId('mention-menu')).toBeInTheDocument()

    // Clear the text
    fireEvent.change(textarea, { target: { value: 'hello' } })

    expect(screen.queryByTestId('mention-menu')).not.toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // 10. Error path: mutation error shows Toast and preserves draft
  // -------------------------------------------------------------------------
  it('shows a Toast when createComment mutation triggers onError and preserves the draft', async () => {
    const mutateSpy = vi.fn().mockImplementation((_vars, opts) => {
      if (opts?.onError) opts.onError(new Error('403 Forbidden'))
    })
    useCreateComment.mockReturnValue({ mutate: mutateSpy, isPending: false })
    useWorkspaceMembers.mockReturnValue({ data: MEMBERS })

    render(<CommentComposer itemId={5} workspaceId="ws-1" />, { wrapper: Wrapper })

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'test comment' } })
    fireEvent.click(screen.getByRole('button', { name: /comment|send/i }))

    await waitFor(() => {
      expect(screen.getByRole('status')).toBeInTheDocument()
    })
    expect(screen.getByRole('status')).toHaveTextContent(/couldn't post comment/i)
    // Draft must be preserved so the user can retry after a failed post
    expect(textarea.value).toBe('test comment')
  })

  // -------------------------------------------------------------------------
  // 11. disabled prop disables the textarea and button
  // -------------------------------------------------------------------------
  it('disabled prop disables composer interaction', () => {
    const mutateSpy = vi.fn()
    setupMocks({ mutateSpy })

    render(<CommentComposer itemId={5} workspaceId="ws-1" disabled />, { wrapper: Wrapper })

    const button = screen.getByRole('button', { name: /comment|send/i })
    expect(button).toBeDisabled()
  })
})
