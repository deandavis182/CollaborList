import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// ---------------------------------------------------------------------------
// Mock ../../lib/api before importing the component
// ---------------------------------------------------------------------------
vi.mock('../../../lib/api.js', () => ({
  useListItems: vi.fn(),
  useUpdateItem: vi.fn(),
  useWorkspaceMembers: vi.fn(),
  useItemComments: vi.fn(),
  useCreateComment: vi.fn(),
  useDeleteComment: vi.fn(),
  useTags: vi.fn(),
  useAddItemTag: vi.fn(),
  useRemoveItemTag: vi.fn(),
}))

import { useListItems, useUpdateItem, useWorkspaceMembers, useItemComments, useCreateComment, useDeleteComment, useTags, useAddItemTag, useRemoveItemTag } from '../../../lib/api.js'
import { useStore } from '../../../lib/store.js'
import { ItemDetailDrawer } from '../ItemDetailDrawer.jsx'

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

/** Reset store to clean slate before each test */
function resetStore() {
  useStore.setState({
    currentWorkspaceId: null,
    currentProjectId: null,
    detailItemId: null,
    presence: {},
    theme: 'light',
  })
}

const ITEM = {
  id: 42,
  text: 'Write tests',
  status: 'To do',
  assignee_id: 7,
  due_date: '2026-06-30T00:00:00.000Z',
  notes: 'Some notes here',
  completed: false,
}

