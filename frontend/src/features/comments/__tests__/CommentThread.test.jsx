import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// ---------------------------------------------------------------------------
// Mock ../../lib/api before importing the component
// ---------------------------------------------------------------------------
vi.mock('../../../lib/api.js', () => ({
  useItemComments: vi.fn(),
  useDeleteComment: vi.fn(),
  useCreateComment: vi.fn(),
  useWorkspaceMembers: vi.fn(),
}))

import { useItemComments, useDeleteComment, useCreateComment, useWorkspaceMembers } from '../../../lib/api.js'
import { CommentThread } from '../CommentThread.jsx'

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

const CURRENT_USER = { id: 1, email: 'alice@example.com' }
const OTHER_USER = { id: 2, email: 'bob@example.com' }

const COMMENTS = [
  {
    id: 10,
    user_id: 1,
    email: 'alice@example.com',
    body: 'First comment from alice',
    created_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(), // 2 minutes ago
  },
  {
    id: 11,
    user_id: 2,
    email: 'bob@example.com',
    body: 'Reply from bob',
    created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // 3 hours ago
  },
]

const MEMBERS = [
  { user_id: 1, email: 'alice@example.com' },
  { user_id: 2, email: 'bob@example.com' },
]

// ---------------------------------------------------------------------------
// Setup helpers
// ---------------------------------------------------------------------------
function setupMocks({ comments = COMMENTS, isLoading = false } = {}) {
  useItemComments.mockReturnValue({ data: comments, isLoading })
  useDeleteComment.mockReturnValue({ mutate: vi.fn() })
  useCreateComment.mockReturnValue({ mutate: vi.fn(), isPending: false })
  useWorkspaceMembers.mockReturnValue({ data: MEMBERS })
}

