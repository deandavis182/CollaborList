import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// ---------------------------------------------------------------------------
// Mock ../../lib/api before importing the component
// ---------------------------------------------------------------------------
vi.mock('../../../lib/api.js', () => ({
  useWorkspaceActivity: vi.fn(),
  useMarkActivityRead: vi.fn(),
}))

import { useWorkspaceActivity, useMarkActivityRead } from '../../../lib/api.js'
import { ActivityFeed } from '../ActivityFeed.jsx'

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

// Sample activity items
const ITEMS = [
  {
    id: 1,
    actor_email: 'alice@example.com',
    verb: 'commented',
    created_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(), // 2 min ago
  },
  {
    id: 2,
    actor_email: 'bob@example.com',
    verb: 'assigned',
    created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5 hours ago
  },
]

function setupMocks({ items = ITEMS, isLoading = false, mutateFn = vi.fn() } = {}) {
  useWorkspaceActivity.mockReturnValue({ data: { items, unread: 0 }, isLoading })
  useMarkActivityRead.mockReturnValue({ mutate: mutateFn })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ActivityFeed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // -------------------------------------------------------------------------
  // 1. Renders activity-feed testid
  // -------------------------------------------------------------------------
  it('renders with data-testid="activity-feed"', () => {
    setupMocks()
    render(<ActivityFeed workspaceId="ws-1" />, { wrapper: Wrapper })
    expect(screen.getByTestId('activity-feed')).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // 2. Renders "Activity" heading
  // -------------------------------------------------------------------------
  it('shows an "Activity" heading', () => {
    setupMocks()
    render(<ActivityFeed workspaceId="ws-1" />, { wrapper: Wrapper })
    expect(screen.getByText('Activity')).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // 3. Renders activity entries with actor + verb phrase
  // -------------------------------------------------------------------------
  it('renders each activity entry with actor email and verb phrase', () => {
    setupMocks()
    render(<ActivityFeed workspaceId="ws-1" />, { wrapper: Wrapper })

    expect(screen.getByTestId('activity-1')).toBeInTheDocument()
    expect(screen.getByTestId('activity-2')).toBeInTheDocument()

    expect(screen.getByText('alice@example.com')).toBeInTheDocument()
    expect(screen.getByText('bob@example.com')).toBeInTheDocument()

    // verb phrases
    expect(screen.getByText('commented on an item')).toBeInTheDocument()
    expect(screen.getByText('assigned an item')).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // 4. verbPhrase mapping for a couple of verbs
  // -------------------------------------------------------------------------
  it('maps "completed" verb to "completed an item"', () => {
    setupMocks({
      items: [{ id: 10, actor_email: 'carol@example.com', verb: 'completed', created_at: new Date().toISOString() }],
    })
    render(<ActivityFeed workspaceId="ws-1" />, { wrapper: Wrapper })
    expect(screen.getByText('completed an item')).toBeInTheDocument()
  })

  it('maps "mentioned" verb to "mentioned someone"', () => {
    setupMocks({
      items: [{ id: 11, actor_email: 'dave@example.com', verb: 'mentioned', created_at: new Date().toISOString() }],
    })
    render(<ActivityFeed workspaceId="ws-1" />, { wrapper: Wrapper })
    expect(screen.getByText('mentioned someone')).toBeInTheDocument()
  })

  it('passes unknown verbs through as the raw verb', () => {
    setupMocks({
      items: [{ id: 12, actor_email: 'eve@example.com', verb: 'archived', created_at: new Date().toISOString() }],
    })
    render(<ActivityFeed workspaceId="ws-1" />, { wrapper: Wrapper })
    expect(screen.getByText('archived')).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // 5. Loading state
  // -------------------------------------------------------------------------
  it('shows loading indicator when data is loading', () => {
    setupMocks({ isLoading: true, items: [] })
    useWorkspaceActivity.mockReturnValue({ data: undefined, isLoading: true })
    render(<ActivityFeed workspaceId="ws-1" />, { wrapper: Wrapper })
    expect(screen.getByTestId('activity-loading')).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // 6. Empty state
  // -------------------------------------------------------------------------
  it('shows empty state when there are no activity items', () => {
    setupMocks({ items: [] })
    render(<ActivityFeed workspaceId="ws-1" />, { wrapper: Wrapper })
    expect(screen.getByTestId('activity-empty')).toBeInTheDocument()
    expect(screen.getByText('No activity yet')).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // 7. markRead.mutate() called once on mount
  // -------------------------------------------------------------------------
  it('calls markRead.mutate() once on mount', () => {
    const mutateFn = vi.fn()
    setupMocks({ mutateFn })
    render(<ActivityFeed workspaceId="ws-1" />, { wrapper: Wrapper })
    expect(mutateFn).toHaveBeenCalledTimes(1)
  })

  it('does NOT call markRead.mutate() when workspaceId is falsy', () => {
    const mutateFn = vi.fn()
    setupMocks({ mutateFn })
    useWorkspaceActivity.mockReturnValue({ data: { items: [], unread: 0 }, isLoading: false })
    render(<ActivityFeed workspaceId="" />, { wrapper: Wrapper })
    expect(mutateFn).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // 8. markRead fires again when workspaceId changes to a new value
  // -------------------------------------------------------------------------
  it('calls markRead.mutate() again when workspaceId changes to a new workspace', () => {
    const mutateFn = vi.fn()
    useWorkspaceActivity.mockReturnValue({ data: { items: [], unread: 0 }, isLoading: false })
    useMarkActivityRead.mockReturnValue({ mutate: mutateFn })

    // First mount with ws-1 — fires once
    const { rerender } = render(
      <Wrapper>
        <ActivityFeed workspaceId="ws-1" />
      </Wrapper>
    )
    expect(mutateFn).toHaveBeenCalledTimes(1)

    // Change to ws-2 — should fire again
    rerender(
      <Wrapper>
        <ActivityFeed workspaceId="ws-2" />
      </Wrapper>
    )
    expect(mutateFn).toHaveBeenCalledTimes(2)
  })
})