const MEMBERS = [
  { user_id: 7, email: 'alice@example.com' },
  { user_id: 8, email: 'bob@example.com' },
]

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('ItemDetailDrawer', () => {
  let mutateSpy

  beforeEach(() => {
    resetStore()
    vi.clearAllMocks()

    mutateSpy = vi.fn()

    // Default: item in cache, members available
    useListItems.mockReturnValue({ data: [ITEM], isLoading: false })
    useUpdateItem.mockReturnValue({ mutate: mutateSpy, isPending: false })
    useWorkspaceMembers.mockReturnValue({ data: MEMBERS, isLoading: false })
    useItemComments.mockReturnValue({ data: [], isLoading: false })
    useCreateComment.mockReturnValue({ mutate: vi.fn(), isPending: false })
    useDeleteComment.mockReturnValue({ mutate: vi.fn() })
    useTags.mockReturnValue({ data: [], isLoading: false })
    useAddItemTag.mockReturnValue({ mutate: vi.fn(), isPending: false })
    useRemoveItemTag.mockReturnValue({ mutate: vi.fn(), isPending: false })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // -------------------------------------------------------------------------
  // 1. Drawer opens and shows item fields when detailItemId is set
  // -------------------------------------------------------------------------
  it('shows the drawer with item text/status/assignee/due date when detailItemId matches a cached item', () => {
    useStore.setState({ detailItemId: 42 })

    render(<ItemDetailDrawer listId="list-1" workspaceId="ws-1" />, { wrapper: Wrapper })

    // Sheet is open; data-testid is present on the content root
    expect(screen.getByTestId('item-detail-drawer')).toBeInTheDocument()

    // Title input shows item text
    expect(screen.getByDisplayValue('Write tests')).toBeInTheDocument()

    // Status — "To do" button should be aria-pressed=true
    const todoButton = screen.getByRole('button', { name: 'To do' })
    expect(todoButton).toHaveAttribute('aria-pressed', 'true')

    // Assignee — select reflects alice (user_id 7)
    const select = screen.getByRole('combobox')
    expect(select.value).toBe('7')

    // Due date input — formatted to YYYY-MM-DD
    const dateInput = screen.getByDisplayValue('2026-06-30')
    expect(dateInput).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // 2. Changing status calls updateItem.mutate
  // -------------------------------------------------------------------------
  it('clicking a status segment calls updateItem.mutate({ id, status })', () => {
    useStore.setState({ detailItemId: 42 })

    render(<ItemDetailDrawer listId="list-1" workspaceId="ws-1" />, { wrapper: Wrapper })

    fireEvent.click(screen.getByRole('button', { name: 'Doing' }))

    expect(mutateSpy).toHaveBeenCalledWith({ id: 42, status: 'Doing' })
  })

  // -------------------------------------------------------------------------
  // 3. Selecting an assignee calls updateItem.mutate with a number
  // -------------------------------------------------------------------------
  it('selecting an assignee calls updateItem.mutate({ id, assignee_id: number })', () => {
    useStore.setState({ detailItemId: 42 })

    render(<ItemDetailDrawer listId="list-1" workspaceId="ws-1" />, { wrapper: Wrapper })

    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: '8' } })

    expect(mutateSpy).toHaveBeenCalledWith({ id: 42, assignee_id: 8 })
  })

  it('selecting "Unassigned" calls updateItem.mutate({ id, assignee_id: null })', () => {
    useStore.setState({ detailItemId: 42 })

    render(<ItemDetailDrawer listId="list-1" workspaceId="ws-1" />, { wrapper: Wrapper })

    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: '' } })

    expect(mutateSpy).toHaveBeenCalledWith({ id: 42, assignee_id: null })
  })

  // -------------------------------------------------------------------------
  // 4. Due date input
  // -------------------------------------------------------------------------
  it('setting the due date calls updateItem.mutate({ id, due_date: YYYY-MM-DD })', () => {
    useStore.setState({ detailItemId: 42 })

    render(<ItemDetailDrawer listId="list-1" workspaceId="ws-1" />, { wrapper: Wrapper })

    const dateInput = screen.getByDisplayValue('2026-06-30')
    fireEvent.change(dateInput, { target: { value: '2026-07-15' } })

    expect(mutateSpy).toHaveBeenCalledWith({ id: 42, due_date: '2026-07-15' })
  })

  it('clearing the due date calls updateItem.mutate({ id, due_date: null })', () => {
    useStore.setState({ detailItemId: 42 })

    render(<ItemDetailDrawer listId="list-1" workspaceId="ws-1" />, { wrapper: Wrapper })

    const dateInput = screen.getByDisplayValue('2026-06-30')
    fireEvent.change(dateInput, { target: { value: '' } })

    expect(mutateSpy).toHaveBeenCalledWith({ id: 42, due_date: null })
  })

  // -------------------------------------------------------------------------
  // 5. Notes debounce — 500ms
  // -------------------------------------------------------------------------
  it('notes change does NOT fire mutate before 500ms debounce', () => {
    vi.useFakeTimers()
    useStore.setState({ detailItemId: 42 })

    render(<ItemDetailDrawer listId="list-1" workspaceId="ws-1" />, { wrapper: Wrapper })

    const textarea = screen.getByRole('textbox', { name: /notes/i })
    fireEvent.change(textarea, { target: { value: 'Updated notes' } })

    // Advance 300ms — should NOT have fired yet
    act(() => vi.advanceTimersByTime(300))

    expect(mutateSpy).not.toHaveBeenCalled()
  })

  it('notes change fires mutate after 500ms debounce', () => {
    vi.useFakeTimers()
    useStore.setState({ detailItemId: 42 })

    render(<ItemDetailDrawer listId="list-1" workspaceId="ws-1" />, { wrapper: Wrapper })

    const textarea = screen.getByRole('textbox', { name: /notes/i })
    fireEvent.change(textarea, { target: { value: 'Updated notes' } })

    // Advance past 500ms
    act(() => vi.advanceTimersByTime(500))

    expect(mutateSpy).toHaveBeenCalledWith({ id: 42, notes: 'Updated notes' })
  })

  it('rapid notes changes only fire mutate once after the final keystroke', () => {
    vi.useFakeTimers()
    useStore.setState({ detailItemId: 42 })

    render(<ItemDetailDrawer listId="list-1" workspaceId="ws-1" />, { wrapper: Wrapper })

    const textarea = screen.getByRole('textbox', { name: /notes/i })

    // Three rapid keystrokes
    fireEvent.change(textarea, { target: { value: 'U' } })
    act(() => vi.advanceTimersByTime(200))
    fireEvent.change(textarea, { target: { value: 'Up' } })
    act(() => vi.advanceTimersByTime(200))
    fireEvent.change(textarea, { target: { value: 'Updated notes' } })

    // Debounce not yet expired
    expect(mutateSpy).not.toHaveBeenCalled()

    // Expire the debounce
    act(() => vi.advanceTimersByTime(500))

    expect(mutateSpy).toHaveBeenCalledTimes(1)
    expect(mutateSpy).toHaveBeenCalledWith({ id: 42, notes: 'Updated notes' })
  })

  // -------------------------------------------------------------------------
  // 6. Closing the sheet calls closeDetail
  // -------------------------------------------------------------------------
  it('pressing Escape calls closeDetail (store.detailItemId becomes null)', () => {
    useStore.setState({ detailItemId: 42 })

    render(<ItemDetailDrawer listId="list-1" workspaceId="ws-1" />, { wrapper: Wrapper })

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(useStore.getState().detailItemId).toBeNull()
  })

  it('clicking the close button calls closeDetail', () => {
    useStore.setState({ detailItemId: 42 })

    render(<ItemDetailDrawer listId="list-1" workspaceId="ws-1" />, { wrapper: Wrapper })

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(useStore.getState().detailItemId).toBeNull()
  })

  // -------------------------------------------------------------------------
  // 7. When detailItemId is set but the item is not in cache
  // -------------------------------------------------------------------------
  it('renders the drawer closed (not crashing) when item is not in cache', () => {
    useListItems.mockReturnValue({ data: [], isLoading: false })
    useStore.setState({ detailItemId: 999 })

    const { container } = render(
      <ItemDetailDrawer listId="list-1" workspaceId="ws-1" />,
      { wrapper: Wrapper }
    )

    // Sheet returns null when open=false — no sheet-panel in DOM
    expect(screen.queryByTestId('sheet-panel')).not.toBeInTheDocument()
    // No crash — container should have rendered something (the component itself)
    expect(container).toBeTruthy()
  })

  // -------------------------------------------------------------------------
  // 8. Drawer is closed when detailItemId is null
  // -------------------------------------------------------------------------
  it('renders the drawer closed when detailItemId is null', () => {
    useStore.setState({ detailItemId: null })

    render(<ItemDetailDrawer listId="list-1" workspaceId="ws-1" />, { wrapper: Wrapper })

    expect(screen.queryByTestId('item-detail-drawer')).not.toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // 9. CommentThread is rendered inside the open drawer (Task 3B.6)
  // -------------------------------------------------------------------------
  it('renders CommentThread (data-testid="comment-thread") inside an open drawer', () => {
    useStore.setState({ detailItemId: 42 })

    render(<ItemDetailDrawer listId="list-1" workspaceId="ws-1" />, { wrapper: Wrapper })

    expect(screen.getByTestId('comment-thread')).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // 10. Tags field renders TagPicker inside the open drawer (Task 4.T2)
  // -------------------------------------------------------------------------
  it('renders the Tags field with a TagPicker (data-testid="tag-picker") for the open item', () => {
    useStore.setState({ detailItemId: 42 })
    // Give the item some tags to display
    const itemWithTags = { ...ITEM, tags: [{ id: 'tag-1', name: 'Urgent', color: '#ef4444' }] }
    useListItems.mockReturnValue({ data: [itemWithTags], isLoading: false })

    render(<ItemDetailDrawer listId="list-1" workspaceId="ws-1" />, { wrapper: Wrapper })

    expect(screen.getByTestId('tag-picker')).toBeInTheDocument()
  })

  it('Tags field label is visible in the open drawer', () => {
    useStore.setState({ detailItemId: 42 })

    render(<ItemDetailDrawer listId="list-1" workspaceId="ws-1" />, { wrapper: Wrapper })

    expect(screen.getByText('Tags')).toBeInTheDocument()
  })

  it('TagPicker shows item tags as chips inside the drawer', () => {
    useStore.setState({ detailItemId: 42 })
    const itemWithTags = {
      ...ITEM,
      tags: [
        { id: 'tag-1', name: 'Urgent', color: '#ef4444' },
        { id: 'tag-2', name: 'Bug', color: null },
      ],
    }
    useListItems.mockReturnValue({ data: [itemWithTags], isLoading: false })

    render(<ItemDetailDrawer listId="list-1" workspaceId="ws-1" />, { wrapper: Wrapper })

    expect(screen.getByTestId('item-tag-tag-1')).toBeInTheDocument()
    expect(screen.getByTestId('item-tag-tag-2')).toBeInTheDocument()
  })
})