function setCurrentUser(user = CURRENT_USER) {
  localStorage.setItem('user', JSON.stringify(user))
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('CommentThread', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  // -------------------------------------------------------------------------
  // 1. Renders comment-thread testid
  // -------------------------------------------------------------------------
  it('renders with data-testid="comment-thread"', () => {
    setCurrentUser()
    setupMocks()

    render(<CommentThread itemId={5} workspaceId="ws-1" />, { wrapper: Wrapper })

    expect(screen.getByTestId('comment-thread')).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // 2. Shows loading state
  // -------------------------------------------------------------------------
  it('shows loading indicator when comments are loading', () => {
    setCurrentUser()
    setupMocks({ isLoading: true, comments: [] })

    render(<CommentThread itemId={5} workspaceId="ws-1" />, { wrapper: Wrapper })

    expect(screen.getByTestId('comments-loading')).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // 3. Shows empty state
  // -------------------------------------------------------------------------
  it('shows empty state when there are no comments', () => {
    setCurrentUser()
    setupMocks({ comments: [] })

    render(<CommentThread itemId={5} workspaceId="ws-1" />, { wrapper: Wrapper })

    expect(screen.getByText('No comments yet')).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // 4. Renders comment author and body
  // -------------------------------------------------------------------------
  it('renders each comment with author email and body', () => {
    setCurrentUser()
    setupMocks()

    render(<CommentThread itemId={5} workspaceId="ws-1" />, { wrapper: Wrapper })

    expect(screen.getByText('alice@example.com')).toBeInTheDocument()
    expect(screen.getByText('First comment from alice')).toBeInTheDocument()
    expect(screen.getByText('bob@example.com')).toBeInTheDocument()
    expect(screen.getByText('Reply from bob')).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // 5. Shows delete button only for current user's own comments
  // -------------------------------------------------------------------------
  it('shows delete button on current user own comment but not on others', () => {
    setCurrentUser(CURRENT_USER)
    setupMocks()

    render(<CommentThread itemId={5} workspaceId="ws-1" />, { wrapper: Wrapper })

    // Should have exactly one delete button (for alice's comment)
    const deleteButtons = screen.getAllByRole('button', { name: /delete comment/i })
    expect(deleteButtons).toHaveLength(1)
  })

  // -------------------------------------------------------------------------
  // 6. Clicking delete calls deleteComment.mutate with the comment id
  // -------------------------------------------------------------------------
  it('clicking delete on own comment calls deleteComment.mutate with comment id', () => {
    setCurrentUser(CURRENT_USER)
    const mutateSpy = vi.fn()
    useDeleteComment.mockReturnValue({ mutate: mutateSpy })
    setupMocks()
    // re-set delete mock since setupMocks may override
    useDeleteComment.mockReturnValue({ mutate: mutateSpy })

    render(<CommentThread itemId={5} workspaceId="ws-1" />, { wrapper: Wrapper })

    const deleteButton = screen.getByRole('button', { name: /delete comment/i })
    fireEvent.click(deleteButton)

    expect(mutateSpy).toHaveBeenCalledWith(10)
  })

  // -------------------------------------------------------------------------
  // 7. No delete button on other user's comment
  // -------------------------------------------------------------------------
  it('shows no delete button when all comments are from other users', () => {
    setCurrentUser(OTHER_USER)
    setupMocks({
      comments: [COMMENTS[0]], // alice's comment only; current user is bob
    })

    render(<CommentThread itemId={5} workspaceId="ws-1" />, { wrapper: Wrapper })

    expect(screen.queryByRole('button', { name: /delete comment/i })).not.toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // 8. Shows heading "Comments"
  // -------------------------------------------------------------------------
  it('renders a "Comments" heading', () => {
    setCurrentUser()
    setupMocks()

    render(<CommentThread itemId={5} workspaceId="ws-1" />, { wrapper: Wrapper })

    expect(screen.getByText('Comments')).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // 9. Relative timestamps
  // -------------------------------------------------------------------------
  it('shows "just now" for very recent comments', () => {
    setCurrentUser()
    setupMocks({
      comments: [
        {
          id: 20,
          user_id: 1,
          email: 'alice@example.com',
          body: 'Just posted',
          created_at: new Date(Date.now() - 30 * 1000).toISOString(), // 30 seconds ago
        },
      ],
    })

    render(<CommentThread itemId={5} workspaceId="ws-1" />, { wrapper: Wrapper })

    expect(screen.getByText('just now')).toBeInTheDocument()
  })

  it('shows "Xm ago" for comments from minutes ago', () => {
    setCurrentUser()
    setupMocks({
      comments: [
        {
          id: 21,
          user_id: 1,
          email: 'alice@example.com',
          body: 'Minutes ago',
          created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
        },
      ],
    })

    render(<CommentThread itemId={5} workspaceId="ws-1" />, { wrapper: Wrapper })

    expect(screen.getByText('5m ago')).toBeInTheDocument()
  })

  it('shows "Xh ago" for comments from hours ago', () => {
    setCurrentUser()
    setupMocks({
      comments: [
        {
          id: 22,
          user_id: 1,
          email: 'alice@example.com',
          body: 'Hours ago',
          created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // 3 hours ago
        },
      ],
    })

    render(<CommentThread itemId={5} workspaceId="ws-1" />, { wrapper: Wrapper })

    expect(screen.getByText('3h ago')).toBeInTheDocument()
  })

  it('shows "Xd ago" for comments from days ago', () => {
    setCurrentUser()
    setupMocks({
      comments: [
        {
          id: 23,
          user_id: 1,
          email: 'alice@example.com',
          body: 'Days ago',
          created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
        },
      ],
    })

    render(<CommentThread itemId={5} workspaceId="ws-1" />, { wrapper: Wrapper })

    expect(screen.getByText('3d ago')).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // 10. Renders the CommentComposer at the bottom
  // -------------------------------------------------------------------------
  it('renders CommentComposer (data-testid="comment-composer")', () => {
    setCurrentUser()
    setupMocks()

    render(<CommentThread itemId={5} workspaceId="ws-1" />, { wrapper: Wrapper })

    expect(screen.getByTestId('comment-composer')).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // 11. String coercion: works when user.id is string and comment.user_id is number
  // -------------------------------------------------------------------------
  it('correctly identifies own comment using String() coercion when types differ', () => {
    setCurrentUser({ id: '1', email: 'alice@example.com' }) // string id
    const mutateSpy = vi.fn()
    useDeleteComment.mockReturnValue({ mutate: mutateSpy })
    setupMocks({
      comments: [{ ...COMMENTS[0], user_id: 1 }], // number user_id in comment
    })
    useDeleteComment.mockReturnValue({ mutate: mutateSpy })

    render(<CommentThread itemId={5} workspaceId="ws-1" />, { wrapper: Wrapper })

    // Should find delete button — types differ but String() coercion makes them match
    expect(screen.getByRole('button', { name: /delete comment/i })).toBeInTheDocument()
  })
})
